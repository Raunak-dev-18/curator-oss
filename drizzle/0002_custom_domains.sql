CREATE TABLE IF NOT EXISTS "project_domains" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "owner_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "hostname" text NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "verification_token" text NOT NULL,
  "managed_by_provider" boolean DEFAULT false NOT NULL,
  "last_error" text,
  "verified_at" timestamp with time zone,
  "last_checked_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "project_domains_hostname_unique" ON "project_domains" ("hostname");
CREATE INDEX IF NOT EXISTS "project_domains_project_idx" ON "project_domains" ("project_id", "created_at");
