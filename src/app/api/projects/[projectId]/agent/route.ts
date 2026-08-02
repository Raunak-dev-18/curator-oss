import { z } from "zod";
import { requireViewer } from "@/lib/auth0";
import { runAgent } from "@/lib/ai/runner";
import { errorResponse, notFound } from "@/lib/http";
import { createMessage, getAttachment, getProject, listMessages, updateProject } from "@/lib/store";
import type { AgentEvent, Attachment } from "@/lib/types";
import { visualSelectionsSchema } from "@/lib/visual-edit";

export const runtime = "nodejs";
export const maxDuration = 900;

type Context = { params: Promise<{ projectId: string }> };

function agentErrorMessage(error: unknown) {
  const status = typeof error === "object" && error && "status" in error ? Number(error.status) : undefined;
  if (status === 401) return "The model provider rejected the API key. Update OPENAI_API_KEY and try again.";
  if (status === 403) return "The model provider blocked the request. Check the endpoint access policy and try again.";
  if (status === 429) return "The model provider rate limit was reached. Wait a moment, then try again.";
  const message = error instanceof Error ? error.message : "";
  if (/development server did not start|dependency installation failed|trying to use TypeScript/i.test(message)) {
    return "The generated preview could not start, but your files were saved. Ask Cognix to repair the preview and it will inspect the existing app and continue.";
  }
  if (/controller is already closed/i.test(message)) {
    return "The browser disconnected while Cognix was responding. Your saved files are intact; send the next instruction to continue.";
  }
  return message || "The build paused unexpectedly. Try again.";
}

export async function POST(request: Request, context: Context) {
  try {
    const viewer = await requireViewer();
    const { projectId } = await context.params;
    const project = await getProject(projectId, viewer.id);
    if (!project) return notFound();
    const body = z
      .object({
        prompt: z.string().trim().min(1).max(40_000),
        attachmentIds: z
          .array(z.string().uuid())
          .max(10)
          .optional()
          .default([]),
        visualSelections: visualSelectionsSchema.optional().default([]),
      })
      .parse(await request.json());

    const history = await listMessages(project.id);
    const requestedAttachmentIds = [...new Set(body.attachmentIds)];
    const resolvedAttachments = (
      await Promise.all(requestedAttachmentIds.map((id) => getAttachment(id, viewer.id)))
    ).filter((attachment): attachment is Attachment => attachment?.projectId === project.id);
    if (resolvedAttachments.length !== requestedAttachmentIds.length) {
      return Response.json(
        { error: "One or more attachments are unavailable. Remove them, upload again, and resend the prompt." },
        { status: 400 },
      );
    }
    await createMessage(project.id, "user", body.prompt, {
      attachmentIds: resolvedAttachments.map((item) => item.id),
      attachments: resolvedAttachments.map((item) => ({
        id: item.id,
        name: item.name,
        contentType: item.contentType,
        size: item.size,
      })),
      visualSelections: body.visualSelections,
    });

    const encoder = new TextEncoder();
    let streamOpen = true;
    const stream = new ReadableStream({
      start(controller) {
        const emit = (event: AgentEvent) => {
          if (!streamOpen) return;
          try {
            controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
          } catch {
            streamOpen = false;
          }
        };

        void runAgent({
          project,
          prompt: body.prompt,
          history,
          attachments: resolvedAttachments,
          visualSelections: body.visualSelections,
          emit,
        })
          .catch(async (error) => {
            const message = agentErrorMessage(error);
            await Promise.allSettled([
              updateProject(project.id, viewer.id, { status: "error" }),
              createMessage(project.id, "assistant", message, { error: true }),
            ]);
            emit({ type: "error", message });
          })
          .finally(() => {
            if (!streamOpen) return;
            streamOpen = false;
            try {
              controller.close();
            } catch {
              // The browser may have disconnected while the sandbox kept building.
            }
          });
      },
      cancel() {
        streamOpen = false;
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
