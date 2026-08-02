import { requireViewer } from "@/lib/auth0";
import { getProjectFsRoot, getProjectRoot, getSandbox } from "@/lib/daytona";
import { errorResponse, notFound } from "@/lib/http";
import { getProject } from "@/lib/store";
import { safeFileName } from "@/lib/utils";

export const runtime = "nodejs";
export const maxDuration = 180;

type Context = { params: Promise<{ projectId: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const viewer = await requireViewer();
    const { projectId } = await context.params;
    const project = await getProject(projectId, viewer.id);
    if (!project) return notFound();
    const sandbox = await getSandbox(project);
    if (!sandbox) {
      return Response.json({ error: "Build the project before downloading its workspace." }, { status: 409 });
    }

    const root = await getProjectRoot(sandbox);
    const archiveName = `.cognix-export-${project.id}.tar.gz`;
    const result = await sandbox.process.executeCommand(
      `tar --exclude='./node_modules' --exclude='./.next' --exclude='./.git' --exclude='./${archiveName}' --exclude='./.env*' --exclude='*.log' -czf '${archiveName}' .`,
      root,
      undefined,
      150,
    );
    if (result.exitCode !== 0) {
      throw new Error(`The project archive could not be created:\n${result.result.slice(-2000)}`);
    }

    const remotePath = `${getProjectFsRoot()}/${archiveName}`;
    try {
      const archive = await sandbox.fs.downloadFile(remotePath);
      const downloadName = `${safeFileName(project.title || "cognix-project")}.tar.gz`;
      return new Response(new Uint8Array(archive), {
        headers: {
          "Content-Type": "application/gzip",
          "Content-Disposition": `attachment; filename="${downloadName}"`,
          "Content-Length": String(archive.length),
          "Cache-Control": "private, no-store",
        },
      });
    } finally {
      await sandbox.fs.deleteFile(remotePath).catch(() => undefined);
    }
  } catch (error) {
    return errorResponse(error);
  }
}
