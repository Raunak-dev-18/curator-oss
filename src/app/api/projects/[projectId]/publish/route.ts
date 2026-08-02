import { z } from "zod";
import { requireViewer } from "@/lib/auth0";
import { deployPublishedApp, stopPublishedApp } from "@/lib/daytona";
import { errorResponse, notFound } from "@/lib/http";
import { publishedAppUrl } from "@/lib/publish-url";
import { getProject, getProjectByPublishSlug, updateProject } from "@/lib/store";

type Context = { params: Promise<{ projectId: string }> };

export const runtime = "nodejs";
export const maxDuration = 900;

const publishSchema = z.object({
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(3)
    .max(48)
    .regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/, "Use lowercase letters, numbers, and single hyphens."),
});

export async function POST(request: Request, context: Context) {
  try {
    const viewer = await requireViewer();
    const { projectId } = await context.params;
    const project = await getProject(projectId, viewer.id);
    if (!project) return notFound();
    if (!project.sandboxId) {
      return Response.json({ error: "Build the app successfully before publishing it." }, { status: 409 });
    }
    const { slug } = publishSchema.parse(await request.json());
    const existing = await getProjectByPublishSlug(slug);
    if (existing && existing.id !== project.id) {
      return Response.json({ error: "That address is already taken. Choose another slug." }, { status: 409 });
    }

    await deployPublishedApp(project);
    const publishedAt = new Date().toISOString();
    const updated = await updateProject(project.id, viewer.id, {
      publishSlug: slug,
      publishedAt,
      status: "published",
    });
    if (!updated) return notFound();
    return Response.json({ project: updated, url: publishedAppUrl(request, slug) });
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
    if (code === "23505") {
      return Response.json({ error: "That address is already taken. Choose another slug." }, { status: 409 });
    }
    return errorResponse(error);
  }
}

export async function DELETE(request: Request, context: Context) {
  try {
    const viewer = await requireViewer();
    const { projectId } = await context.params;
    const project = await getProject(projectId, viewer.id);
    if (!project) return notFound();
    await stopPublishedApp(project);
    const updated = await updateProject(project.id, viewer.id, {
      publishedAt: null,
      status: project.previewUrl ? "ready" : "draft",
    });
    if (!updated) return notFound();
    return Response.json({
      project: updated,
      unpublishedUrl: project.publishSlug ? publishedAppUrl(request, project.publishSlug) : null,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
