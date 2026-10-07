import { getProjectRoot, getSandbox } from "@/lib/daytona";
import { executeAgentTool } from "@/lib/ai/tools";
import { requireViewer } from "@/lib/auth0";
import { errorResponse, notFound } from "@/lib/http";
import { getProject, listProjectFiles, upsertProjectFile } from "@/lib/store";
import { z } from "zod";

export const runtime = "nodejs";
type Context = { params: Promise<{ projectId: string }> };

export async function GET(request: Request, context: Context) {
  try {
    const viewer = await requireViewer();
    const { projectId } = await context.params;
    const project = await getProject(projectId, viewer.id);
    if (!project) return notFound();
    const requestedPath = new URL(request.url).searchParams.get("path");
    const storedFiles = await listProjectFiles(project.id);

    if (requestedPath && project.sandboxId) {
      const sandbox = await getSandbox(project);
      if (sandbox) {
        const root = await getProjectRoot(sandbox);
        const normalized = requestedPath.replaceAll("\\", "/").replace(/^\/+/, "");
        if (normalized.split("/").includes("..") || normalized.split("/").some(p => p.startsWith(".env"))) return Response.json({ error: "Invalid file path." }, { status: 400 });
        const content = (await sandbox.fs.downloadFile(`${root}/${normalized}`)).toString("utf8");
        const file = await upsertProjectFile(project.id, normalized, content);
        return Response.json({ file });
      }
    }

    return Response.json({ files: storedFiles });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request, context: Context) {
  try {
    const viewer = await requireViewer();
    const { projectId } = await context.params;
    const project = await getProject(projectId, viewer.id);
    if (!project) return notFound();
    const body = z.object({ path: z.string().min(1).max(500), content: z.string().max(1_000_000) }).parse(await request.json());
    if (project.sandboxId) {
      const sandbox = await getSandbox(project);
      if (sandbox) await executeAgentTool(project, sandbox, "write_file", body);
    }
    const file = await upsertProjectFile(project.id, body.path, body.content);
    return Response.json({ file });
  } catch (error) {
    return errorResponse(error);
  }
}

