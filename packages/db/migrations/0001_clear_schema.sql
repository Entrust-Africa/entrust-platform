CREATE SCHEMA "clear";
--> statement-breakpoint
CREATE TABLE "clear"."case_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"type" text NOT NULL,
	"step_id" text,
	"evidence_id" uuid,
	"data" jsonb,
	"actor_user_id" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clear"."case_reference_counter" (
	"country" text NOT NULL,
	"year" integer NOT NULL,
	"last_number" integer NOT NULL,
	CONSTRAINT "case_reference_counter_country_year_pk" PRIMARY KEY("country","year")
);
--> statement-breakpoint
CREATE TABLE "clear"."case_step" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"step_id" text NOT NULL,
	"status" text DEFAULT 'not_started' NOT NULL,
	"not_applicable_reason" text,
	"owner_user_id" text,
	"raised_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "case_step_not_applicable_reason_check" CHECK ("clear"."case_step"."status" <> 'not_applicable' or "clear"."case_step"."not_applicable_reason" is not null)
);
--> statement-breakpoint
CREATE TABLE "clear"."evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"type" text NOT NULL,
	"file_id" uuid,
	"status" text DEFAULT 'submitted' NOT NULL,
	"issued_on" date,
	"valid_until" date,
	"submitted_by_user_id" text,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewer_user_id" text,
	"reviewed_at" timestamp with time zone,
	"review_note" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clear"."export_case" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" text NOT NULL,
	"organization_id" text NOT NULL,
	"sales_contract_id" uuid,
	"facts" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"product" text GENERATED ALWAYS AS (facts ->> 'product') STORED NOT NULL,
	"destination_country" text GENERATED ALWAYS AS (facts ->> 'destinationCountry') STORED NOT NULL,
	"rule_pack_id" text,
	"rule_pack_version" text,
	"current_phase" smallint DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "export_case_reference_unique" UNIQUE("reference"),
	CONSTRAINT "export_case_rule_pack_check" CHECK (("clear"."export_case"."rule_pack_id" is null) = ("clear"."export_case"."rule_pack_version" is null))
);
--> statement-breakpoint
CREATE TABLE "clear"."sales_contract" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"number" text NOT NULL,
	"buyer_name" text NOT NULL,
	"contract_date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "clear"."case_event" ADD CONSTRAINT "case_event_case_id_export_case_id_fk" FOREIGN KEY ("case_id") REFERENCES "clear"."export_case"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clear"."case_event" ADD CONSTRAINT "case_event_evidence_id_evidence_id_fk" FOREIGN KEY ("evidence_id") REFERENCES "clear"."evidence"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clear"."case_event" ADD CONSTRAINT "case_event_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "core"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clear"."case_step" ADD CONSTRAINT "case_step_case_id_export_case_id_fk" FOREIGN KEY ("case_id") REFERENCES "clear"."export_case"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clear"."case_step" ADD CONSTRAINT "case_step_owner_user_id_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "core"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clear"."evidence" ADD CONSTRAINT "evidence_case_id_export_case_id_fk" FOREIGN KEY ("case_id") REFERENCES "clear"."export_case"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clear"."evidence" ADD CONSTRAINT "evidence_submitted_by_user_id_user_id_fk" FOREIGN KEY ("submitted_by_user_id") REFERENCES "core"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clear"."evidence" ADD CONSTRAINT "evidence_reviewer_user_id_user_id_fk" FOREIGN KEY ("reviewer_user_id") REFERENCES "core"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clear"."export_case" ADD CONSTRAINT "export_case_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "core"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clear"."export_case" ADD CONSTRAINT "export_case_sales_contract_id_sales_contract_id_fk" FOREIGN KEY ("sales_contract_id") REFERENCES "clear"."sales_contract"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clear"."export_case" ADD CONSTRAINT "export_case_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "core"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clear"."sales_contract" ADD CONSTRAINT "sales_contract_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "core"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "case_event_case_idx" ON "clear"."case_event" USING btree ("case_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "case_step_case_step_uidx" ON "clear"."case_step" USING btree ("case_id","step_id");--> statement-breakpoint
CREATE INDEX "evidence_case_type_idx" ON "clear"."evidence" USING btree ("case_id","type");--> statement-breakpoint
CREATE INDEX "export_case_org_idx" ON "clear"."export_case" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "export_case_status_idx" ON "clear"."export_case" USING btree ("status","current_phase");--> statement-breakpoint
CREATE INDEX "sales_contract_org_idx" ON "clear"."sales_contract" USING btree ("organization_id");