import { z } from "zod";
import { requireViewer } from "@/lib/auth0";
import { errorResponse } from "@/lib/http";
import { createProject, ensureUser, listProjects } from "@/lib/store";

export async function GET() {
  try {
    const viewer = await requireViewer();
    await ensureUser(viewer);
    return Response.json({ projects: await listProjects(viewer.id) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const viewer = await requireViewer();
    const body = z.object({ prompt: z.string().trim().min(3).max(12_000) }).parse(await request.json());
    const project = await createProject(viewer, body.prompt);
    return Response.json({ project }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

