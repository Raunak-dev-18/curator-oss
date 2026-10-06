import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  name: text("name"),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description").default("").notNull(),
    status: text("status").default("draft").notNull(),
    coverGradient: text("cover_gradient").default("aurora").notNull(),
    sandboxId: text("sandbox_id"),
    previewUrl: text("preview_url"),
    publishSlug: text("publish_slug"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("projects_owner_updated_idx").on(table.ownerId, table.updatedAt),
    uniqueIndex("projects_publish_slug_unique").on(table.publishSlug),
  ],
);

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    content: text("content").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("messages_project_created_idx").on(table.projectId, table.createdAt)],
);

export const projectFiles = pgTable(
  "project_files",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    path: text("path").notNull(),
    content: text("content"),
    size: integer("size").default(0).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique("project_files_project_path_unique").on(table.projectId, table.path),
    index("project_files_project_idx").on(table.projectId),
  ],
);

export const attachments = pgTable(
  "attachments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    contentType: text("content_type").notNull(),
    size: integer("size").notNull(),
    objectKey: text("object_key").notNull(),
    sandboxPath: text("sandbox_path"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("attachments_project_idx").on(table.projectId)],
);

export const projectDomains = pgTable(
  "project_domains",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    hostname: text("hostname").notNull(),
    status: text("status").default("pending").notNull(),
    verificationToken: text("verification_token").notNull(),
    managedByProvider: boolean("managed_by_provider").default(false).notNull(),
    lastError: text("last_error"),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("project_domains_hostname_unique").on(table.hostname),
    index("project_domains_project_idx").on(table.projectId, table.createdAt),
  ],
);
