import { ensurePreviewUrl } from "@/lib/daytona";
import { requireViewer } from "@/lib/auth0";
import { errorResponse, notFound } from "@/lib/http";
import { getProject, updateProject } from "@/lib/store";

type Context = { params: Promise<{ projectId: string }> };

export const maxDuration = 180;

export async function GET(_request: Request, context: Context) {
  try {
    const viewer = await requireViewer();
    const { projectId } = await context.params;
    const project = await getProject(projectId, viewer.id);
    if (!project) return notFound();
    const url = project.sandboxId ? (await ensurePreviewUrl(project)) ?? project.previewUrl : project.previewUrl;
    if (!url) {
      return Response.json(
        { error: project.sandboxId ? "The preview is still starting. Wait a moment, then refresh it." : "Start a build to create the live preview." },
        { status: 409, headers: { "Cache-Control": "no-store" } },
      );
    }
    const updated = await updateProject(project.id, viewer.id, {
      previewUrl: url,
      status: project.status === "published" || project.status === "publishing" ? project.status : "ready",
    });
    if (!updated) return notFound();
    return Response.json({ url, project: updated }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
