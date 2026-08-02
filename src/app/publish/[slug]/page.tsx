import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublishedAppFrame } from "@/components/published-app-frame";
import { getPublishedAppRuntimeUrl } from "@/lib/daytona";
import { getPublishedProject } from "@/lib/store";

type Props = { params: Promise<{ slug: string }> };

export const dynamic = "force-dynamic";
export const maxDuration = 180;

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

export default async function PublishedAppPage({ params }: Props) {
  const { slug } = await params;
  const project = await getPublishedProject(slug);
  if (!project) notFound();
  const runtimeUrl = await getPublishedAppRuntimeUrl(project).catch(() => null);
  if (!runtimeUrl) {
    return (
      <main className="published-app-error">
        <div>
          <strong>This app is restarting</strong>
          <p>Refresh in a moment. Its saved production release is still available.</p>
          <a href={`/publish/${slug}`}>Try again</a>
        </div>
      </main>
    );
  }
  return <PublishedAppFrame title={project.title} runtimeUrl={runtimeUrl} />;
}
