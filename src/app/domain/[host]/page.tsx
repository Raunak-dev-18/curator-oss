import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { PublishedAppFrame } from "@/components/published-app-frame";
import { getPublishedAppRuntimeUrl } from "@/lib/daytona";
import { DOMAIN_HOST_HEADER, DOMAIN_PATH_HEADER, customDomainUrl, hostnameFromHeader } from "@/lib/domains";
import { publishedFrameUrl, safeAppPath } from "@/lib/publish-url";
import { getPublishedProjectByHostname } from "@/lib/store";

type Props = { params: Promise<{ host: string }> };

export const dynamic = "force-dynamic";
export const maxDuration = 180;

/**
 * Only the proxy may render this route, and only for the host the visitor actually used.
 * That keeps `/domain/<anything>` from being browsable on the product's own hostname.
 */
async function resolveRequest(params: Props["params"]) {
  const [{ host }, headerList] = await Promise.all([params, headers()]);
  const routedHost = hostnameFromHeader(headerList.get(DOMAIN_HOST_HEADER));
  const requestedHost = hostnameFromHeader(decodeURIComponent(host));
  if (!routedHost || routedHost !== requestedHost) return null;
  return { host: routedHost, path: safeAppPath(headerList.get(DOMAIN_PATH_HEADER)) };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const resolved = await resolveRequest(params);
  const published = resolved ? await getPublishedProjectByHostname(resolved.host) : null;
  if (!published || !resolved) return { title: "App unavailable" };
  return {
    title: published.project.title,
    description: published.project.description || "Built and published with Cognix.",
    robots: { index: true, follow: true },
    alternates: { canonical: `${customDomainUrl(resolved.host)}${resolved.path === "/" ? "" : resolved.path}` },
  };
}

export default async function CustomDomainPage({ params }: Props) {
  const resolved = await resolveRequest(params);
  if (!resolved) notFound();
  const published = await getPublishedProjectByHostname(resolved.host);
  if (!published) notFound();

  const runtimeUrl = await getPublishedAppRuntimeUrl(published.project).catch(() => null);
  if (!runtimeUrl) {
    return (
      <main className="published-app-error">
        <meta httpEquiv="refresh" content="4" />
        <div>
          <strong>This app is restarting</strong>
          <p>Refresh in a moment. Its saved production release is still available.</p>
          <a href={`${customDomainUrl(resolved.host)}${resolved.path}`}>Try again</a>
        </div>
      </main>
    );
  }
  return (
    <PublishedAppFrame title={published.project.title} runtimeUrl={publishedFrameUrl(runtimeUrl, resolved.path)} />
  );
}
