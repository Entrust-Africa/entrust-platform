CREATE TABLE "trade"."knowledge_check_attempt" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enrollment_id" uuid NOT NULL,
	"module_id" text NOT NULL,
	"content_version" text NOT NULL,
	"attempt_number" integer DEFAULT 1 NOT NULL,
	"score" numeric(5, 2) NOT NULL,
	"passed" boolean NOT NULL,
	"total_questions" integer NOT NULL,
	"correct_count" integer NOT NULL,
	"answers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"results" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"submitted_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "trade"."module_progress" ADD COLUMN "theory_completed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "trade"."module_progress" ADD COLUMN "knowledge_check_score" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "trade"."knowledge_check_attempt" ADD CONSTRAINT "knowledge_check_attempt_enrollment_id_enrollment_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "trade"."enrollment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade"."knowledge_check_attempt" ADD CONSTRAINT "knowledge_check_attempt_submitted_by_user_id_user_id_fk" FOREIGN KEY ("submitted_by_user_id") REFERENCES "core"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "trade_kc_attempt_enrollment_idx" ON "trade"."knowledge_check_attempt" USING btree ("enrollment_id");--> statement-breakpoint
CREATE INDEX "trade_kc_attempt_enr_module_idx" ON "trade"."knowledge_check_attempt" USING btree ("enrollment_id","module_id");