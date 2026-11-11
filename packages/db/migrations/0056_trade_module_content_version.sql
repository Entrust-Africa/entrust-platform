CREATE TABLE "trade"."module_content_version" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"module_id" text NOT NULL,
	"version" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"title" text NOT NULL,
	"deliverable" text NOT NULL,
	"objectives" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"content" jsonb NOT NULL,
	"content_hash" text NOT NULL,
	"change_summary" text,
	"created_by_user_id" text,
	"updated_by_user_id" text,
	"submitted_by_user_id" text,
	"submitted_at" timestamp with time zone,
	"approved_by_user_id" text,
	"approved_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "trade"."module_content_version" ADD CONSTRAINT "module_content_version_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "core"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade"."module_content_version" ADD CONSTRAINT "module_content_version_updated_by_user_id_user_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "core"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade"."module_content_version" ADD CONSTRAINT "module_content_version_submitted_by_user_id_user_id_fk" FOREIGN KEY ("submitted_by_user_id") REFERENCES "core"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade"."module_content_version" ADD CONSTRAINT "module_content_version_approved_by_user_id_user_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "core"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "trade_module_content_version_uidx" ON "trade"."module_content_version" USING btree ("module_id","version");--> statement-breakpoint
CREATE INDEX "trade_module_content_version_module_status_idx" ON "trade"."module_content_version" USING btree ("module_id","status");
