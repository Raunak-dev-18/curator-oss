CREATE TABLE "project_cloud" (
	"project_id" uuid PRIMARY KEY NOT NULL,
	"status" text DEFAULT 'disabled' NOT NULL,
	"neon_project_id" text,
	"neon_region" text,
	"storage_enabled" boolean DEFAULT false NOT NULL,
	"app_token_hash" text,
	"auth_enabled" boolean DEFAULT false NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_secrets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"ciphertext" text NOT NULL,
	"iv" text NOT NULL,
	"auth_tag" text NOT NULL,
	"managed_by" text DEFAULT 'user' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_secrets_project_name_unique" UNIQUE("project_id","name")
);
--> statement-breakpoint
ALTER TABLE "project_cloud" ADD CONSTRAINT "project_cloud_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_secrets" ADD CONSTRAINT "project_secrets_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
