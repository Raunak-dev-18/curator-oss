import { requireViewer } from "@/lib/auth0";
import { provisionDomainDns, verifyProjectDomain } from "@/lib/dns";
import { domainView } from "@/lib/domains";
import { errorResponse, notFound } from "@/lib/http";
import { getProject, getProjectDomain, updateProjectDomain } from "@/lib/store";

type Context = { params: Promise<{ projectId: string; domainId: string }> };

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(_request: Request, context: Context) {
  try {
    const viewer = await requireViewer();
    const { projectId, domainId } = await context.params;
    const project = await getProject(projectId, viewer.id);
    if (!project) return notFound();
    let domain = await getProjectDomain(domainId, project.id);
    if (!domain) return notFound("That domain is not attached to this project.");

    // Re-create provider records first: an operator-managed zone should self-heal on every check.
    if (domain.managedByProvider) await provisionDomainDns(domain).catch(() => false);

    domain = await verifyProjectDomain(domain);
    if (domain.status === "active" && !project.publishedAt) {
      await updateProjectDomain(domain.id, { lastError: null });
      return Response.json({
        domain: domainView(domain),
        warning: "DNS is ready. Publish this project to start serving it on that domain.",
      });
    }
    return Response.json({ domain: domainView(domain) });
  } catch (error) {
    return errorResponse(error);
  }
}
