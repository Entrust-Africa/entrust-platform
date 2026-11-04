CREATE TABLE "trade"."assessment_consent" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assessment_id" uuid NOT NULL,
	"question_id" text NOT NULL,
	"user_id" text,
	"terms_version" text NOT NULL,
	"accepted" boolean DEFAULT true NOT NULL,
	"signed_name" text,
	"signed_position" text,
	"signed_date" date,
	"accepted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trade"."pathway_assignment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enrollment_id" uuid NOT NULL,
	"assessment_id" uuid,
	"pathway" text NOT NULL,
	"status" text NOT NULL,
	"live_order" boolean DEFAULT false NOT NULL,
	"rules_version" text NOT NULL,
	"reason_codes" jsonb NOT NULL,
	"decided_by_user_id" text,
	"decision_reason" text,
	"superseded_by_id" uuid,
	"superseded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "trade"."assessment_response" ADD COLUMN "unscored_reason" text;--> statement-breakpoint
ALTER TABLE "trade"."assessment_consent" ADD CONSTRAINT "assessment_consent_assessment_id_assessment_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "trade"."assessment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade"."assessment_consent" ADD CONSTRAINT "assessment_consent_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "core"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade"."pathway_assignment" ADD CONSTRAINT "pathway_assignment_enrollment_id_enrollment_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "trade"."enrollment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade"."pathway_assignment" ADD CONSTRAINT "pathway_assignment_assessment_id_assessment_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "trade"."assessment"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade"."pathway_assignment" ADD CONSTRAINT "pathway_assignment_decided_by_user_id_user_id_fk" FOREIGN KEY ("decided_by_user_id") REFERENCES "core"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "trade_assessment_consent_question_uidx" ON "trade"."assessment_consent" USING btree ("assessment_id","question_id");--> statement-breakpoint
CREATE INDEX "trade_pathway_assignment_enrollment_idx" ON "trade"."pathway_assignment" USING btree ("enrollment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "trade_pathway_assignment_live_uidx" ON "trade"."pathway_assignment" USING btree ("enrollment_id") WHERE "trade"."pathway_assignment"."status" <> 'superseded';--> statement-breakpoint
CREATE UNIQUE INDEX "trade_assessment_live_diagnostic_uidx" ON "trade"."assessment" USING btree ("enrollment_id") WHERE "trade"."assessment"."kind" = 'diagnostic' and "trade"."assessment"."status" <> 'superseded';