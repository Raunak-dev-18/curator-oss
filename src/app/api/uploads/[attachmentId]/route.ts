import { requireViewer } from "@/lib/auth0";
import { errorResponse, notFound } from "@/lib/http";
import { getAttachment } from "@/lib/store";
import { downloadObject } from "@/lib/storage";

export const runtime = "nodejs";
type Context = { params: Promise<{ attachmentId: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const viewer = await requireViewer();
    const { attachmentId } = await context.params;
    const attachment = await getAttachment(attachmentId, viewer.id);
    if (!attachment) return notFound("This upload was not found or you no longer have access.");
    const buffer = await downloadObject(attachment.objectKey);
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": attachment.contentType,
        "Content-Disposition": `inline; filename="${attachment.name.replaceAll('"', "")}"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

