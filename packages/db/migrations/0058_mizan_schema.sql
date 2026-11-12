CREATE SCHEMA "mizan";
--> statement-breakpoint
CREATE TABLE "mizan"."assessment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"sequence" integer NOT NULL,
	"assessment_no" text NOT NULL,
	"kind" text DEFAULT 'initial' NOT NULL,
	"previous_assessment_id" uuid,
	"superseded_by_id" uuid,
	"reason" text,
	"methodology" text NOT NULL,
	"config_version" text NOT NULL,
	"config_fingerprint" text NOT NULL,
	"engine_version" text NOT NULL,
	"country_module" text NOT NULL,
	"industry" text,
	"currency" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"assessor_user_id" text NOT NULL,
	"reviewer_user_id" text,
	"top_customer_share" double precision,
	"months_operating" integer,
	"result_json" text,
	"result_sha256" text,
	"verification_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"submitted_at" timestamp with time zone,
	"approved_at" timestamp with time zone,
	CONSTRAINT "assessment_assessment_no_unique" UNIQUE("assessment_no"),
	CONSTRAINT "assessment_verification_code_unique" UNIQUE("verification_code"),
	CONSTRAINT "mizan_assessment_frozen_check" CHECK (("mizan"."assessment"."status" = 'approved') = ("mizan"."assessment"."result_json" is not null and "mizan"."assessment"."result_sha256" is not null and "mizan"."assessment"."verification_code" is not null and "mizan"."assessment"."approved_at" is not null and "mizan"."assessment"."reviewer_user_id" is not null)),
	CONSTRAINT "mizan_assessment_share_check" CHECK ("mizan"."assessment"."top_customer_share" is null or ("mizan"."assessment"."top_customer_share" >= 0 and "mizan"."assessment"."top_customer_share" <= 1)),
	CONSTRAINT "mizan_assessment_reviewer_check" CHECK ("mizan"."assessment"."reviewer_user_id" is null or "mizan"."assessment"."reviewer_user_id" <> "mizan"."assessment"."assessor_user_id"),
	CONSTRAINT "mizan_assessment_follow_on_check" CHECK (("mizan"."assessment"."kind" = 'initial') = ("mizan"."assessment"."previous_assessment_id" is null))
);
--> statement-breakpoint
CREATE TABLE "mizan"."assessment_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assessment_id" uuid NOT NULL,
	"type" text NOT NULL,
	"data" jsonb,
	"actor_user_id" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mizan"."consent" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"kind" text NOT NULL,
	"accepted" boolean NOT NULL,
	"signatory_name" text NOT NULL,
	"signatory_role" text,
	"method" text NOT NULL,
	"notice_version" text NOT NULL,
	"source" text DEFAULT 'mizan' NOT NULL,
	"source_ref" text,
	"given_at" timestamp with time zone NOT NULL,
	"file_id" uuid,
	"captured_by" text,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL,
	"withdrawn_at" timestamp with time zone,
	"withdrawn_by" text
);
--> statement-breakpoint
CREATE TABLE "mizan"."document" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"assessment_id" uuid,
	"file_id" uuid NOT NULL,
	"category" text NOT NULL,
	"criterion_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"source" text DEFAULT 'staff' NOT NULL,
	"uploaded_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"removed_at" timestamp with time zone,
	"removed_by" text
);
--> statement-breakpoint
CREATE TABLE "mizan"."financial_year" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assessment_id" uuid NOT NULL,
	"fiscal_year" text NOT NULL,
	"statement_basis" text NOT NULL,
	"data" jsonb NOT NULL,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mizan"."gate_result" (
	"assessment_id" uuid NOT NULL,
	"gate_id" text NOT NULL,
	"status" text NOT NULL,
	"note" text,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "gate_result_assessment_id_gate_id_pk" PRIMARY KEY("assessment_id","gate_id")
);
--> statement-breakpoint
CREATE TABLE "mizan"."override_flag" (
	"assessment_id" uuid NOT NULL,
	"override_id" text NOT NULL,
	"triggered" boolean NOT NULL,
	"reason" text,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "override_flag_assessment_id_override_id_pk" PRIMARY KEY("assessment_id","override_id"),
	CONSTRAINT "mizan_override_reason_check" CHECK (not "mizan"."override_flag"."triggered" or coalesce(trim("mizan"."override_flag"."reason"), '') <> '')
);
--> statement-breakpoint
CREATE TABLE "mizan"."owner" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"role" text,
	"ownership_pct" double precision,
	"beneficial_owner" boolean DEFAULT false NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"removed_at" timestamp with time zone,
	"removed_by" text,
	CONSTRAINT "mizan_owner_pct_check" CHECK ("mizan"."owner"."ownership_pct" is null or ("mizan"."owner"."ownership_pct" >= 0 and "mizan"."owner"."ownership_pct" <= 100))
);
--> statement-breakpoint
CREATE TABLE "mizan"."rating" (
	"assessment_id" uuid NOT NULL,
	"criterion_id" text NOT NULL,
	"rating" text NOT NULL,
	"evidence" text,
	"note" text,
	"suggested" smallint,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rating_assessment_id_criterion_id_pk" PRIMARY KEY("assessment_id","criterion_id"),
	CONSTRAINT "mizan_rating_value_check" CHECK ("mizan"."rating"."rating" in ('0', '1', '2', '3', '4', 'NE', 'UV', 'NA')),
	CONSTRAINT "mizan_rating_evidence_check" CHECK ("mizan"."rating"."evidence" is null or "mizan"."rating"."evidence" in ('E1', 'E2', 'E3', 'E4', 'E5')),
	CONSTRAINT "mizan_rating_suggested_check" CHECK ("mizan"."rating"."suggested" is null or "mizan"."rating"."suggested" between 0 and 4)
);
--> statement-breakpoint
CREATE TABLE "mizan"."review" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assessment_id" uuid NOT NULL,
	"reviewer_user_id" text NOT NULL,
	"decision" text NOT NULL,
	"comments" text,
	"declaration_confirmed" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mizan_review_declaration_check" CHECK ("mizan"."review"."decision" <> 'approved' or "mizan"."review"."declaration_confirmed"),
	CONSTRAINT "mizan_review_comments_check" CHECK ("mizan"."review"."decision" <> 'returned' or coalesce(trim("mizan"."review"."comments"), '') <> '')
);
--> statement-breakpoint
CREATE TABLE "mizan"."sme" (
	"organization_id" text PRIMARY KEY NOT NULL,
	"programmes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"legal_form" text,
	"operating_since" date,
	"contact_name" text,
	"contact_phone" text,
	"contact_email" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mizan"."support_link" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"note" text,
	"source" text DEFAULT 'mizan' NOT NULL,
	"source_ref" text,
	"recorded_by" text,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"ended_by" text
);
--> statement-breakpoint
ALTER TABLE "mizan"."assessment" ADD CONSTRAINT "assessment_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "core"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mizan"."assessment" ADD CONSTRAINT "assessment_previous_assessment_id_assessment_id_fk" FOREIGN KEY ("previous_assessment_id") REFERENCES "mizan"."assessment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mizan"."assessment" ADD CONSTRAINT "assessment_superseded_by_id_assessment_id_fk" FOREIGN KEY ("superseded_by_id") REFERENCES "mizan"."assessment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mizan"."assessment" ADD CONSTRAINT "assessment_assessor_user_id_user_id_fk" FOREIGN KEY ("assessor_user_id") REFERENCES "core"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mizan"."assessment" ADD CONSTRAINT "assessment_reviewer_user_id_user_id_fk" FOREIGN KEY ("reviewer_user_id") REFERENCES "core"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mizan"."assessment_event" ADD CONSTRAINT "assessment_event_assessment_id_assessment_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "mizan"."assessment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mizan"."assessment_event" ADD CONSTRAINT "assessment_event_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "core"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mizan"."consent" ADD CONSTRAINT "consent_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "core"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mizan"."consent" ADD CONSTRAINT "consent_file_id_file_id_fk" FOREIGN KEY ("file_id") REFERENCES "core"."file"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mizan"."consent" ADD CONSTRAINT "consent_captured_by_user_id_fk" FOREIGN KEY ("captured_by") REFERENCES "core"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mizan"."consent" ADD CONSTRAINT "consent_withdrawn_by_user_id_fk" FOREIGN KEY ("withdrawn_by") REFERENCES "core"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mizan"."document" ADD CONSTRAINT "document_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "core"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mizan"."document" ADD CONSTRAINT "document_assessment_id_assessment_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "mizan"."assessment"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mizan"."document" ADD CONSTRAINT "document_file_id_file_id_fk" FOREIGN KEY ("file_id") REFERENCES "core"."file"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mizan"."document" ADD CONSTRAINT "document_uploaded_by_user_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "core"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mizan"."document" ADD CONSTRAINT "document_removed_by_user_id_fk" FOREIGN KEY ("removed_by") REFERENCES "core"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mizan"."financial_year" ADD CONSTRAINT "financial_year_assessment_id_assessment_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "mizan"."assessment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mizan"."financial_year" ADD CONSTRAINT "financial_year_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "core"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mizan"."gate_result" ADD CONSTRAINT "gate_result_assessment_id_assessment_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "mizan"."assessment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mizan"."gate_result" ADD CONSTRAINT "gate_result_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "core"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mizan"."override_flag" ADD CONSTRAINT "override_flag_assessment_id_assessment_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "mizan"."assessment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mizan"."override_flag" ADD CONSTRAINT "override_flag_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "core"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mizan"."owner" ADD CONSTRAINT "owner_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "core"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mizan"."owner" ADD CONSTRAINT "owner_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "core"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mizan"."owner" ADD CONSTRAINT "owner_removed_by_user_id_fk" FOREIGN KEY ("removed_by") REFERENCES "core"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mizan"."rating" ADD CONSTRAINT "rating_assessment_id_assessment_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "mizan"."assessment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mizan"."rating" ADD CONSTRAINT "rating_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "core"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mizan"."review" ADD CONSTRAINT "review_assessment_id_assessment_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "mizan"."assessment"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mizan"."review" ADD CONSTRAINT "review_reviewer_user_id_user_id_fk" FOREIGN KEY ("reviewer_user_id") REFERENCES "core"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mizan"."sme" ADD CONSTRAINT "sme_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "core"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mizan"."sme" ADD CONSTRAINT "sme_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "core"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mizan"."support_link" ADD CONSTRAINT "support_link_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "core"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mizan"."support_link" ADD CONSTRAINT "support_link_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "core"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mizan"."support_link" ADD CONSTRAINT "support_link_recorded_by_user_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "core"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mizan"."support_link" ADD CONSTRAINT "support_link_ended_by_user_id_fk" FOREIGN KEY ("ended_by") REFERENCES "core"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "mizan_assessment_org_sequence_uidx" ON "mizan"."assessment" USING btree ("organization_id","sequence");--> statement-breakpoint
CREATE UNIQUE INDEX "mizan_assessment_one_open_uidx" ON "mizan"."assessment" USING btree ("organization_id") WHERE "mizan"."assessment"."status" in ('draft', 'in_review', 'returned');--> statement-breakpoint
CREATE INDEX "mizan_assessment_status_idx" ON "mizan"."assessment" USING btree ("status","submitted_at");--> statement-breakpoint
CREATE INDEX "mizan_assessment_assessor_idx" ON "mizan"."assessment" USING btree ("assessor_user_id");--> statement-breakpoint
CREATE INDEX "mizan_assessment_event_idx" ON "mizan"."assessment_event" USING btree ("assessment_id","occurred_at");--> statement-breakpoint
CREATE INDEX "mizan_consent_org_kind_idx" ON "mizan"."consent" USING btree ("organization_id","kind","given_at");--> statement-breakpoint
CREATE UNIQUE INDEX "mizan_consent_source_uidx" ON "mizan"."consent" USING btree ("organization_id","kind","source","source_ref") WHERE "mizan"."consent"."source_ref" is not null;--> statement-breakpoint
CREATE INDEX "mizan_document_org_idx" ON "mizan"."document" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "mizan_document_assessment_idx" ON "mizan"."document" USING btree ("assessment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "mizan_financial_year_uidx" ON "mizan"."financial_year" USING btree ("assessment_id","fiscal_year");--> statement-breakpoint
CREATE INDEX "mizan_owner_org_idx" ON "mizan"."owner" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "mizan_review_assessment_idx" ON "mizan"."review" USING btree ("assessment_id","created_at");--> statement-breakpoint
CREATE INDEX "mizan_support_link_org_user_idx" ON "mizan"."support_link" USING btree ("organization_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "mizan_support_link_source_uidx" ON "mizan"."support_link" USING btree ("organization_id","user_id","source","source_ref") WHERE "mizan"."support_link"."source_ref" is not null;--> statement-breakpoint
-- Written by hand (drizzle-kit doesn't manage functions or triggers, so later migrations leave these alone).
-- An approved MIZAN assessment is frozen (#219, #222): nothing may change it except recording the assessment that supersedes it,
-- once, and nothing may delete it. Its financial years, ratings, gates and overrides can't be added, changed or removed either.
-- The only way past is `SET LOCAL mizan.allow_frozen_delete = 'on'` inside a transaction, which allows deletes only: for test
-- clean-up and an erasure request a person has decided on, never for normal work.
CREATE FUNCTION "mizan"."guard_approved_assessment"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status = 'approved' AND coalesce(current_setting('mizan.allow_frozen_delete', true), '') <> 'on' THEN
      RAISE EXCEPTION 'MIZAN assessment % is approved and cannot be deleted', OLD.assessment_no USING ERRCODE = 'restrict_violation';
    END IF;
    RETURN OLD;
  END IF;
  IF OLD.status = 'approved' THEN
    IF (to_jsonb(NEW) - 'superseded_by_id' - 'updated_at') IS DISTINCT FROM (to_jsonb(OLD) - 'superseded_by_id' - 'updated_at')
       OR (OLD.superseded_by_id IS NOT NULL AND NEW.superseded_by_id IS DISTINCT FROM OLD.superseded_by_id) THEN
      RAISE EXCEPTION 'MIZAN assessment % is approved and cannot be changed', OLD.assessment_no USING ERRCODE = 'restrict_violation';
    END IF;
  END IF;
  RETURN NEW;
END
$$;--> statement-breakpoint
CREATE TRIGGER "mizan_assessment_frozen" BEFORE UPDATE OR DELETE ON "mizan"."assessment" FOR EACH ROW EXECUTE FUNCTION "mizan"."guard_approved_assessment"();--> statement-breakpoint
CREATE FUNCTION "mizan"."guard_approved_inputs"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' AND coalesce(current_setting('mizan.allow_frozen_delete', true), '') = 'on' THEN
    RETURN OLD;
  END IF;
  IF (TG_OP <> 'INSERT' AND EXISTS (SELECT 1 FROM "mizan"."assessment" WHERE id = OLD.assessment_id AND status = 'approved'))
     OR (TG_OP <> 'DELETE' AND EXISTS (SELECT 1 FROM "mizan"."assessment" WHERE id = NEW.assessment_id AND status = 'approved')) THEN
    RAISE EXCEPTION 'The inputs of an approved MIZAN assessment cannot be changed (%)', TG_TABLE_NAME USING ERRCODE = 'restrict_violation';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END
$$;--> statement-breakpoint
CREATE TRIGGER "mizan_financial_year_frozen" BEFORE INSERT OR UPDATE OR DELETE ON "mizan"."financial_year" FOR EACH ROW EXECUTE FUNCTION "mizan"."guard_approved_inputs"();--> statement-breakpoint
CREATE TRIGGER "mizan_rating_frozen" BEFORE INSERT OR UPDATE OR DELETE ON "mizan"."rating" FOR EACH ROW EXECUTE FUNCTION "mizan"."guard_approved_inputs"();--> statement-breakpoint
CREATE TRIGGER "mizan_gate_result_frozen" BEFORE INSERT OR UPDATE OR DELETE ON "mizan"."gate_result" FOR EACH ROW EXECUTE FUNCTION "mizan"."guard_approved_inputs"();--> statement-breakpoint
CREATE TRIGGER "mizan_override_flag_frozen" BEFORE INSERT OR UPDATE OR DELETE ON "mizan"."override_flag" FOR EACH ROW EXECUTE FUNCTION "mizan"."guard_approved_inputs"();
