ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "publish_slug" text;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "published_at" timestamp with time zone;

CREATE UNIQUE INDEX IF NOT EXISTS "projects_publish_slug_unique"
  ON "projects" ("publish_slug");
