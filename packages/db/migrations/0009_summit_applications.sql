CREATE SCHEMA "summit";
--> statement-breakpoint
CREATE SEQUENCE "summit"."application_number_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE TABLE "summit"."application" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" text DEFAULT 'SUM-' || lpad(nextval('summit.application_number_seq')::text, 6, '0') NOT NULL,
	"organization_id" text NOT NULL,
	"period_id" uuid NOT NULL,
	"applicant_user_id" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"template_version" text NOT NULL,
	"answers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"pathway" text,
	"submitted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "application_number_unique" UNIQUE("number")
);
--> statement-breakpoint
CREATE TABLE "summit"."application_document" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"file_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"added_by" text,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "summit"."application_period" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"opens_at" timestamp with time zone NOT NULL,
	"closes_at" timestamp with time zone NOT NULL,
	"countries" text[] NOT NULL,
	"template_version" text NOT NULL,
	"rules_version" text NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "application_period_window_check" CHECK ("summit"."application_period"."closes_at" > "summit"."application_period"."opens_at")
);
--> statement-breakpoint
CREATE TABLE "summit"."application_status_change" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"from_status" text,
	"to_status" text NOT NULL,
	"changed_by" text,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reason" text
);
--> statement-breakpoint
CREATE TABLE "summit"."consent_record" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"question" text NOT NULL,
	"user_id" text,
	"terms_version" text NOT NULL,
	"accepted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "summit"."eligibility_exception" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"criterion" text NOT NULL,
	"reason" text NOT NULL,
	"recorded_by" text,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "summit"."eligibility_result" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"rules_version" text NOT NULL,
	"outcome" text NOT NULL,
	"criteria" jsonb NOT NULL,
	"missing_documents" text[] NOT NULL,
	"screened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"screened_by" text
);
--> statement-breakpoint
CREATE TABLE "summit"."officer_assignment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"officer_user_id" text NOT NULL,
	"assigned_by" text,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "summit"."application" ADD CONSTRAINT "application_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "core"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "summit"."application" ADD CONSTRAINT "application_period_id_application_period_id_fk" FOREIGN KEY ("period_id") REFERENCES "summit"."application_period"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "summit"."application" ADD CONSTRAINT "application_applicant_user_id_user_id_fk" FOREIGN KEY ("applicant_user_id") REFERENCES "core"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "summit"."application_document" ADD CONSTRAINT "application_document_application_id_application_id_fk" FOREIGN KEY ("application_id") REFERENCES "summit"."application"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "summit"."application_document" ADD CONSTRAINT "application_document_file_id_file_id_fk" FOREIGN KEY ("file_id") REFERENCES "core"."file"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "summit"."application_document" ADD CONSTRAINT "application_document_added_by_user_id_fk" FOREIGN KEY ("added_by") REFERENCES "core"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "summit"."application_period" ADD CONSTRAINT "application_period_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "core"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "summit"."application_status_change" ADD CONSTRAINT "application_status_change_application_id_application_id_fk" FOREIGN KEY ("application_id") REFERENCES "summit"."application"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "summit"."application_status_change" ADD CONSTRAINT "application_status_change_changed_by_user_id_fk" FOREIGN KEY ("changed_by") REFERENCES "core"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "summit"."consent_record" ADD CONSTRAINT "consent_record_application_id_application_id_fk" FOREIGN KEY ("application_id") REFERENCES "summit"."application"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "summit"."consent_record" ADD CONSTRAINT "consent_record_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "core"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "summit"."eligibility_exception" ADD CONSTRAINT "eligibility_exception_application_id_application_id_fk" FOREIGN KEY ("application_id") REFERENCES "summit"."application"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "summit"."eligibility_exception" ADD CONSTRAINT "eligibility_exception_recorded_by_user_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "core"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "summit"."eligibility_result" ADD CONSTRAINT "eligibility_result_application_id_application_id_fk" FOREIGN KEY ("application_id") REFERENCES "summit"."application"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "summit"."eligibility_result" ADD CONSTRAINT "eligibility_result_screened_by_user_id_fk" FOREIGN KEY ("screened_by") REFERENCES "core"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "summit"."officer_assignment" ADD CONSTRAINT "officer_assignment_application_id_application_id_fk" FOREIGN KEY ("application_id") REFERENCES "summit"."application"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "summit"."officer_assignment" ADD CONSTRAINT "officer_assignment_officer_user_id_user_id_fk" FOREIGN KEY ("officer_user_id") REFERENCES "core"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "summit"."officer_assignment" ADD CONSTRAINT "officer_assignment_assigned_by_user_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "core"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "application_org_idx" ON "summit"."application" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "application_period_status_idx" ON "summit"."application" USING btree ("period_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "application_org_period_uidx" ON "summit"."application" USING btree ("organization_id","period_id") WHERE "summit"."application"."status" <> 'withdrawn';--> statement-breakpoint
CREATE UNIQUE INDEX "application_document_file_uidx" ON "summit"."application_document" USING btree ("application_id","file_id");--> statement-breakpoint
CREATE INDEX "application_status_change_idx" ON "summit"."application_status_change" USING btree ("application_id","changed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "consent_record_question_uidx" ON "summit"."consent_record" USING btree ("application_id","question");--> statement-breakpoint
CREATE UNIQUE INDEX "eligibility_exception_criterion_uidx" ON "summit"."eligibility_exception" USING btree ("application_id","criterion");--> statement-breakpoint
CREATE INDEX "eligibility_result_idx" ON "summit"."eligibility_result" USING btree ("application_id","screened_at");--> statement-breakpoint
CREATE INDEX "officer_assignment_officer_idx" ON "summit"."officer_assignment" USING btree ("officer_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "officer_assignment_current_uidx" ON "summit"."officer_assignment" USING btree ("application_id") WHERE "summit"."officer_assignment"."ended_at" is null;