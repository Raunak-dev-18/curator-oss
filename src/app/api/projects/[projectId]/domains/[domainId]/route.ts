import { requireViewer } from "@/lib/auth0";
import { removeDomainDns } from "@/lib/dns";
import { domainView } from "@/lib/domains";
import { errorResponse, notFound } from "@/lib/http";
import { deleteProjectDomain, getProject, getProjectDomain } from "@/lib/store";

type Context = { params: Promise<{ projectId: string; domainId: string }> };

export const runtime = "nodejs";

export async function DELETE(_request: Request, context: Context) {
  try {
    const viewer = await requireViewer();
    const { projectId, domainId } = await context.params;
    const project = await getProject(projectId, viewer.id);
    if (!project) return notFound();
    const domain = await getProjectDomain(domainId, project.id);
    if (!domain) return notFound("That domain is not attached to this project.");

    if (domain.managedByProvider) {
      // Detaching must succeed even when the provider call fails, so the failure is not fatal.
      await removeDomainDns(domain).catch(() => false);
    }
    const removed = await deleteProjectDomain(domain.id, project.id);
    if (!removed) return notFound("That domain is not attached to this project.");

    return Response.json({ domain: domainView(domain), removed: true });
  } catch (error) {
    return errorResponse(error);
  }
}
