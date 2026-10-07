import { describe, expect, it } from "vitest";
import {
  DomainRequestError,
  appHostnames,
  createVerificationToken,
  dnsRecordsFor,
  domainSetup,
  domainTargets,
  evaluateDomainVerification,
  hostnameFromHeader,
  isApexHostname,
  isAppHostname,
  isCustomDomainRoutingEnabled,
  isPublicHostname,
  isPublicIpv4,
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

  it("never offers localhost or private targets and explains how to recover", () => {
    const local = { APP_BASE_URL: "http://localhost:3000", COGNIX_DOMAIN_IPV4: "192.168.1.20" } as DomainEnv;
    expect(domainTargets(local)).toEqual({ cname: null, ipv4: null });
    const records = dnsRecordsFor({ hostname: "ig.raunak.co", verificationToken: "abc" }, domainTargets(local));
    expect(records.map((record) => record.type)).toEqual(["TXT"]);
    const setup = domainSetup(local);
    expect(setup.ready).toBe(false);
    expect(setup.message).toContain("localhost");
    expect(setup.message).toContain("COGNIX_DOMAIN_CNAME_TARGET");
  });

  it("skips an unroutable configured target in favor of a public app host", () => {
    const mixed = { APP_BASE_URL: "https://cognix.example.com", COGNIX_DOMAIN_CNAME_TARGET: "localhost" } as DomainEnv;
    expect(domainTargets(mixed).cname).toBe("cognix.example.com");
    expect(domainSetup(mixed).ready).toBe(true);
  });

  it("routes subdomains with an A record when only an address is configured", () => {
    const ipOnly = domainTargets({ APP_BASE_URL: "http://localhost:3000", COGNIX_DOMAIN_IPV4: "203.0.113.10" } as DomainEnv);
    const records = dnsRecordsFor({ hostname: "ig.raunak.co", verificationToken: "abc" }, ipOnly);
    expect(records[1]).toMatchObject({ type: "A", value: "203.0.113.10" });
  });

  it("classifies public and private IPv4 addresses", () => {
    for (const value of ["203.0.113.10", "8.8.8.8"]) expect(isPublicIpv4(value), value).toBe(true);
    for (const value of ["127.0.0.1", "10.0.0.4", "172.20.1.1", "192.168.0.1", "169.254.1.1", "100.64.0.1", "0.0.0.0", "256.1.1.1", ""]) {
      expect(isPublicIpv4(value), value).toBe(false);
    }
    expect(isPublicHostname("cognix.example.com")).toBe(true);
    expect(isPublicHostname("localhost")).toBe(false);
    expect(isPublicHostname("app.internal")).toBe(false);
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
