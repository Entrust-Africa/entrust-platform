CREATE SEQUENCE "summit"."delegate_number_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE TABLE "summit"."delegate_registration" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" text DEFAULT 'DEL-' || lpad(nextval('summit.delegate_number_seq')::text, 5, '0') NOT NULL,
	"edition_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"status" text DEFAULT 'registered' NOT NULL,
	"full_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"organisation" text NOT NULL,
	"job_title" text NOT NULL,
	"country" text NOT NULL,
	"sector" text,
	"needs" text,
	"application_id" uuid,
	"amount_cents" integer NOT NULL,
	"badge_token" text NOT NULL,
	"checked_in_at" timestamp with time zone,
	"checked_in_by" text,
	"confirmation_sent_at" timestamp with time zone,
	"consented_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "delegate_registration_number_unique" UNIQUE("number"),
	CONSTRAINT "delegate_registration_badge_token_unique" UNIQUE("badge_token")
);
--> statement-breakpoint
ALTER TABLE "summit"."delegate_registration" ADD CONSTRAINT "delegate_registration_edition_id_commerce_edition_id_fk" FOREIGN KEY ("edition_id") REFERENCES "summit"."commerce_edition"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "summit"."delegate_registration" ADD CONSTRAINT "delegate_registration_product_id_commerce_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "summit"."commerce_product"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "summit"."delegate_registration" ADD CONSTRAINT "delegate_registration_application_id_application_id_fk" FOREIGN KEY ("application_id") REFERENCES "summit"."application"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "summit"."delegate_registration" ADD CONSTRAINT "delegate_registration_checked_in_by_user_id_fk" FOREIGN KEY ("checked_in_by") REFERENCES "core"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "delegate_registration_email_uidx" ON "summit"."delegate_registration" USING btree ("edition_id","email") WHERE "summit"."delegate_registration"."status" = 'registered';--> statement-breakpoint
CREATE INDEX "delegate_registration_edition_idx" ON "summit"."delegate_registration" USING btree ("edition_id","status");--> statement-breakpoint
CREATE INDEX "delegate_registration_product_idx" ON "summit"."delegate_registration" USING btree ("product_id","status");--> statement-breakpoint
CREATE INDEX "delegate_registration_application_idx" ON "summit"."delegate_registration" USING btree ("application_id");