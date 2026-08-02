import { and, asc, desc, eq, ne, sql } from "drizzle-orm";
import { db } from "./db";
import { attachments, messages, projectFiles, projects, users } from "./db/schema";
import type {
  Attachment,
  Message,
  MessageRole,
  Project,
  ProjectFile,
  ProjectStatus,
  Viewer,
} from "./types";
import { titleFromPrompt } from "./utils";

type MemoryStore = {
  projects: Project[];
  messages: Message[];
  files: ProjectFile[];
  attachments: Attachment[];
};

declare global {
  var __cognixMemoryStore: MemoryStore | undefined;
}

const memory =
  globalThis.__cognixMemoryStore ??
  (globalThis.__cognixMemoryStore = {
    projects: [],
    messages: [],
    files: [],
    attachments: [],
  });

function mapProject(row: typeof projects.$inferSelect): Project {
  return {
    id: row.id,
    ownerId: row.ownerId,
    title: row.title,
    description: row.description,
    status: row.status as ProjectStatus,
    coverGradient: row.coverGradient,
    sandboxId: row.sandboxId,
    previewUrl: row.previewUrl,
    publishSlug: row.publishSlug,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapMessage(row: typeof messages.$inferSelect): Message {
  return {
    id: row.id,
    projectId: row.projectId,
    role: row.role as MessageRole,
    content: row.content,
    metadata: row.metadata,
    createdAt: row.createdAt.toISOString(),
  };
}

function mapFile(row: typeof projectFiles.$inferSelect): ProjectFile {
  return {
    id: row.id,
    projectId: row.projectId,
    path: row.path,
    content: row.content,
    size: row.size,
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapAttachment(row: typeof attachments.$inferSelect): Attachment {
  return {
    id: row.id,
    projectId: row.projectId,
    ownerId: row.ownerId,
    name: row.name,
    contentType: row.contentType,
    size: row.size,
    objectKey: row.objectKey,
    sandboxPath: row.sandboxPath,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function ensureUser(viewer: Viewer) {
  if (!db) return;
  await db
    .insert(users)
    .values({
      id: viewer.id,
      email: viewer.email,
      name: viewer.name,
      avatarUrl: viewer.picture,
    })
    .onConflictDoUpdate({
      target: users.id,
      set: {
        email: viewer.email,
        name: viewer.name,
        avatarUrl: viewer.picture,
        updatedAt: new Date(),
      },
    });

  if (!viewer.emailVerified) return;
  const normalizedEmail = viewer.email.trim().toLowerCase();
  const legacyIdentities = await db
    .select({ id: users.id })
    .from(users)
    .where(and(sql`lower(${users.email}) = ${normalizedEmail}`, ne(users.id, viewer.id)));
  for (const identity of legacyIdentities) {
    await db.update(projects).set({ ownerId: viewer.id }).where(eq(projects.ownerId, identity.id));
    await db.update(attachments).set({ ownerId: viewer.id }).where(eq(attachments.ownerId, identity.id));
    await db.delete(users).where(eq(users.id, identity.id));
  }
}

export async function listProjects(ownerId: string): Promise<Project[]> {
  if (!db) {
    return memory.projects
      .filter((project) => project.ownerId === ownerId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
  return (await db.select().from(projects).where(eq(projects.ownerId, ownerId)).orderBy(desc(projects.updatedAt))).map(
    mapProject,
  );
}

export async function getProject(id: string, ownerId: string): Promise<Project | null> {
  if (!db) {
    return memory.projects.find((project) => project.id === id && project.ownerId === ownerId) ?? null;
  }
  const [row] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.ownerId, ownerId)))
    .limit(1);
  return row ? mapProject(row) : null;
}

export async function getProjectByPublishSlug(slug: string): Promise<Project | null> {
  if (!db) {
    return memory.projects.find((project) => project.publishSlug === slug) ?? null;
  }
  const [row] = await db.select().from(projects).where(eq(projects.publishSlug, slug)).limit(1);
  return row ? mapProject(row) : null;
}

export async function getPublishedProject(slug: string): Promise<Project | null> {
  const project = await getProjectByPublishSlug(slug);
  return project?.publishedAt ? project : null;
}

export async function createProject(viewer: Viewer, prompt: string): Promise<Project> {
  await ensureUser(viewer);
  const now = new Date();
  const gradients = ["aurora", "ember", "violet", "cloud"];
  const project: Project = {
    id: crypto.randomUUID(),
    ownerId: viewer.id,
    title: titleFromPrompt(prompt),
    description: prompt.trim().slice(0, 240),
    status: "draft",
    coverGradient: gradients[Math.floor(Math.random() * gradients.length)],
    sandboxId: null,
    previewUrl: null,
    publishSlug: null,
    publishedAt: null,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  if (!db) {
    memory.projects.unshift(project);
    return project;
  }

  const [row] = await db
    .insert(projects)
    .values({
      ownerId: project.ownerId,
      title: project.title,
      description: project.description,
      status: project.status,
      coverGradient: project.coverGradient,
    })
    .returning();
  return mapProject(row);
}

export async function updateProject(
  id: string,
  ownerId: string,
  patch: Partial<
    Pick<
      Project,
      "title" | "description" | "status" | "sandboxId" | "previewUrl" | "publishSlug" | "publishedAt"
    >
  >,
): Promise<Project | null> {
  if (!db) {
    const index = memory.projects.findIndex((project) => project.id === id && project.ownerId === ownerId);
    if (index < 0) return null;
    memory.projects[index] = {
      ...memory.projects[index],
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    return memory.projects[index];
  }

  const { publishedAt, ...databasePatch } = patch;
  const [row] = await db
    .update(projects)
    .set({
      ...databasePatch,
      ...(publishedAt !== undefined
        ? { publishedAt: publishedAt ? new Date(publishedAt) : null }
        : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(projects.id, id), eq(projects.ownerId, ownerId)))
    .returning();
  return row ? mapProject(row) : null;
}

export async function listMessages(projectId: string): Promise<Message[]> {
  if (!db) {
    return memory.messages
      .filter((message) => message.projectId === projectId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }
  return (await db.select().from(messages).where(eq(messages.projectId, projectId)).orderBy(asc(messages.createdAt))).map(
    mapMessage,
  );
}

export async function createMessage(
  projectId: string,
  role: MessageRole,
  content: string,
  metadata: Record<string, unknown> = {},
): Promise<Message> {
  if (!db) {
    const message: Message = {
      id: crypto.randomUUID(),
      projectId,
      role,
      content,
      metadata,
      createdAt: new Date().toISOString(),
    };
    memory.messages.push(message);
    return message;
  }
  const [row] = await db.insert(messages).values({ projectId, role, content, metadata }).returning();
  return mapMessage(row);
}

export async function getMessage(id: string, projectId: string): Promise<Message | null> {
  if (!db) {
    return memory.messages.find((message) => message.id === id && message.projectId === projectId) ?? null;
  }
  const [row] = await db
    .select()
    .from(messages)
    .where(and(eq(messages.id, id), eq(messages.projectId, projectId)))
    .limit(1);
  return row ? mapMessage(row) : null;
}

export async function updateMessageMetadata(
  id: string,
  projectId: string,
  patch: Record<string, unknown>,
): Promise<Message | null> {
  const current = await getMessage(id, projectId);
  if (!current) return null;
  const metadata = { ...current.metadata, ...patch };
  if (!db) {
    const index = memory.messages.findIndex((message) => message.id === id && message.projectId === projectId);
    if (index < 0) return null;
    memory.messages[index] = { ...memory.messages[index], metadata };
    return memory.messages[index];
  }
  const [row] = await db
    .update(messages)
    .set({ metadata })
    .where(and(eq(messages.id, id), eq(messages.projectId, projectId)))
    .returning();
  return row ? mapMessage(row) : null;
}

export async function listProjectFiles(projectId: string): Promise<ProjectFile[]> {
  if (!db) {
    return memory.files.filter((file) => file.projectId === projectId).sort((a, b) => a.path.localeCompare(b.path));
  }
  return (await db.select().from(projectFiles).where(eq(projectFiles.projectId, projectId)).orderBy(asc(projectFiles.path))).map(
    mapFile,
  );
}

export async function upsertProjectFile(projectId: string, path: string, content: string): Promise<ProjectFile> {
  const now = new Date();
  if (!db) {
    const index = memory.files.findIndex((file) => file.projectId === projectId && file.path === path);
    const file: ProjectFile = {
      id: index >= 0 ? memory.files[index].id : crypto.randomUUID(),
      projectId,
      path,
      content,
      size: Buffer.byteLength(content),
      updatedAt: now.toISOString(),
    };
    if (index >= 0) memory.files[index] = file;
    else memory.files.push(file);
    return file;
  }
  const [row] = await db
    .insert(projectFiles)
    .values({ projectId, path, content, size: Buffer.byteLength(content) })
    .onConflictDoUpdate({
      target: [projectFiles.projectId, projectFiles.path],
      set: { content, size: Buffer.byteLength(content), updatedAt: now },
    })
    .returning();
  return mapFile(row);
}

export async function deleteProjectFile(projectId: string, path: string) {
  if (!db) {
    memory.files = memory.files.filter((file) => file.projectId !== projectId || file.path !== path);
    return;
  }
  await db.delete(projectFiles).where(and(eq(projectFiles.projectId, projectId), eq(projectFiles.path, path)));
}

export async function createAttachment(input: Omit<Attachment, "id" | "createdAt">): Promise<Attachment> {
  if (!db) {
    const attachment = { ...input, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    memory.attachments.push(attachment);
    return attachment;
  }
  const [row] = await db.insert(attachments).values(input).returning();
  return mapAttachment(row);
}

export async function getAttachment(id: string, ownerId: string): Promise<Attachment | null> {
  if (!db) {
    return memory.attachments.find((item) => item.id === id && item.ownerId === ownerId) ?? null;
  }
  const [row] = await db
    .select()
    .from(attachments)
    .where(and(eq(attachments.id, id), eq(attachments.ownerId, ownerId)))
    .limit(1);
  return row ? mapAttachment(row) : null;
}

export async function updateAttachmentSandboxPath(id: string, sandboxPath: string): Promise<Attachment | null> {
  if (!db) {
    const index = memory.attachments.findIndex((item) => item.id === id);
    if (index < 0) return null;
    memory.attachments[index] = { ...memory.attachments[index], sandboxPath };
    return memory.attachments[index];
  }
  const [row] = await db.update(attachments).set({ sandboxPath }).where(eq(attachments.id, id)).returning();
  return row ? mapAttachment(row) : null;
}
