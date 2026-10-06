import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseDohAnswers, resolveDomainRecords, verifyProjectDomain } from "./dns";
import type { ProjectDomain } from "./types";

// The verification flow persists its result, so the store is stubbed to keep this a unit test.
const stored = new Map<string, ProjectDomain>();

vi.mock("./store", () => ({
  updateProjectDomain: async (id: string, patch: Partial<ProjectDomain>) => {
    const current = stored.get(id);
    if (!current) return null;
    const next = { ...current, ...patch };
    stored.set(id, next);
    return next;
  },
}));

const originalFetch = globalThis.fetch;

function dohResponse(answers: { name: string; type: number; data: string }[]) {
  return {
    ok: true,
    json: async () => ({ Status: 0, Answer: answers }),
  } as Response;
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.unstubAllEnvs();
});

describe("DNS answer parsing", () => {
  it("keeps only answers of the requested type", () => {
    const values = parseDohAnswers(
      {
        Answer: [
          { name: "shop.example.com", type: 5, data: "apps.cognix.example.com." },
          { name: "shop.example.com", type: 1, data: "203.0.113.10" },
        ],
      },
      "CNAME",
    );
    expect(values).toEqual(["apps.cognix.example.com"]);
  });

  it("joins the quoted chunks of a long TXT answer", () => {
    const values = parseDohAnswers(
      { Answer: [{ name: "_cognix-challenge.shop.example.com", type: 16, data: '"cognix-domain-" "verification=abc"' }] },
      "TXT",
    );
    expect(values).toEqual(["cognix-domain-verification=abc"]);
  });

  it("returns nothing when the name does not exist", () => {
    expect(parseDohAnswers({ Status: 3 }, "A")).toEqual([]);
  });
});

describe("domain record resolution", () => {
  it("looks up ownership, routing, and the routing target address", async () => {
    const requested: string[] = [];
    globalThis.fetch = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input));
      requested.push(`${url.searchParams.get("type")} ${url.searchParams.get("name")}`);
      return dohResponse([]);
    }) as unknown as typeof fetch;

    await resolveDomainRecords({ hostname: "shop.example.com" }, "apps.cognix.example.com");
    expect(requested).toEqual([
      "TXT _cognix-challenge.shop.example.com",
      "CNAME shop.example.com",
      "A shop.example.com",
      "A apps.cognix.example.com",
    ]);
  });

  it("survives a failing lookup without throwing", async () => {
    globalThis.fetch = vi.fn(async () => ({ ok: false, json: async () => ({}) }) as Response) as unknown as typeof fetch;
    await expect(resolveDomainRecords({ hostname: "shop.example.com" }, null)).resolves.toEqual({
      txt: [],
      cname: [],
      a: [],
      targetA: [],
    });
  });
});

describe("stored verification outcome", () => {
  beforeEach(() => {
    vi.stubEnv("APP_BASE_URL", "https://cognix.example.com");
    vi.stubEnv("COGNIX_DOMAIN_CNAME_TARGET", "apps.cognix.example.com");
  });

  async function attach(hostname: string) {
    const domain: ProjectDomain = {
      id: `domain-${hostname}`,
      projectId: "project-1",
      ownerId: "owner-1",
      hostname,
      status: "pending",
      verificationToken: "abc",
      managedByProvider: false,
      lastError: null,
      verifiedAt: null,
      lastCheckedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    stored.set(domain.id, domain);
    return domain;
  }

  it("activates a domain once both records resolve", async () => {
    globalThis.fetch = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input));
      const type = url.searchParams.get("type");
      if (type === "TXT") {
        return dohResponse([
          { name: url.searchParams.get("name") ?? "", type: 16, data: '"cognix-domain-verification=abc"' },
        ]);
      }
      if (type === "CNAME") {
        return dohResponse([{ name: "live.example.com", type: 5, data: "apps.cognix.example.com." }]);
      }
      return dohResponse([]);
    }) as unknown as typeof fetch;

    const verified = await verifyProjectDomain(await attach("live.example.com"));
    expect(verified.status).toBe("active");
    expect(verified.verifiedAt).toBeTruthy();
    expect(verified.lastError).toBeNull();
  });

  it("stays pending with recovery copy while DNS is missing", async () => {
    globalThis.fetch = vi.fn(async () => dohResponse([])) as unknown as typeof fetch;
    const pending = await verifyProjectDomain(await attach("waiting.example.com"));
    expect(pending.status).toBe("pending");
    expect(pending.verifiedAt).toBeNull();
    expect(pending.lastError).toContain("_cognix-challenge.waiting.example.com");
  });

  it("reports a configuration error when no routing target exists", async () => {
    vi.stubEnv("APP_BASE_URL", "");
    vi.stubEnv("COGNIX_DOMAIN_CNAME_TARGET", "");
    const domain = await verifyProjectDomain(await attach("unconfigured.example.com"));
    expect(domain.status).toBe("error");
    expect(domain.lastError).toContain("COGNIX_DOMAIN_CNAME_TARGET");
  });
});
