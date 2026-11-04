CREATE SCHEMA "trade";
--> statement-breakpoint
CREATE TABLE "trade"."assessment_response" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assessment_id" uuid NOT NULL,
	"question_id" text NOT NULL,
	"answer" jsonb,
	"unscored" text,
	"approved_by_user_id" text,
	"approved_at" timestamp with time zone,
	"documents_available" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trade"."capability_score" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assessment_id" uuid NOT NULL,
	"domain" text NOT NULL,
	"points" integer NOT NULL,
	"max_points" integer NOT NULL,
	"coverage" numeric(5, 4) NOT NULL,
	"score" integer,
	"band" text,
	"evidence_status" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trade"."cohort" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"program_id" uuid NOT NULL,
	"name" text NOT NULL,
	"sponsor_organization_id" text,
	"country" text DEFAULT 'ET' NOT NULL,
	"language" text DEFAULT 'en' NOT NULL,
	"delivery_mode" text DEFAULT 'self_paced' NOT NULL,
	"start_date" date,
	"end_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trade"."commercial_opportunity" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"enrollment_id" uuid,
	"title" text NOT NULL,
	"buyer_name" text,
	"estimated_value" numeric(14, 2),
	"currency" text DEFAULT 'USD',
	"status" text DEFAULT 'identified' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trade"."enrollment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cohort_id" uuid NOT NULL,
	"organization_id" text NOT NULL,
	"status" text DEFAULT 'invited' NOT NULL,
	"enrolled_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"withdrawn_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trade"."evidence_record" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"enrollment_id" uuid,
	"file_id" uuid,
	"title" text NOT NULL,
	"status" text DEFAULT 'not_submitted' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trade"."learning_plan" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enrollment_id" uuid NOT NULL,
	"assessment_id" uuid,
	"rules_version" text NOT NULL,
	"pathway" text NOT NULL,
	"status" text DEFAULT 'generated' NOT NULL,
	"requires_human_review" boolean DEFAULT false NOT NULL,
	"review_reasons" text[] DEFAULT '{}'::text[] NOT NULL,
	"acknowledged_at" timestamp with time zone,
	"superseded_by_id" uuid,
	"superseded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trade"."module_assignment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"module_id" text NOT NULL,
	"status" text NOT NULL,
	"sequence" integer NOT NULL,
	"reason_codes" text[] DEFAULT '{}'::text[] NOT NULL,
	"source" text DEFAULT 'engine' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trade"."module_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enrollment_id" uuid NOT NULL,
	"module_id" text NOT NULL,
	"content_version" text NOT NULL,
	"status" text DEFAULT 'not_started' NOT NULL,
	"lesson_progress" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trade"."outcome" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"enrollment_id" uuid,
	"kind" text NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trade_outcome_financing_status_check" CHECK ("trade"."outcome"."kind" <> 'financing' or "trade"."outcome"."status" in ('not_started', 'application_prepared', 'submitted', 'approved', 'declined', 'disbursed', 'cancelled')),
	CONSTRAINT "trade_outcome_export_status_check" CHECK ("trade"."outcome"."kind" <> 'export' or "trade"."outcome"."status" in ('planned', 'preparing', 'shipped', 'delivered', 'payment_pending', 'paid', 'disputed', 'cancelled'))
);
--> statement-breakpoint
CREATE TABLE "trade"."program" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trade"."assessment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enrollment_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"template_version" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"assessed_by_user_id" text,
	"assessed_at" timestamp with time zone,
	"superseded_by_id" uuid,
	"superseded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "trade"."assessment_response" ADD CONSTRAINT "assessment_response_assessment_id_assessment_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "trade"."assessment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade"."assessment_response" ADD CONSTRAINT "assessment_response_approved_by_user_id_user_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "core"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade"."capability_score" ADD CONSTRAINT "capability_score_assessment_id_assessment_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "trade"."assessment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade"."cohort" ADD CONSTRAINT "cohort_program_id_program_id_fk" FOREIGN KEY ("program_id") REFERENCES "trade"."program"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade"."cohort" ADD CONSTRAINT "cohort_sponsor_organization_id_organization_id_fk" FOREIGN KEY ("sponsor_organization_id") REFERENCES "core"."organization"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade"."commercial_opportunity" ADD CONSTRAINT "commercial_opportunity_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "core"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade"."commercial_opportunity" ADD CONSTRAINT "commercial_opportunity_enrollment_id_enrollment_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "trade"."enrollment"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade"."enrollment" ADD CONSTRAINT "enrollment_cohort_id_cohort_id_fk" FOREIGN KEY ("cohort_id") REFERENCES "trade"."cohort"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade"."enrollment" ADD CONSTRAINT "enrollment_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "core"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade"."evidence_record" ADD CONSTRAINT "evidence_record_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "core"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade"."evidence_record" ADD CONSTRAINT "evidence_record_enrollment_id_enrollment_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "trade"."enrollment"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade"."evidence_record" ADD CONSTRAINT "evidence_record_file_id_file_id_fk" FOREIGN KEY ("file_id") REFERENCES "core"."file"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade"."learning_plan" ADD CONSTRAINT "learning_plan_enrollment_id_enrollment_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "trade"."enrollment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade"."learning_plan" ADD CONSTRAINT "learning_plan_assessment_id_assessment_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "trade"."assessment"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade"."module_assignment" ADD CONSTRAINT "module_assignment_plan_id_learning_plan_id_fk" FOREIGN KEY ("plan_id") REFERENCES "trade"."learning_plan"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade"."module_progress" ADD CONSTRAINT "module_progress_enrollment_id_enrollment_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "trade"."enrollment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade"."outcome" ADD CONSTRAINT "outcome_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "core"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade"."outcome" ADD CONSTRAINT "outcome_enrollment_id_enrollment_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "trade"."enrollment"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade"."assessment" ADD CONSTRAINT "assessment_enrollment_id_enrollment_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "trade"."enrollment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade"."assessment" ADD CONSTRAINT "assessment_assessed_by_user_id_user_id_fk" FOREIGN KEY ("assessed_by_user_id") REFERENCES "core"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "trade_assessment_response_question_uidx" ON "trade"."assessment_response" USING btree ("assessment_id","question_id");--> statement-breakpoint
CREATE UNIQUE INDEX "trade_capability_score_assessment_domain_uidx" ON "trade"."capability_score" USING btree ("assessment_id","domain");--> statement-breakpoint
CREATE INDEX "trade_cohort_program_idx" ON "trade"."cohort" USING btree ("program_id");--> statement-breakpoint
CREATE INDEX "trade_cohort_sponsor_idx" ON "trade"."cohort" USING btree ("sponsor_organization_id");--> statement-breakpoint
CREATE INDEX "trade_opportunity_org_idx" ON "trade"."commercial_opportunity" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "trade_opportunity_enrollment_idx" ON "trade"."commercial_opportunity" USING btree ("enrollment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "trade_enrollment_cohort_org_uidx" ON "trade"."enrollment" USING btree ("cohort_id","organization_id");--> statement-breakpoint
CREATE INDEX "trade_enrollment_org_idx" ON "trade"."enrollment" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "trade_evidence_record_org_idx" ON "trade"."evidence_record" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "trade_evidence_record_enrollment_idx" ON "trade"."evidence_record" USING btree ("enrollment_id");--> statement-breakpoint
CREATE INDEX "trade_learning_plan_enrollment_idx" ON "trade"."learning_plan" USING btree ("enrollment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "trade_learning_plan_live_uidx" ON "trade"."learning_plan" USING btree ("enrollment_id") WHERE "trade"."learning_plan"."status" <> 'superseded';--> statement-breakpoint
CREATE UNIQUE INDEX "trade_module_assignment_plan_module_uidx" ON "trade"."module_assignment" USING btree ("plan_id","module_id");--> statement-breakpoint
CREATE INDEX "trade_module_assignment_plan_seq_idx" ON "trade"."module_assignment" USING btree ("plan_id","sequence");--> statement-breakpoint
CREATE UNIQUE INDEX "trade_module_progress_enrollment_module_uidx" ON "trade"."module_progress" USING btree ("enrollment_id","module_id");--> statement-breakpoint
CREATE INDEX "trade_outcome_org_idx" ON "trade"."outcome" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "trade_outcome_enrollment_idx" ON "trade"."outcome" USING btree ("enrollment_id");--> statement-breakpoint
CREATE INDEX "trade_assessment_enrollment_idx" ON "trade"."assessment" USING btree ("enrollment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "trade_assessment_live_placement_uidx" ON "trade"."assessment" USING btree ("enrollment_id") WHERE "trade"."assessment"."kind" = 'placement' and "trade"."assessment"."status" <> 'superseded';