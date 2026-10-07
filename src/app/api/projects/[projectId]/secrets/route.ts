import { z } from "zod";
import { requireViewer } from "@/lib/auth0";
import { errorResponse, notFound } from "@/lib/http";
import { getProject, listSecretNames, upsertSecret, deleteSecret } from "@/lib/store";
import { syncProjectEnv } from "@/lib/daytona";

type Context = { params: Promise<{ projectId: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const viewer = await requireViewer();
    const { projectId } = await context.params;
    const project = await getProject(projectId, viewer.id);
    if (!project) return notFound();
    
    const secrets = await listSecretNames(project.id);
    return Response.json({ secrets });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: Request, context: Context) {
  try {
    const viewer = await requireViewer();
    const { projectId } = await context.params;
    const project = await getProject(projectId, viewer.id);
    if (!project) return notFound();
    
    const { name, value } = z
      .object({ 
        name: z.string().regex(/^[A-Z][A-Z0-9_]{0,63}$/, "Invalid secret name"), 
        value: z.string() 
      })
      .parse(await request.json());
      
    const secret = await upsertSecret(project.id, name, value, "user");
    await syncProjectEnv(project);
    
    return Response.json({ secret });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request, context: Context) {
  try {
    const viewer = await requireViewer();
    const { projectId } = await context.params;
    const project = await getProject(projectId, viewer.id);
    if (!project) return notFound();
    
    const { searchParams } = new URL(request.url);
    const name = searchParams.get("name");
    
    if (!name || !/^[A-Z][A-Z0-9_]{0,63}$/.test(name)) {
      return Response.json({ error: "Invalid secret name" }, { status: 400 });
    }
    
    const success = await deleteSecret(project.id, name);
    if (success) {
      await syncProjectEnv(project);
    }
    
    return Response.json({ success });
  } catch (error) {
    return errorResponse(error);
  }
}
