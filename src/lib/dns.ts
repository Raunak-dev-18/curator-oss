import {
  DOMAIN_PROBE_PATH,
  dnsRecordsFor,
  domainProbeBody,
  domainSetup,
  domainTargets,
  evaluateDomainVerification,
  isApexHostname,
  verificationRecordName,
  type ResolvedDomainRecords,
} from "./domains";
import { listProjectDomains, updateProjectDomain } from "./store";
import type { DomainDnsRecord, DomainRecordType, ProjectDomain } from "./types";

const DOH_ENDPOINT = "https://cloudflare-dns.com/dns-query";
const DOH_TIMEOUT_MS = 6_000;
const CLOUDFLARE_API = "https://api.cloudflare.com/client/v4";

type DohAnswer = { name: string; type: number; TTL?: number; data: string };
type DohResponse = { Status?: number; Answer?: DohAnswer[] };

const RECORD_TYPE_CODES: Record<DomainRecordType, number> = { A: 1, CNAME: 5, TXT: 16 };

/** Extracts the answers that match the requested type and unquotes TXT strings. */
export function parseDohAnswers(payload: DohResponse, type: DomainRecordType) {
  const code = RECORD_TYPE_CODES[type];
  return (payload.Answer ?? [])
    .filter((answer) => answer.type === code)
    .map((answer) => {
      const data = answer.data.trim();
      if (type !== "TXT") return data.replace(/\.$/, "");
      // A long TXT record arrives as several quoted strings that must be joined.
      const chunks = data.match(/"([^"]*)"/g);
      return chunks ? chunks.map((chunk) => chunk.slice(1, -1)).join("") : data;
    })
    .filter(Boolean);
}

export async function resolveDnsRecords(hostname: string, type: DomainRecordType): Promise<string[]> {
  const url = new URL(DOH_ENDPOINT);
  url.searchParams.set("name", hostname);
  url.searchParams.set("type", type);
  const response = await fetch(url, {
    cache: "no-store",
    headers: { accept: "application/dns-json" },
    signal: AbortSignal.timeout(DOH_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error("Public DNS lookup failed. Try checking this domain again in a moment.");
  return parseDohAnswers((await response.json()) as DohResponse, type);
}

async function safeResolve(hostname: string, type: DomainRecordType) {
  return resolveDnsRecords(hostname, type).catch(() => [] as string[]);
}

/** Reads every record needed to decide whether a custom domain is ready to serve traffic. */
export async function resolveDomainRecords(
  domain: Pick<ProjectDomain, "hostname">,
  routingTarget: string | null,
): Promise<ResolvedDomainRecords> {
  const [txt, cname, a, targetA] = await Promise.all([
    safeResolve(verificationRecordName(domain.hostname), "TXT"),
    safeResolve(domain.hostname, "CNAME"),
    safeResolve(domain.hostname, "A"),
    routingTarget && !isApexHostname(routingTarget) ? safeResolve(routingTarget, "A") : Promise.resolve([]),
  ]);
  return { txt, cname, a, targetA };
}

/**
 * Checks DNS for one attached domain and stores the outcome.
 * Returns the updated domain so callers can render the new status.
 */
export async function verifyProjectDomain(domain: ProjectDomain): Promise<ProjectDomain> {
  const targets = domainTargets();
  const records = dnsRecordsFor(domain, targets);
  const routingRecord = records.find((record) => record.purpose === "routing");
  const checkedAt = new Date().toISOString();

  if (!targets.cname && !targets.ipv4) {
    return (
      (await updateProjectDomain(domain.id, {
        status: "error",
        lastError: domainSetup().message,
        lastCheckedAt: checkedAt,
      })) ?? domain
    );
  }

  let resolved: ResolvedDomainRecords;
  try {
    resolved = await resolveDomainRecords(domain, routingRecord?.type === "CNAME" ? routingRecord.value : null);
  } catch (error) {
    return (
      (await updateProjectDomain(domain.id, {
        status: "error",
        lastError: error instanceof Error ? error.message : "The DNS lookup failed. Check this domain again in a moment.",
        lastCheckedAt: checkedAt,
      })) ?? domain
    );
  }

  const result = evaluateDomainVerification(domain, records, resolved);
  if (result.status === "active") {
    // Correct DNS is not enough: the hosting proxy in front of Cognix must also accept this hostname.
    const serving = await probeDomainServing(domain.hostname, routingRecord?.value ?? null);
    if (!serving.ok && !(serving.transient && domain.status === "active")) {
      return (
        (await updateProjectDomain(domain.id, {
          status: "error",
          lastError: serving.message,
          lastCheckedAt: checkedAt,
          verifiedAt: null,
        })) ?? domain
      );
    }
  }
  return (
    (await updateProjectDomain(domain.id, {
      status: result.status,
      lastError: result.message,
      lastCheckedAt: checkedAt,
      verifiedAt: result.status === "active" ? (domain.verifiedAt ?? checkedAt) : null,
    })) ?? domain
  );
}

/**
 * Re-checks every domain attached to a project. Used after a deployment so a domain whose DNS
 * was already correct starts serving without the customer pressing check again.
 */
export async function verifyProjectDomains(projectId: string) {
  const domains = await listProjectDomains(projectId);
  return Promise.all(domains.map((domain) => verifyProjectDomain(domain).catch(() => domain)));
}

export const isDnsProviderConfigured = Boolean(process.env.CLOUDFLARE_API_TOKEN);

const PROBE_TIMEOUT_MS = 8_000;

export type ServingProbe = {
  ok: boolean;
  /** True when the probe could not reach anything, so a previously live domain is not downgraded. */
  transient: boolean;
  message: string | null;
};

async function fetchProbe(url: string) {
  const response = await fetch(url, {
    cache: "no-store",
    redirect: "manual",
    signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    headers: { accept: "text/plain" },
  });
  const body = (await response.text().catch(() => "")).trim();
  return { status: response.status, body };
}

/**
 * Requests the Cognix probe path through the customer hostname. A different answer means DNS points at
 * the right edge, but the reverse proxy there (Traefik, Caddy, Vercel, …) has no route for this hostname.
 */
export async function probeDomainServing(hostname: string, routingTarget: string | null): Promise<ServingProbe> {
  const expected = domainProbeBody(hostname);
  const target = routingTarget ?? "the Cognix server";
  const fixHosting = `Add ${hostname} as a domain of the Cognix app on your hosting platform (for example the app's domain list in Dokploy, Coolify, or Vercel, or a catch-all Host rule in Traefik/Caddy) and make sure it issues TLS for it, then check again.`;

  try {
    const https = await fetchProbe(`https://${hostname}${DOMAIN_PROBE_PATH}`);
    if (https.status === 200 && https.body === expected) return { ok: true, transient: false, message: null };
    const detail = https.body === "no available server"
      ? "the reverse proxy answered “no available server” (HTTP 503)"
      : `it answered HTTP ${https.status} from something other than Cognix`;
    return {
      ok: false,
      transient: false,
      message: `DNS is correct, but ${hostname} does not reach Cognix yet: ${detail}. ${fixHosting}`,
    };
  } catch {
    // HTTPS failed outright. Plain HTTP tells a missing certificate apart from an unreachable host.
  }

  try {
    const http = await fetchProbe(`http://${hostname}${DOMAIN_PROBE_PATH}`);
    if (http.status === 200 && http.body === expected) {
      return {
        ok: false,
        transient: false,
        message: `${hostname} reaches Cognix over HTTP, but HTTPS failed. Issue a TLS certificate for ${hostname} on your hosting platform, then check again.`,
      };
    }
  } catch {
    // Fall through to the unreachable message.
  }

  return {
    ok: false,
    transient: true,
    message: `DNS is correct, but https://${hostname} could not be reached through ${target}. ${fixHosting}`,
  };
}
type CloudflareResult<T> = { success: boolean; errors?: { message: string }[]; result?: T };

async function cloudflareRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!token) throw new Error("Automatic DNS management is not enabled on this deployment.");
  const response = await fetch(`${CLOUDFLARE_API}${path}`, {
    ...init,
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
    headers: {
      ...init.headers,
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
  });
  const payload = (await response.json().catch(() => ({}))) as CloudflareResult<T>;
  if (!response.ok || !payload.success) {
    const message = payload.errors?.map((item) => item.message).join(" ") || "The DNS provider rejected the request.";
    throw new Error(message);
  }
  return payload.result as T;
}

/** Finds the managed zone that owns a hostname by walking up its labels. */
async function findZone(hostname: string) {
  const labels = hostname.split(".");
  for (let index = 0; index < labels.length - 1; index += 1) {
    const candidate = labels.slice(index).join(".");
    const zones = await cloudflareRequest<{ id: string; name: string }[]>(
      `/zones?name=${encodeURIComponent(candidate)}&status=active`,
    );
    if (zones?.length) return zones[0];
  }
  return null;
}

async function findRecord(zoneId: string, record: DomainDnsRecord) {
  const existing = await cloudflareRequest<{ id: string; content: string }[]>(
    `/zones/${zoneId}/dns_records?type=${record.type}&name=${encodeURIComponent(record.name)}`,
  );
  return existing?.[0] ?? null;
}

function recordBody(record: DomainDnsRecord) {
  return JSON.stringify({
    type: record.type,
    name: record.name,
    content: record.value,
    ttl: record.ttl,
    ...(record.type === "CNAME" ? { proxied: false } : {}),
  });
}

/**
 * Creates or updates the verification and routing records in the operator's DNS provider.
 * Returns false when no provider is configured so callers can fall back to manual instructions.
 */
export async function provisionDomainDns(domain: Pick<ProjectDomain, "hostname" | "verificationToken">) {
  if (!isDnsProviderConfigured) return false;
  const zone = await findZone(domain.hostname);
  if (!zone) return false;
  const records = dnsRecordsFor(domain, domainTargets());
  for (const record of records) {
    const existing = await findRecord(zone.id, record);
    if (existing?.content === record.value) continue;
    if (existing) {
      await cloudflareRequest(`/zones/${zone.id}/dns_records/${existing.id}`, {
        method: "PUT",
        body: recordBody(record),
      });
      continue;
    }
    await cloudflareRequest(`/zones/${zone.id}/dns_records`, { method: "POST", body: recordBody(record) });
  }
  return true;
}

/** Removes the records Cognix created for a domain. Failures are ignored: detaching must still succeed. */
export async function removeDomainDns(domain: Pick<ProjectDomain, "hostname" | "verificationToken">) {
  if (!isDnsProviderConfigured) return false;
  const zone = await findZone(domain.hostname).catch(() => null);
  if (!zone) return false;
  for (const record of dnsRecordsFor(domain, domainTargets())) {
    const existing = await findRecord(zone.id, record).catch(() => null);
    if (!existing) continue;
    await cloudflareRequest(`/zones/${zone.id}/dns_records/${existing.id}`, { method: "DELETE" }).catch(() => null);
  }
  return true;
}
