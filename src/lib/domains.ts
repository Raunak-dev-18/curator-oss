import type { DomainDnsRecord, DomainSetup, ProjectDomain, ProjectDomainView } from "./types";

export const VERIFICATION_PREFIX = "_cognix-challenge";
export const VERIFICATION_VALUE_PREFIX = "cognix-domain-verification=";
export const DEFAULT_RECORD_TTL = 300;
/** Set by the proxy so the domain page only renders for requests that really arrived on that host. */
export const DOMAIN_HOST_HEADER = "x-cognix-domain-host";
/** Set by the proxy so a custom domain deep link opens the same path inside the published app. */
export const DOMAIN_PATH_HEADER = "x-cognix-domain-path";
/**
 * Answered by the Cognix proxy itself on every hostname. Verification fetches it through the customer
 * domain to prove traffic really reaches Cognix, not just that DNS records exist.
 */
export const DOMAIN_PROBE_PATH = "/.well-known/cognix-domain-check";

export function domainProbeBody(hostname: string) {
  return `cognix-domain-check ${hostname}`;
}

const MAX_HOSTNAME_LENGTH = 253;
const LABEL_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

// Special-use and loopback names can never point at a Cognix publication.
const RESERVED_TLDS = new Set(["local", "localhost", "internal", "test", "invalid", "example", "onion", "home", "arpa"]);

// Registrable suffixes that use two labels, so `example.co.uk` is an apex and needs an A record.
const TWO_LABEL_SUFFIXES = new Set([
  "ac.uk",
  "co.at",
  "co.il",
  "co.in",
  "co.jp",
  "co.kr",
  "co.nz",
  "co.uk",
  "co.za",
  "com.ar",
  "com.au",
  "com.br",
  "com.cn",
  "com.mx",
  "com.sg",
  "com.tr",
  "gov.uk",
  "net.au",
  "net.br",
  "org.au",
  "org.uk",
]);

export class DomainRequestError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "DomainRequestError";
    this.status = status;
  }
}

export type DomainTargets = {
  cname: string | null;
  ipv4: string | null;
};

/**
 * The environment values that describe where Cognix lives and where customer domains point:
 * APP_BASE_URL, COGNIX_APP_HOSTS, COGNIX_DOMAIN_CNAME_TARGET, COGNIX_DOMAIN_IPV4,
 * VERCEL_PROJECT_PRODUCTION_URL, and VERCEL_URL.
 */
export type DomainEnv = Record<string, string | undefined>;

function hostnameFromValue(value: string) {
  const trimmed = value.trim().toLowerCase().replace(/\.$/, "");
  if (!trimmed) return "";
  const withoutScheme = trimmed.replace(/^[a-z][a-z0-9+.-]*:\/\//, "");
  const withoutPath = withoutScheme.split("/")[0]?.split("?")[0] ?? "";
  try {
    // `new URL` converts internationalized names to punycode and strips credentials and ports.
    return new URL(`http://${withoutPath}`).hostname.replace(/\.$/, "");
  } catch {
    return "";
  }
}

/** Splits a host header value into a bare hostname, dropping any port. */
export function hostnameFromHeader(value: string | null | undefined) {
  if (!value) return "";
  const first = value.split(",")[0]?.trim() ?? "";
  return hostnameFromValue(first);
}

/** Hosts that serve the Cognix product itself and can never be attached to a project. */
export function appHostnames(env: DomainEnv = process.env) {
  const candidates = [
    env.APP_BASE_URL,
    env.COGNIX_APP_HOSTS,
    env.VERCEL_PROJECT_PRODUCTION_URL,
    env.VERCEL_URL,
    env.COGNIX_DOMAIN_CNAME_TARGET,
  ]
    .filter((value): value is string => Boolean(value?.trim()))
    .flatMap((value) => value.split(","))
    .map((value) => hostnameFromValue(value))
    .filter(Boolean);
  return [...new Set(candidates)];
}

/**
 * Custom domain routing only activates once the product knows its own hostname.
 * Without that, every request would look like an unknown custom domain.
 */
export function isCustomDomainRoutingEnabled(env: DomainEnv = process.env) {
  return appHostnames(env).length > 0;
}

function isLocalHostname(hostname: string) {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]" ||
    hostname === "::1" ||
    hostname.endsWith(".localhost")
  );
}

/** True when the request should be served by the builder instead of a published app. */
export function isAppHostname(hostname: string, env: DomainEnv = process.env) {
  if (!hostname) return true;
  if (isLocalHostname(hostname)) return true;
  if (hostname.endsWith(".vercel.app")) return true;
  return appHostnames(env).some((appHost) => hostname === appHost || hostname.endsWith(`.${appHost}`));
}

export function isIpAddress(value: string) {
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(value)) {
    return value.split(".").every((part) => Number(part) <= 255);
  }
  return value.includes(":");
}

export function registrableSuffix(hostname: string) {
  const labels = hostname.split(".");
  if (labels.length < 2) return hostname;
  const lastTwo = labels.slice(-2).join(".");
  if (TWO_LABEL_SUFFIXES.has(lastTwo) && labels.length >= 3) return labels.slice(-3).join(".");
  return lastTwo;
}

/** Apex (root) domains need an A record because CNAME is not allowed at the zone root. */
export function isApexHostname(hostname: string) {
  return registrableSuffix(hostname) === hostname;
}

/**
 * Normalizes user input into a routable hostname, or throws a message safe to show in the UI.
 */
export function normalizeCustomHostname(input: string, env: DomainEnv = process.env) {
  const raw = input.trim();
  if (!raw) throw new DomainRequestError("Enter the domain you want to use.");
  if (raw.includes("*")) throw new DomainRequestError("Wildcard domains are not supported. Add each hostname you need.");

  const hostname = hostnameFromValue(raw);
  if (!hostname) throw new DomainRequestError("That does not look like a domain name. Use a form like app.example.com.");
  if (hostname.length > MAX_HOSTNAME_LENGTH) throw new DomainRequestError("That domain name is too long.");
  if (isIpAddress(hostname)) throw new DomainRequestError("Use a domain name instead of an IP address.");

  const labels = hostname.split(".");
  if (labels.length < 2) {
    throw new DomainRequestError("Include the full domain, such as app.example.com.");
  }
  for (const label of labels) {
    if (label.length < 1 || label.length > 63 || !LABEL_PATTERN.test(label)) {
      throw new DomainRequestError("Domain labels may use letters, numbers, and inner hyphens only.");
    }
  }

  const tld = labels.at(-1) ?? "";
  if (tld.length < 2 || /^\d+$/.test(tld)) {
    throw new DomainRequestError("That top-level domain is not valid.");
  }
  if (RESERVED_TLDS.has(tld)) {
    throw new DomainRequestError("Reserved and local-only domains cannot be published.");
  }
  if (labels[0] === VERIFICATION_PREFIX) {
    throw new DomainRequestError("Add the domain itself, not its verification record.");
  }
  if (isAppHostname(hostname, env)) {
    throw new DomainRequestError("That hostname already belongs to Cognix. Use a domain you control.");
  }

  return hostname;
}

export function createVerificationToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function verificationRecordName(hostname: string) {
  return `${VERIFICATION_PREFIX}.${hostname}`;
}

export function verificationRecordValue(token: string) {
  return `${VERIFICATION_VALUE_PREFIX}${token}`;
}

/** Reads the routing targets an operator configured for published custom domains. */
export function domainTargets(env: DomainEnv = process.env): DomainTargets {
  const configuredCname = hostnameFromValue(env.COGNIX_DOMAIN_CNAME_TARGET ?? "");
  // localhost, private TLDs, and raw IPs can never be reached from a customer's DNS record.
  const cname = [configuredCname, ...appHostnames(env)].find(isPublicHostname) ?? null;
  const ipv4 = (env.COGNIX_DOMAIN_IPV4 ?? "").trim();
  return {
    cname,
    ipv4: isPublicIpv4(ipv4) ? ipv4 : null,
  };
}

/** True for a hostname the public internet can resolve, so a customer CNAME can point at it. */
export function isPublicHostname(hostname: string) {
  if (!hostname || isLocalHostname(hostname) || isIpAddress(hostname)) return false;
  const labels = hostname.split(".");
  if (labels.length < 2) return false;
  return !RESERVED_TLDS.has(labels.at(-1) ?? "");
}

/** True for an IPv4 address outside loopback, private, link-local, CGNAT, and reserved ranges. */
export function isPublicIpv4(value: string) {
  if (!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(value)) return false;
  const [a, b] = value.split(".").map(Number);
  if (value.split(".").some((part) => Number(part) > 255)) return false;
  if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 168) return false;
  if (a === 100 && b >= 64 && b <= 127) return false;
  return true;
}

/** Describes whether customer domains can be routed here, with a recovery step when they cannot. */
export function domainSetup(env: DomainEnv = process.env): DomainSetup {
  const targets = domainTargets(env);
  if (targets.cname || targets.ipv4) {
    return { ready: true, cname: targets.cname, ipv4: targets.ipv4, message: null };
  }
  const configured = hostnameFromValue(env.COGNIX_DOMAIN_CNAME_TARGET ?? "") || appHostnames(env)[0] || "";
  const reason = configured
    ? `Cognix is running on ${configured}, which the public internet cannot reach.`
    : "Cognix does not know its public address yet.";
  return {
    ready: false,
    cname: null,
    ipv4: null,
    message: `${reason} Deploy Cognix to a public host, then set COGNIX_DOMAIN_CNAME_TARGET (or APP_BASE_URL) to that hostname and restart the server.`,
  };
}

/**
 * The exact DNS records a customer must create for a domain to serve their published app.
 * Without a public routing target only the ownership record is returned.
 */
export function dnsRecordsFor(
  domain: Pick<ProjectDomain, "hostname" | "verificationToken">,
  targets: DomainTargets,
): DomainDnsRecord[] {
  const records: DomainDnsRecord[] = [
    {
      type: "TXT",
      name: verificationRecordName(domain.hostname),
      value: verificationRecordValue(domain.verificationToken),
      ttl: DEFAULT_RECORD_TTL,
      purpose: "verification",
      note: "Proves you control this domain.",
    },
  ];

  const apex = isApexHostname(domain.hostname);
  if (targets.ipv4 && (apex || !targets.cname)) {
    records.push({
      type: "A",
      name: domain.hostname,
      value: targets.ipv4,
      ttl: DEFAULT_RECORD_TTL,
      purpose: "routing",
      note: apex
        ? "Root domains cannot use a CNAME, so they need an A record."
        : "Points visitors at the Cognix server that serves your published app.",
    });
    return records;
  }
  if (!targets.cname) return records;

  records.push({
    type: "CNAME",
    name: domain.hostname,
    value: targets.cname,
    ttl: DEFAULT_RECORD_TTL,
    purpose: "routing",
    note: apex
      ? "Use a provider that flattens CNAME records at the root, or ask your operator for an A record target."
      : "Points visitors at the Cognix edge that serves your published app.",
  });
  return records;
}

export type ResolvedDomainRecords = {
  txt: string[];
  cname: string[];
  a: string[];
  /** Addresses of the routing target, used when a provider flattens CNAME records at the root. */
  targetA?: string[];
};

export function matchesVerificationTxt(values: string[], token: string) {
  const expected = verificationRecordValue(token);
  return values.some((value) => value.trim().replace(/^"|"$/g, "") === expected);
}

function normalizeRecordValue(value: string) {
  return value.trim().toLowerCase().replace(/\.$/, "");
}

export function matchesRoutingRecord(record: DomainDnsRecord, resolved: ResolvedDomainRecords) {
  if (record.type === "A") {
    return resolved.a.some((value) => normalizeRecordValue(value) === normalizeRecordValue(record.value));
  }
  const expected = normalizeRecordValue(record.value);
  if (resolved.cname.some((value) => normalizeRecordValue(value) === expected)) return true;
  const targetAddresses = (resolved.targetA ?? []).map(normalizeRecordValue);
  if (!targetAddresses.length) return false;
  return resolved.a.some((value) => targetAddresses.includes(normalizeRecordValue(value)));
}

export type DomainVerification = {
  status: "active" | "pending";
  ownershipVerified: boolean;
  routingVerified: boolean;
  message: string | null;
};

/** Turns raw DNS answers into the stored status plus recovery copy for the UI. */
export function evaluateDomainVerification(
  domain: Pick<ProjectDomain, "hostname" | "verificationToken">,
  records: DomainDnsRecord[],
  resolved: ResolvedDomainRecords,
): DomainVerification {
  const ownershipVerified = matchesVerificationTxt(resolved.txt, domain.verificationToken);
  const routingRecord = records.find((record) => record.purpose === "routing");
  const routingVerified = routingRecord ? matchesRoutingRecord(routingRecord, resolved) : false;

  if (ownershipVerified && routingVerified) {
    return { status: "active", ownershipVerified, routingVerified, message: null };
  }

  const missing: string[] = [];
  if (!ownershipVerified) missing.push(`TXT ${verificationRecordName(domain.hostname)}`);
  if (!routingVerified && routingRecord) missing.push(`${routingRecord.type} ${routingRecord.name}`);

  return {
    status: "pending",
    ownershipVerified,
    routingVerified,
    message: `DNS is not ready yet. Add or correct ${missing.join(" and ")}, then check again. Changes can take up to an hour to propagate.`,
  };
}

export function domainStatusLabel(domain: Pick<ProjectDomain, "status">) {
  if (domain.status === "active") return "Live";
  if (domain.status === "error") return "Needs attention";
  return "Waiting for DNS";
}

export function customDomainUrl(hostname: string) {
  return `https://${hostname}`;
}

/** Shapes a stored domain for the API and UI, including the records the customer must create. */
export function domainView(domain: ProjectDomain): ProjectDomainView {
  return {
    ...domain,
    records: dnsRecordsFor(domain, domainTargets()),
    url: customDomainUrl(domain.hostname),
  };
}
