import { describe, expect, it } from "vitest";
import {
  DomainRequestError,
  appHostnames,
  createVerificationToken,
  dnsRecordsFor,
  domainTargets,
  evaluateDomainVerification,
  hostnameFromHeader,
  isApexHostname,
  isAppHostname,
  isCustomDomainRoutingEnabled,
  matchesRoutingRecord,
  matchesVerificationTxt,
  normalizeCustomHostname,
  verificationRecordName,
} from "./domains";
import type { DomainEnv } from "./domains";

const env = {
  APP_BASE_URL: "https://cognix.example.com",
  COGNIX_DOMAIN_CNAME_TARGET: "apps.cognix.example.com",
  COGNIX_DOMAIN_IPV4: "203.0.113.10",
} as DomainEnv;

describe("hostname parsing", () => {
  it("reads the first forwarded host and drops the port", () => {
    expect(hostnameFromHeader("Shop.Example.com:443, internal:3000")).toBe("shop.example.com");
    expect(hostnameFromHeader(null)).toBe("");
  });

  it("accepts pasted URLs and internationalized names", () => {
    expect(normalizeCustomHostname("https://Shop.Example.com/pricing?x=1", env)).toBe("shop.example.com");
    expect(normalizeCustomHostname("café.example.com", env)).toBe("xn--caf-dma.example.com");
    expect(normalizeCustomHostname("shop.example.com.", env)).toBe("shop.example.com");
  });

  it("rejects hostnames that can never serve a published app", () => {
    const rejected = [
      "",
      "example",
      "*.example.com",
      "app.local",
      "192.168.1.10",
      "shop..example.com",
      "-bad.example.com",
      "cognix.example.com",
      "apps.cognix.example.com",
      "_cognix-challenge.example.com",
    ];
    for (const value of rejected) {
      expect(() => normalizeCustomHostname(value, env), value).toThrow(DomainRequestError);
    }
  });

  it("keeps rejection copy actionable", () => {
    expect(() => normalizeCustomHostname("example", env)).toThrow(/app\.example\.com/);
  });
});

describe("app host detection", () => {
  it("treats configured product hosts, localhost, and preview builds as the builder", () => {
    expect(isAppHostname("cognix.example.com", env)).toBe(true);
    expect(isAppHostname("www.cognix.example.com", env)).toBe(true);
    expect(isAppHostname("localhost", env)).toBe(true);
    expect(isAppHostname("cognix-git-main.vercel.app", env)).toBe(true);
    expect(isAppHostname("shop.example.com", env)).toBe(false);
  });

  it("collects hosts from every configuration source", () => {
    expect(appHostnames({ COGNIX_APP_HOSTS: "one.example.com, two.example.com" } as DomainEnv)).toEqual([
      "one.example.com",
      "two.example.com",
    ]);
  });

  it("disables custom domain routing until the product host is known", () => {
    expect(isCustomDomainRoutingEnabled({} as DomainEnv)).toBe(false);
    expect(isCustomDomainRoutingEnabled(env)).toBe(true);
    expect(isAppHostname("shop.example.com", {} as DomainEnv)).toBe(false);
  });
});

describe("apex detection", () => {
  it("identifies registrable roots including multi-label suffixes", () => {
    expect(isApexHostname("example.com")).toBe(true);
    expect(isApexHostname("example.co.uk")).toBe(true);
    expect(isApexHostname("shop.example.com")).toBe(false);
    expect(isApexHostname("shop.example.co.uk")).toBe(false);
  });
});

describe("DNS record plan", () => {
  const targets = domainTargets(env);

  it("uses a CNAME for subdomains", () => {
    const records = dnsRecordsFor({ hostname: "shop.example.com", verificationToken: "abc" }, targets);
    expect(records).toEqual([
      expect.objectContaining({
        type: "TXT",
        name: "_cognix-challenge.shop.example.com",
        value: "cognix-domain-verification=abc",
        purpose: "verification",
      }),
      expect.objectContaining({ type: "CNAME", name: "shop.example.com", value: "apps.cognix.example.com" }),
    ]);
  });

  it("uses an A record for apex domains when an address is configured", () => {
    const records = dnsRecordsFor({ hostname: "example.com", verificationToken: "abc" }, targets);
    expect(records[1]).toMatchObject({ type: "A", name: "example.com", value: "203.0.113.10" });
  });

  it("falls back to the app host and a CNAME when no address is configured", () => {
    const fallback = domainTargets({ APP_BASE_URL: "https://cognix.example.com" } as DomainEnv);
    expect(fallback).toEqual({ cname: "cognix.example.com", ipv4: null });
    const records = dnsRecordsFor({ hostname: "example.com", verificationToken: "abc" }, fallback);
    expect(records[1]).toMatchObject({ type: "CNAME", value: "cognix.example.com" });
    expect(records[1].note).toMatch(/flattens/);
  });

  it("creates unique verification tokens", () => {
    const token = createVerificationToken();
    expect(token).toMatch(/^[0-9a-f]{32}$/);
    expect(token).not.toBe(createVerificationToken());
  });
});

describe("verification", () => {
  const domain = { hostname: "shop.example.com", verificationToken: "abc" };
  const records = dnsRecordsFor(domain, domainTargets(env));

  it("accepts quoted TXT answers", () => {
    expect(matchesVerificationTxt(['"cognix-domain-verification=abc"'], "abc")).toBe(true);
    expect(matchesVerificationTxt(["cognix-domain-verification=other"], "abc")).toBe(false);
  });

  it("accepts a flattened CNAME that resolves to the target addresses", () => {
    const routing = records[1];
    expect(matchesRoutingRecord(routing, { txt: [], cname: [], a: ["203.0.113.10"], targetA: ["203.0.113.10"] })).toBe(true);
    expect(matchesRoutingRecord(routing, { txt: [], cname: [], a: ["198.51.100.4"], targetA: ["203.0.113.10"] })).toBe(false);
  });

  it("marks a domain active only when ownership and routing both resolve", () => {
    const active = evaluateDomainVerification(domain, records, {
      txt: ["cognix-domain-verification=abc"],
      cname: ["apps.cognix.example.com."],
      a: [],
    });
    expect(active).toMatchObject({ status: "active", ownershipVerified: true, routingVerified: true, message: null });
  });

  it("explains which record is still missing", () => {
    const pending = evaluateDomainVerification(domain, records, { txt: [], cname: [], a: [] });
    expect(pending.status).toBe("pending");
    expect(pending.message).toContain(`TXT ${verificationRecordName(domain.hostname)}`);
    expect(pending.message).toContain("CNAME shop.example.com");
    expect(pending.message).toMatch(/check again/);
  });
});
