CREATE TABLE "trade"."worksheet_version" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enrollment_id" uuid NOT NULL,
	"worksheet_id" text NOT NULL,
	"module_id" text NOT NULL,
	"version" integer NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"values" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"result" jsonb,
	"confidence" text DEFAULT 'self_reported' NOT NULL,
	"based_on_version_id" uuid,
	"prefilled_from_version_id" uuid,
	"created_by_user_id" text,
	"submitted_by_user_id" text,
	"submitted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "trade"."worksheet_version" ADD CONSTRAINT "worksheet_version_enrollment_id_enrollment_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "trade"."enrollment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade"."worksheet_version" ADD CONSTRAINT "worksheet_version_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "core"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade"."worksheet_version" ADD CONSTRAINT "worksheet_version_submitted_by_user_id_user_id_fk" FOREIGN KEY ("submitted_by_user_id") REFERENCES "core"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "trade_worksheet_version_uidx" ON "trade"."worksheet_version" USING btree ("enrollment_id","worksheet_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "trade_worksheet_version_draft_uidx" ON "trade"."worksheet_version" USING btree ("enrollment_id","worksheet_id") WHERE "trade"."worksheet_version"."status" = 'draft';--> statement-breakpoint
CREATE INDEX "trade_worksheet_version_enrollment_idx" ON "trade"."worksheet_version" USING btree ("enrollment_id");