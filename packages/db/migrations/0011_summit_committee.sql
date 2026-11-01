CREATE TABLE "summit"."assessment_review" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"decision" text NOT NULL,
	"reason" text,
	"reviewed_by" text,
	"reviewed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "summit"."committee_decision" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"decision" text NOT NULL,
	"reason" text NOT NULL,
	"decided_by" text,
	"decided_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "summit"."assessment_review" ADD CONSTRAINT "assessment_review_application_id_application_id_fk" FOREIGN KEY ("application_id") REFERENCES "summit"."application"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "summit"."assessment_review" ADD CONSTRAINT "assessment_review_reviewed_by_user_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "core"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "summit"."committee_decision" ADD CONSTRAINT "committee_decision_application_id_application_id_fk" FOREIGN KEY ("application_id") REFERENCES "summit"."application"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "summit"."committee_decision" ADD CONSTRAINT "committee_decision_decided_by_user_id_fk" FOREIGN KEY ("decided_by") REFERENCES "core"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assessment_review_idx" ON "summit"."assessment_review" USING btree ("application_id","reviewed_at");--> statement-breakpoint
CREATE INDEX "committee_decision_idx" ON "summit"."committee_decision" USING btree ("application_id","decided_at");