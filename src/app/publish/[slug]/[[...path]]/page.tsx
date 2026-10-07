import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublishedAppFrame } from "@/components/published-app-frame";
import { getPublishedAppRuntimeUrl } from "@/lib/daytona";
import { publishedFrameUrl, safeAppPath } from "@/lib/publish-url";
import { getPublishedProject } from "@/lib/store";

type Props = {
  params: Promise<{ slug: string; path?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const dynamic = "force-dynamic";
export const maxDuration = 180;

/** Rebuilds the in-app path and query from `/publish/<slug>/<path>?<query>`. */
async function requestedAppPath(params: Props["params"], searchParams: Props["searchParams"]) {
  const [{ path = [] }, query] = await Promise.all([params, searchParams]);
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) search.append(key, item);
  }
  const pathname = `/${path.map((segment) => encodeURIComponent(segment)).join("/")}`;
  const queryString = search.toString();
  return safeAppPath(queryString ? `${pathname}?${queryString}` : pathname);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const project = await getPublishedProject(slug);
  if (!project) return { title: "App unavailable" };
  return {
    title: project.title,
    description: project.description || `Built and published with Cognix.`,
    robots: { index: true, follow: true },
  };
}

export default async function PublishedAppPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const project = await getPublishedProject(slug);
  if (!project) notFound();
  const appPath = await requestedAppPath(params, searchParams);
  const runtimeUrl = await getPublishedAppRuntimeUrl(project).catch(() => null);
  if (!runtimeUrl) {
    return (
      <main className="published-app-error">
        <meta httpEquiv="refresh" content="4" />
        <div>
          <strong>This app is restarting</strong>
          <p>Refresh in a moment. Its saved production release is still available.</p>
          <a href={`/publish/${slug}${appPath === "/" ? "" : appPath}`}>Try again</a>
        </div>
      </main>
    );
  }
  return <PublishedAppFrame title={project.title} runtimeUrl={publishedFrameUrl(runtimeUrl, appPath)} />;
}
