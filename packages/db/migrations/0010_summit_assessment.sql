CREATE TABLE "summit"."application_recommendation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"recommendation" text NOT NULL,
	"suitable_opportunity" text,
	"rationale" text NOT NULL,
	"recorded_by" text,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "summit"."assessment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"rules_version" text NOT NULL,
	"pathway" text NOT NULL,
	"seeking_investment" boolean NOT NULL,
	"started_by" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_by" text,
	"completed_at" timestamp with time zone,
	CONSTRAINT "assessment_application_id_unique" UNIQUE("application_id")
);
--> statement-breakpoint
CREATE TABLE "summit"."category_note" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assessment_id" uuid NOT NULL,
	"category" text NOT NULL,
	"justification" text NOT NULL,
	"evidence" text[] NOT NULL,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "summit"."clarification_request" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"message" text NOT NULL,
	"requested_by" text,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"return_status" text NOT NULL,
	"notified_at" timestamp with time zone,
	"response" text,
	"responded_by" text,
	"responded_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "summit"."criterion_score" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assessment_id" uuid NOT NULL,
	"criterion_id" text NOT NULL,
	"points" integer NOT NULL,
	"recorded_by" text,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "criterion_score_points_check" CHECK ("summit"."criterion_score"."points" >= 0)
);
--> statement-breakpoint
CREATE TABLE "summit"."internal_comment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"author_user_id" text,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "summit"."score_adjustment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assessment_id" uuid NOT NULL,
	"criterion_id" text NOT NULL,
	"previous_points" integer NOT NULL,
	"new_points" integer NOT NULL,
	"reason" text NOT NULL,
	"adjusted_by" text,
	"adjusted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "summit"."verification_record" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"claim" text NOT NULL,
	"class" text NOT NULL,
	"document_ids" uuid[] NOT NULL,
	"independent_check" text,
	"recorded_by" text,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "summit"."application_recommendation" ADD CONSTRAINT "application_recommendation_application_id_application_id_fk" FOREIGN KEY ("application_id") REFERENCES "summit"."application"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "summit"."application_recommendation" ADD CONSTRAINT "application_recommendation_recorded_by_user_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "core"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "summit"."assessment" ADD CONSTRAINT "assessment_application_id_application_id_fk" FOREIGN KEY ("application_id") REFERENCES "summit"."application"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "summit"."assessment" ADD CONSTRAINT "assessment_started_by_user_id_fk" FOREIGN KEY ("started_by") REFERENCES "core"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "summit"."assessment" ADD CONSTRAINT "assessment_completed_by_user_id_fk" FOREIGN KEY ("completed_by") REFERENCES "core"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "summit"."category_note" ADD CONSTRAINT "category_note_assessment_id_assessment_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "summit"."assessment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "summit"."category_note" ADD CONSTRAINT "category_note_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "core"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "summit"."clarification_request" ADD CONSTRAINT "clarification_request_application_id_application_id_fk" FOREIGN KEY ("application_id") REFERENCES "summit"."application"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "summit"."clarification_request" ADD CONSTRAINT "clarification_request_requested_by_user_id_fk" FOREIGN KEY ("requested_by") REFERENCES "core"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "summit"."clarification_request" ADD CONSTRAINT "clarification_request_responded_by_user_id_fk" FOREIGN KEY ("responded_by") REFERENCES "core"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "summit"."criterion_score" ADD CONSTRAINT "criterion_score_assessment_id_assessment_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "summit"."assessment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "summit"."criterion_score" ADD CONSTRAINT "criterion_score_recorded_by_user_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "core"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "summit"."internal_comment" ADD CONSTRAINT "internal_comment_application_id_application_id_fk" FOREIGN KEY ("application_id") REFERENCES "summit"."application"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "summit"."internal_comment" ADD CONSTRAINT "internal_comment_author_user_id_user_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "core"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "summit"."score_adjustment" ADD CONSTRAINT "score_adjustment_assessment_id_assessment_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "summit"."assessment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "summit"."score_adjustment" ADD CONSTRAINT "score_adjustment_adjusted_by_user_id_fk" FOREIGN KEY ("adjusted_by") REFERENCES "core"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "summit"."verification_record" ADD CONSTRAINT "verification_record_application_id_application_id_fk" FOREIGN KEY ("application_id") REFERENCES "summit"."application"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "summit"."verification_record" ADD CONSTRAINT "verification_record_recorded_by_user_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "core"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "application_recommendation_idx" ON "summit"."application_recommendation" USING btree ("application_id","recorded_at");--> statement-breakpoint
CREATE UNIQUE INDEX "category_note_category_uidx" ON "summit"."category_note" USING btree ("assessment_id","category");--> statement-breakpoint
CREATE INDEX "clarification_request_idx" ON "summit"."clarification_request" USING btree ("application_id","requested_at");--> statement-breakpoint
CREATE UNIQUE INDEX "clarification_request_open_uidx" ON "summit"."clarification_request" USING btree ("application_id") WHERE "summit"."clarification_request"."responded_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "criterion_score_criterion_uidx" ON "summit"."criterion_score" USING btree ("assessment_id","criterion_id");--> statement-breakpoint
CREATE INDEX "internal_comment_idx" ON "summit"."internal_comment" USING btree ("application_id","created_at");--> statement-breakpoint
CREATE INDEX "score_adjustment_idx" ON "summit"."score_adjustment" USING btree ("assessment_id","criterion_id","adjusted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "verification_record_claim_uidx" ON "summit"."verification_record" USING btree ("application_id","claim");