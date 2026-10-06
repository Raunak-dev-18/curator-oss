import { z } from "zod";
import { requireViewer } from "@/lib/auth0";
import { deployPublishedApp, stopPublishedApp } from "@/lib/daytona";
import { verifyProjectDomains } from "@/lib/dns";
import { domainView } from "@/lib/domains";
import { errorResponse, notFound } from "@/lib/http";
import { publishedAppUrl } from "@/lib/publish-url";
import {
  createMessage,
  getProject,
  getProjectByPublishSlug,
  listProjectDomains,
  updateProject,
} from "@/lib/store";
import type { Project } from "@/lib/types";

type Context = { params: Promise<{ projectId: string }> };

export const runtime = "nodejs";
export const maxDuration = 900;

declare global {
  var __cognixPublishJobs: Set<string> | undefined;
}

const publishJobs = globalThis.__cognixPublishJobs ?? (globalThis.__cognixPublishJobs = new Set<string>());

const publishSchema = z.object({
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(3)
    .max(48)
    .regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/, "Use lowercase letters, numbers, and single hyphens."),
});

function publishErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Production deployment failed.";
  return [
    "## Publication failed",
    "",
    "Cognix could not finish the production deployment.",
    "",
    "```text",
    message.slice(-4000),
    "```",
    "",
    "Fix the issue above, then publish again.",
  ].join("\n");
}

function startPublishJob(project: Project, slug: string) {
  if (publishJobs.has(project.id)) return;
  publishJobs.add(project.id);
  const previousPublishSlug = project.publishSlug;
  const previousPublishedAt = project.publishedAt;

  void deployPublishedApp(project)
    .then(async () => {
      await updateProject(project.id, project.ownerId, {
        publishSlug: slug,
        publishedAt: new Date().toISOString(),
        status: "published",
      });
      // Attached domains can already have correct DNS, so activate them as part of the deployment.
      await verifyProjectDomains(project.id).catch(() => undefined);
    })
    .catch(async (error) => {
      await Promise.allSettled([
        updateProject(project.id, project.ownerId, {
          publishSlug: previousPublishedAt ? previousPublishSlug : null,
          publishedAt: previousPublishedAt,
          status: "error",
        }),
        createMessage(project.id, "assistant", publishErrorMessage(error), { error: true }),
      ]);
    })
    .finally(() => {
      publishJobs.delete(project.id);
    });
}

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

    if (publishJobs.has(project.id)) {
      return Response.json(
        { project, url: publishedAppUrl(request, slug), publishing: true },
        { status: 202 },
      );
    }

    const queued = await updateProject(project.id, viewer.id, {
      ...(project.publishedAt ? {} : { publishSlug: slug }),
      status: "publishing",
    });
    if (!queued) return notFound();
    startPublishJob(project, slug);
    return Response.json(
      {
        project: queued,
        url: publishedAppUrl(request, slug),
        domains: (await listProjectDomains(project.id)).map(domainView),
        publishing: true,
      },
      { status: 202 },
    );
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
