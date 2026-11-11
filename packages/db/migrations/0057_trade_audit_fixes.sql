ALTER TABLE "trade"."certificate" ADD COLUMN "public_revocation_reason" text;--> statement-breakpoint
ALTER TABLE "trade"."evidence_record" ADD COLUMN "response_note" text;--> statement-breakpoint
ALTER TABLE "trade"."evidence_record" ADD COLUMN "submitted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "trade"."notification" ADD COLUMN "in_app" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "trade"."public_diagnostic" ADD COLUMN "linked_enrollment_id" uuid;--> statement-breakpoint
ALTER TABLE "trade"."public_diagnostic" ADD CONSTRAINT "public_diagnostic_linked_enrollment_id_enrollment_id_fk" FOREIGN KEY ("linked_enrollment_id") REFERENCES "trade"."enrollment"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "trade_certificate_live_uidx" ON "trade"."certificate" USING btree ("enrollment_id") WHERE "trade"."certificate"."revoked_at" is null;--> statement-breakpoint
-- M01, M03, M04 and M07 0.1.0 predate Entrust's standard: no learner starts or is graded on them any more (audit #217).
UPDATE "trade"."module_content_version" SET "status" = 'archived', "archived_at" = now(), "updated_at" = now() WHERE "version" = '0.1.0' AND "module_id" IN ('M01', 'M03', 'M04', 'M07') AND "status" = 'approved';--> statement-breakpoint
-- A learner part-way through one of them carries on on 1.0.0, and takes its knowledge check (the 0.1.0 score doesn't count there).
UPDATE "trade"."module_progress" SET "content_version" = '1.0.0', "knowledge_check_score" = NULL, "theory_completed_at" = NULL, "updated_at" = now() WHERE "content_version" = '0.1.0' AND "module_id" IN ('M01', 'M03', 'M04', 'M07') AND "status" NOT IN ('passed', 'exempted');--> statement-breakpoint
-- Evidence already sent was sent when it was made.
UPDATE "trade"."evidence_record" SET "submitted_at" = "created_at" WHERE "status" <> 'not_submitted' AND "submitted_at" IS NULL;
