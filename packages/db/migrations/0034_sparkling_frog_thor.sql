ALTER TABLE "trade"."evidence_record" ADD COLUMN "target_type" text DEFAULT 'assessment_question' NOT NULL;--> statement-breakpoint
ALTER TABLE "trade"."evidence_record" ADD COLUMN "target_id" text;--> statement-breakpoint
ALTER TABLE "trade"."evidence_record" ADD COLUMN "confidence" text DEFAULT 'self_reported' NOT NULL;--> statement-breakpoint
ALTER TABLE "trade"."evidence_record" ADD COLUMN "reviewed_by_user_id" text;--> statement-breakpoint
ALTER TABLE "trade"."evidence_record" ADD COLUMN "reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "trade"."evidence_record" ADD COLUMN "review_comment" text;--> statement-breakpoint
ALTER TABLE "trade"."evidence_record" ADD COLUMN "requested_by_user_id" text;--> statement-breakpoint
ALTER TABLE "trade"."evidence_record" ADD COLUMN "requested_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "trade"."evidence_record" ADD COLUMN "request_prompt" text;--> statement-breakpoint
ALTER TABLE "trade"."evidence_record" ADD CONSTRAINT "evidence_record_reviewed_by_user_id_user_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "core"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade"."evidence_record" ADD CONSTRAINT "evidence_record_requested_by_user_id_user_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "core"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "trade_evidence_record_target_idx" ON "trade"."evidence_record" USING btree ("target_type","target_id");