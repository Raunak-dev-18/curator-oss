import { z } from "zod";
import { requireViewer } from "@/lib/auth0";
import { errorResponse, notFound } from "@/lib/http";
import { getProject, listMessages, updateProject } from "@/lib/store";

type Context = { params: Promise<{ projectId: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const viewer = await requireViewer();
    const { projectId } = await context.params;
    const project = await getProject(projectId, viewer.id);
    if (!project) return notFound();
    return Response.json({ project, messages: await listMessages(project.id) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request, context: Context) {
  try {
    const viewer = await requireViewer();
    const { projectId } = await context.params;
    const patch = z
      .object({ title: z.string().trim().min(1).max(120).optional(), description: z.string().max(500).optional() })
      .parse(await request.json());
    const project = await updateProject(projectId, viewer.id, patch);
    if (!project) return notFound();
    return Response.json({ project });
  } catch (error) {
    return errorResponse(error);
  }
}

