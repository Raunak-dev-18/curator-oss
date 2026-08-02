import { requireViewer } from "@/lib/auth0";
import { ensurePreviewUrl, getProjectFsRoot, getProjectRoot, getSandbox } from "@/lib/daytona";
import { errorResponse, notFound } from "@/lib/http";
import { getProject } from "@/lib/store";
import { ensureVisualEditBridge } from "@/lib/visual-edit-bridge";

type Context = { params: Promise<{ projectId: string }> };

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(_request: Request, context: Context) {
  try {
    const viewer = await requireViewer();
    const { projectId } = await context.params;
    const project = await getProject(projectId, viewer.id);
    if (!project) return notFound();

    const sandbox = await getSandbox(project);
    if (!sandbox) {
      return Response.json({ error: "Build the app before selecting preview elements." }, { status: 409 });
    }

    const root = await getProjectRoot(sandbox);
    const result = await ensureVisualEditBridge(sandbox, root, getProjectFsRoot());
    if (!result.installed) {
      return Response.json(
        { error: "Cognix could not find a Next.js root layout to enable visual selection." },
        { status: 409 },
      );
    }

    const url = await ensurePreviewUrl(project);
    if (!url) {
      return Response.json({ error: "Start or repair the preview before selecting elements." }, { status: 409 });
    }
    return Response.json({ url, changed: result.changed });
  } catch (error) {
    return errorResponse(error);
  }
}
