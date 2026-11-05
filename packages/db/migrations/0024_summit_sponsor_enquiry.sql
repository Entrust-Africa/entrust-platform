CREATE SEQUENCE "summit"."sponsor_enquiry_number_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE TABLE "summit"."sponsor_enquiry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" text DEFAULT 'SPN-' || lpad(nextval('summit.sponsor_enquiry_number_seq')::text, 4, '0') NOT NULL,
	"edition_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"organisation_name" text NOT NULL,
	"country" text NOT NULL,
	"contact_name" text NOT NULL,
	"position" text NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"sector" text NOT NULL,
	"objectives" text NOT NULL,
	"requirements" text,
	"value_cents" integer NOT NULL,
	"notes" text,
	"status_changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"receipt_sent_at" timestamp with time zone,
	"consented_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sponsor_enquiry_number_unique" UNIQUE("number"),
	CONSTRAINT "sponsor_enquiry_value_check" CHECK ("summit"."sponsor_enquiry"."value_cents" >= 0)
);
--> statement-breakpoint
ALTER TABLE "summit"."sponsor_enquiry" ADD CONSTRAINT "sponsor_enquiry_edition_id_commerce_edition_id_fk" FOREIGN KEY ("edition_id") REFERENCES "summit"."commerce_edition"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "summit"."sponsor_enquiry" ADD CONSTRAINT "sponsor_enquiry_product_id_commerce_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "summit"."commerce_product"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sponsor_enquiry_edition_idx" ON "summit"."sponsor_enquiry" USING btree ("edition_id","status");--> statement-breakpoint
CREATE INDEX "sponsor_enquiry_product_idx" ON "summit"."sponsor_enquiry" USING btree ("product_id","status");--> statement-breakpoint
CREATE INDEX "sponsor_enquiry_email_idx" ON "summit"."sponsor_enquiry" USING btree ("email");