CREATE SEQUENCE "summit"."exhibitor_booking_number_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE TABLE "summit"."commerce_payment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"edition_id" uuid NOT NULL,
	"subject_type" text NOT NULL,
	"subject_id" uuid NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"amount_due_cents" integer NOT NULL,
	"amount_received_cents" integer,
	"method" text,
	"reference" text,
	"evidence_file_id" uuid,
	"note" text,
	"verified_by" text,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "commerce_payment_amounts_check" CHECK ("summit"."commerce_payment"."amount_due_cents" >= 0 and ("summit"."commerce_payment"."amount_received_cents" is null or "summit"."commerce_payment"."amount_received_cents" >= 0))
);
--> statement-breakpoint
CREATE TABLE "summit"."exhibitor_booking" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" text DEFAULT 'EXH-' || lpad(nextval('summit.exhibitor_booking_number_seq')::text, 4, '0') NOT NULL,
	"edition_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"status" text DEFAULT 'submitted' NOT NULL,
	"company_name" text NOT NULL,
	"country" text NOT NULL,
	"registration_details" text NOT NULL,
	"contact_name" text NOT NULL,
	"position" text NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"sector" text NOT NULL,
	"products_services" text NOT NULL,
	"website" text,
	"preferred_zone" text,
	"booth_requirements" text,
	"comments" text,
	"amount_cents" integer NOT NULL,
	"booth_number" text,
	"zone" text,
	"decided_by" text,
	"decided_at" timestamp with time zone,
	"decision_note" text,
	"confirmed_at" timestamp with time zone,
	"receipt_sent_at" timestamp with time zone,
	"consented_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "exhibitor_booking_number_unique" UNIQUE("number")
);
--> statement-breakpoint
ALTER TABLE "summit"."commerce_edition" ADD COLUMN "exhibition_zones" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "summit"."commerce_payment" ADD CONSTRAINT "commerce_payment_edition_id_commerce_edition_id_fk" FOREIGN KEY ("edition_id") REFERENCES "summit"."commerce_edition"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "summit"."commerce_payment" ADD CONSTRAINT "commerce_payment_evidence_file_id_file_id_fk" FOREIGN KEY ("evidence_file_id") REFERENCES "core"."file"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "summit"."commerce_payment" ADD CONSTRAINT "commerce_payment_verified_by_user_id_fk" FOREIGN KEY ("verified_by") REFERENCES "core"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "summit"."exhibitor_booking" ADD CONSTRAINT "exhibitor_booking_edition_id_commerce_edition_id_fk" FOREIGN KEY ("edition_id") REFERENCES "summit"."commerce_edition"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "summit"."exhibitor_booking" ADD CONSTRAINT "exhibitor_booking_product_id_commerce_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "summit"."commerce_product"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "summit"."exhibitor_booking" ADD CONSTRAINT "exhibitor_booking_decided_by_user_id_fk" FOREIGN KEY ("decided_by") REFERENCES "core"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "commerce_payment_subject_uidx" ON "summit"."commerce_payment" USING btree ("subject_type","subject_id");--> statement-breakpoint
CREATE INDEX "commerce_payment_edition_idx" ON "summit"."commerce_payment" USING btree ("edition_id","status");--> statement-breakpoint
CREATE INDEX "exhibitor_booking_edition_idx" ON "summit"."exhibitor_booking" USING btree ("edition_id","status");--> statement-breakpoint
CREATE INDEX "exhibitor_booking_product_idx" ON "summit"."exhibitor_booking" USING btree ("product_id","status");--> statement-breakpoint
CREATE INDEX "exhibitor_booking_email_idx" ON "summit"."exhibitor_booking" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "exhibitor_booking_booth_uidx" ON "summit"."exhibitor_booking" USING btree ("edition_id","booth_number") WHERE "summit"."exhibitor_booking"."booth_number" is not null and "summit"."exhibitor_booking"."status" in ('approved', 'confirmed');