import { getProjectFsRoot, getProjectRoot, getSandbox } from "@/lib/daytona";
import { requireViewer } from "@/lib/auth0";
import { errorResponse, notFound } from "@/lib/http";
import { createAttachment, getProject } from "@/lib/store";
import { uploadObject } from "@/lib/storage";
import { validateUpload } from "@/lib/upload-policy";
import { safeFileName } from "@/lib/utils";

export const runtime = "nodejs";

type Context = { params: Promise<{ projectId: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const viewer = await requireViewer();
    const { projectId } = await context.params;
    const project = await getProject(projectId, viewer.id);
    if (!project) return notFound();
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) return Response.json({ error: "Choose a file to upload." }, { status: 400 });
    const validationError = validateUpload(file);
    if (validationError) return Response.json({ error: validationError }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const name = safeFileName(file.name);
    const uploadId = crypto.randomUUID();
    const sandboxName = `${uploadId}-${name}`;
    const objectKey = `${viewer.id.replaceAll("|", "-")}/${project.id}/${sandboxName}`;
    await uploadObject(objectKey, buffer, file.type);

    let sandboxPath: string | null = null;
    if (project.sandboxId) {
      const sandbox = await getSandbox(project);
      if (sandbox) {
        const root = await getProjectRoot(sandbox);
        const fsRoot = getProjectFsRoot();
        sandboxPath = `${root}/uploads/${sandboxName}`;
        await sandbox.process.executeCommand("mkdir -p uploads", root, undefined, 30);
        await sandbox.fs.uploadFile(buffer, `${fsRoot}/uploads/${sandboxName}`);
      }
    }

    const attachment = await createAttachment({
      projectId: project.id,
      ownerId: viewer.id,
      name,
      contentType: file.type,
      size: file.size,
      objectKey,
      sandboxPath,
    });
    return Response.json({ attachment }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
