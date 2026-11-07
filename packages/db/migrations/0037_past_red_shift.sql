CREATE TABLE "trade"."module_submission" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enrollment_id" uuid NOT NULL,
	"module_id" text NOT NULL,
	"content_version" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'submitted' NOT NULL,
	"worksheet_version_id" uuid,
	"evidence_record_ids" text[] DEFAULT '{}'::text[] NOT NULL,
	"worksheet_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"submitted_by_user_id" text,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trade"."rubric_assessment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_id" uuid NOT NULL,
	"assessor_user_id" text,
	"is_first_score" boolean DEFAULT true NOT NULL,
	"scores" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"criterion_results" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"confirmed_critical_failures" text[] DEFAULT '{}'::text[] NOT NULL,
	"total_points" integer NOT NULL,
	"max_points" integer NOT NULL,
	"percentage" numeric(5, 2) NOT NULL,
	"band" text NOT NULL,
	"passed" boolean NOT NULL,
	"outcome" text NOT NULL,
	"feedback" text,
	"overridden_by_user_id" text,
	"override_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "trade"."module_submission" ADD CONSTRAINT "module_submission_enrollment_id_enrollment_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "trade"."enrollment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade"."module_submission" ADD CONSTRAINT "module_submission_worksheet_version_id_worksheet_version_id_fk" FOREIGN KEY ("worksheet_version_id") REFERENCES "trade"."worksheet_version"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade"."module_submission" ADD CONSTRAINT "module_submission_submitted_by_user_id_user_id_fk" FOREIGN KEY ("submitted_by_user_id") REFERENCES "core"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade"."rubric_assessment" ADD CONSTRAINT "rubric_assessment_submission_id_module_submission_id_fk" FOREIGN KEY ("submission_id") REFERENCES "trade"."module_submission"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade"."rubric_assessment" ADD CONSTRAINT "rubric_assessment_assessor_user_id_user_id_fk" FOREIGN KEY ("assessor_user_id") REFERENCES "core"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade"."rubric_assessment" ADD CONSTRAINT "rubric_assessment_overridden_by_user_id_user_id_fk" FOREIGN KEY ("overridden_by_user_id") REFERENCES "core"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "trade_module_submission_enrollment_idx" ON "trade"."module_submission" USING btree ("enrollment_id");--> statement-breakpoint
CREATE INDEX "trade_module_submission_enr_mod_idx" ON "trade"."module_submission" USING btree ("enrollment_id","module_id");--> statement-breakpoint
CREATE INDEX "trade_module_submission_status_idx" ON "trade"."module_submission" USING btree ("status");--> statement-breakpoint
CREATE INDEX "trade_module_submission_submitted_at_idx" ON "trade"."module_submission" USING btree ("submitted_at");--> statement-breakpoint
CREATE INDEX "trade_rubric_assessment_submission_idx" ON "trade"."rubric_assessment" USING btree ("submission_id");--> statement-breakpoint
CREATE INDEX "trade_rubric_assessment_assessor_idx" ON "trade"."rubric_assessment" USING btree ("assessor_user_id");