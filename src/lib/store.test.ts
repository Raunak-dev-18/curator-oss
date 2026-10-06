import { beforeEach, describe, expect, it, vi } from "vitest";

// Forces the in-memory development store so this test never touches a real database.
vi.mock("./db", () => ({ db: null, isDatabaseConfigured: false }));

const { createProject, createProjectDomain, getPublishedProjectByHostname, updateProject, updateProjectDomain } =
  await import("./store");

const viewer = { id: "owner-1", email: "owner@example.com", emailVerified: true, name: "Owner" };

async function publishedProject() {
  const project = await createProject(viewer, "A notes app");
  const updated = await updateProject(project.id, viewer.id, {
    publishSlug: "notes-app",
    publishedAt: new Date().toISOString(),
    status: "published",
  });
  return updated ?? project;
}

describe("serving a published project on a custom hostname", () => {
  beforeEach(() => {
    globalThis.__cognixMemoryStore = { projects: [], messages: [], files: [], attachments: [], domains: [] };
  });

  it("returns nothing for a hostname that was never attached", async () => {
    await publishedProject();
    await expect(getPublishedProjectByHostname("unknown.example.com")).resolves.toBeNull();
  });

  it("returns nothing while the domain is still waiting for DNS", async () => {
    const project = await publishedProject();
    await createProjectDomain({
      projectId: project.id,
      ownerId: viewer.id,
      hostname: "pending.example.com",
      verificationToken: "abc",
    });
    await expect(getPublishedProjectByHostname("pending.example.com")).resolves.toBeNull();
  });

  it("returns nothing when the project is no longer published", async () => {
    const project = await publishedProject();
    const domain = await createProjectDomain({
      projectId: project.id,
      ownerId: viewer.id,
      hostname: "unpublished.example.com",
      verificationToken: "abc",
    });
    await updateProjectDomain(domain.id, { status: "active", verifiedAt: new Date().toISOString() });
    await updateProject(project.id, viewer.id, { publishedAt: null, status: "ready" });
    await expect(getPublishedProjectByHostname("unpublished.example.com")).resolves.toBeNull();
  });

  it("returns the project for a live domain on a published project", async () => {
    const project = await publishedProject();
    const domain = await createProjectDomain({
      projectId: project.id,
      ownerId: viewer.id,
      hostname: "live.example.com",
      verificationToken: "abc",
    });
    await updateProjectDomain(domain.id, { status: "active", verifiedAt: new Date().toISOString() });

    const published = await getPublishedProjectByHostname("live.example.com");
    expect(published?.project.id).toBe(project.id);
    expect(published?.domain.hostname).toBe("live.example.com");
  });
});
