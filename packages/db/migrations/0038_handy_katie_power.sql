CREATE TABLE "trade"."certificate" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enrollment_id" uuid NOT NULL,
	"code" text NOT NULL,
	"recipient_name" text NOT NULL,
	"recipient_organization_name" text NOT NULL,
	"program_name" text NOT NULL,
	"cohort_name" text NOT NULL,
	"pathway" text NOT NULL,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	"revoked_by_user_id" text,
	"revocation_reason" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "certificate_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "trade"."module_progress" ADD COLUMN "admin_override_by_user_id" text;--> statement-breakpoint
ALTER TABLE "trade"."module_progress" ADD COLUMN "admin_override_reason" text;--> statement-breakpoint
ALTER TABLE "trade"."module_progress" ADD COLUMN "admin_override_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "trade"."certificate" ADD CONSTRAINT "certificate_enrollment_id_enrollment_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "trade"."enrollment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade"."certificate" ADD CONSTRAINT "certificate_revoked_by_user_id_user_id_fk" FOREIGN KEY ("revoked_by_user_id") REFERENCES "core"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "trade_certificate_enrollment_idx" ON "trade"."certificate" USING btree ("enrollment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "trade_certificate_code_uidx" ON "trade"."certificate" USING btree ("code");--> statement-breakpoint
ALTER TABLE "trade"."module_progress" ADD CONSTRAINT "module_progress_admin_override_by_user_id_user_id_fk" FOREIGN KEY ("admin_override_by_user_id") REFERENCES "core"."user"("id") ON DELETE set null ON UPDATE no action;