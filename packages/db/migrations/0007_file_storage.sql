CREATE TABLE "core"."file" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"uploader_user_id" text,
	"storage_key" text NOT NULL,
	"original_name" text NOT NULL,
	"content_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"sha256" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "file_storage_key_unique" UNIQUE("storage_key")
);
--> statement-breakpoint
ALTER TABLE "core"."file" ADD CONSTRAINT "file_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "core"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."file" ADD CONSTRAINT "file_uploader_user_id_user_id_fk" FOREIGN KEY ("uploader_user_id") REFERENCES "core"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "file_org_idx" ON "core"."file" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "file_uploader_idx" ON "core"."file" USING btree ("uploader_user_id");