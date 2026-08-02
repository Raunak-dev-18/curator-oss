import { notFound, redirect } from "next/navigation";
import { WorkspaceClient } from "@/components/workspace-client";
import { getViewer } from "@/lib/auth0";
import { ensureUser, getProject, listMessages, listProjectFiles } from "@/lib/store";

type Props = {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ prompt?: string; attachments?: string }>;
};

export default async function ProjectPage({ params, searchParams }: Props) {
  const { projectId } = await params;
  const viewer = await getViewer();
  if (!viewer) redirect(`/auth/login?returnTo=${encodeURIComponent(`/projects/${projectId}`)}`);
  await ensureUser(viewer);
  const project = await getProject(projectId, viewer.id);
  if (!project) notFound();
  const [messages, files, query] = await Promise.all([
    listMessages(project.id),
    listProjectFiles(project.id),
    searchParams,
  ]);

  return (
    <WorkspaceClient
      initialProject={project}
      initialMessages={messages}
      initialFiles={files}
      viewer={viewer}
      initialNow={new Date().toISOString()}
      initialPrompt={query.prompt}
      initialAttachmentIds={query.attachments?.split(",").filter(Boolean)}
    />
  );
}
