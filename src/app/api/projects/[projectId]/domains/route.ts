import { z } from "zod";
import { requireViewer } from "@/lib/auth0";
import { provisionDomainDns, verifyProjectDomain } from "@/lib/dns";
import { DomainRequestError, createVerificationToken, domainSetup, domainView, normalizeCustomHostname } from "@/lib/domains";
import { errorResponse, notFound } from "@/lib/http";
import {
  createProjectDomain,
  getProject,
  getProjectDomainByHostname,
  listProjectDomains,
  updateProjectDomain,
} from "@/lib/store";

type Context = { params: Promise<{ projectId: string }> };

export const runtime = "nodejs";

const MAX_DOMAINS_PER_PROJECT = 5;

const addDomainSchema = z.object({ hostname: z.string().trim().min(1).max(255) });

export async function GET(_request: Request, context: Context) {
  try {
    const viewer = await requireViewer();
    const { projectId } = await context.params;
    const project = await getProject(projectId, viewer.id);
    if (!project) return notFound();
    const domains = await listProjectDomains(project.id);
    return Response.json({ domains: domains.map(domainView), setup: domainSetup() });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request, context: Context) {
  try {
    const viewer = await requireViewer();
    const { projectId } = await context.params;
    const project = await getProject(projectId, viewer.id);
    if (!project) return notFound();

    const { hostname: input } = addDomainSchema.parse(await request.json());
    const hostname = normalizeCustomHostname(input);

    const existing = await getProjectDomainByHostname(hostname);
    if (existing) {
      throw new DomainRequestError(
        existing.projectId === project.id
          ? "That domain is already attached to this project."
          : "That domain is already attached to another Cognix project.",
        409,
      );
    }

    const attached = await listProjectDomains(project.id);
    if (attached.length >= MAX_DOMAINS_PER_PROJECT) {
      throw new DomainRequestError(
        `A project can use up to ${MAX_DOMAINS_PER_PROJECT} custom domains. Remove one before adding another.`,
        409,
      );
    }

    let domain = await createProjectDomain({
      projectId: project.id,
      ownerId: viewer.id,
      hostname,
      verificationToken: createVerificationToken(),
    });

    // When the operator connected a DNS provider, create the records instead of asking the customer to.
    const managed = await provisionDomainDns(domain).catch(() => false);
    if (managed) {
      domain = (await updateProjectDomain(domain.id, { managedByProvider: true })) ?? domain;
      domain = await verifyProjectDomain(domain);
    }

    return Response.json({ domain: domainView(domain), managed, setup: domainSetup() }, { status: 201 });
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
    if (code === "23505") {
      return Response.json({ error: "That domain is already attached to a Cognix project." }, { status: 409 });
    }
    return errorResponse(error);
  }
}
