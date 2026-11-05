CREATE SEQUENCE "summit"."b2b_enquiry_number_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE TABLE "summit"."b2b_enquiry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" text DEFAULT 'B2B-' || lpad(nextval('summit.b2b_enquiry_number_seq')::text, 4, '0') NOT NULL,
	"edition_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"interest" text NOT NULL,
	"from_name" text NOT NULL,
	"from_email" text NOT NULL,
	"from_phone" text,
	"from_organisation" text NOT NULL,
	"from_role" text,
	"message" text NOT NULL,
	"consented_at" timestamp with time zone NOT NULL,
	"forwarded_at" timestamp with time zone,
	"handled_by" text,
	"handled_at" timestamp with time zone,
	"handling_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "b2b_enquiry_number_unique" UNIQUE("number")
);
--> statement-breakpoint
CREATE TABLE "summit"."sme_public_profile" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"edition_id" uuid NOT NULL,
	"application_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"display_name" text NOT NULL,
	"country" text NOT NULL,
	"city" text,
	"sector" text NOT NULL,
	"summary" text NOT NULL,
	"products_services" text[] DEFAULT '{}'::text[] NOT NULL,
	"production_capacity" text,
	"export_readiness" text,
	"target_markets" text[] DEFAULT '{}'::text[] NOT NULL,
	"seeks_investment" boolean DEFAULT false NOT NULL,
	"investment_requirements" text,
	"verification" text DEFAULT 'pending' NOT NULL,
	"website" text,
	"contact_name" text,
	"contact_position" text,
	"contact_email" text,
	"contact_phone" text,
	"business_approved_at" timestamp with time zone,
	"business_approved_by" text,
	"approval_note" text,
	"published_at" timestamp with time zone,
	"published_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "summit"."b2b_enquiry" ADD CONSTRAINT "b2b_enquiry_edition_id_commerce_edition_id_fk" FOREIGN KEY ("edition_id") REFERENCES "summit"."commerce_edition"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "summit"."b2b_enquiry" ADD CONSTRAINT "b2b_enquiry_profile_id_sme_public_profile_id_fk" FOREIGN KEY ("profile_id") REFERENCES "summit"."sme_public_profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "summit"."b2b_enquiry" ADD CONSTRAINT "b2b_enquiry_handled_by_user_id_fk" FOREIGN KEY ("handled_by") REFERENCES "core"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "summit"."sme_public_profile" ADD CONSTRAINT "sme_public_profile_edition_id_commerce_edition_id_fk" FOREIGN KEY ("edition_id") REFERENCES "summit"."commerce_edition"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "summit"."sme_public_profile" ADD CONSTRAINT "sme_public_profile_application_id_application_id_fk" FOREIGN KEY ("application_id") REFERENCES "summit"."application"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "summit"."sme_public_profile" ADD CONSTRAINT "sme_public_profile_business_approved_by_user_id_fk" FOREIGN KEY ("business_approved_by") REFERENCES "core"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "summit"."sme_public_profile" ADD CONSTRAINT "sme_public_profile_published_by_user_id_fk" FOREIGN KEY ("published_by") REFERENCES "core"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "b2b_enquiry_profile_idx" ON "summit"."b2b_enquiry" USING btree ("profile_id","created_at");--> statement-breakpoint
CREATE INDEX "b2b_enquiry_edition_idx" ON "summit"."b2b_enquiry" USING btree ("edition_id","status");--> statement-breakpoint
CREATE INDEX "b2b_enquiry_email_idx" ON "summit"."b2b_enquiry" USING btree ("from_email","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "sme_public_profile_application_uidx" ON "summit"."sme_public_profile" USING btree ("edition_id","application_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sme_public_profile_slug_uidx" ON "summit"."sme_public_profile" USING btree ("edition_id","slug");--> statement-breakpoint
CREATE INDEX "sme_public_profile_status_idx" ON "summit"."sme_public_profile" USING btree ("edition_id","status");