CREATE SEQUENCE "summit"."registration_number_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE TABLE "summit"."registration" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" text DEFAULT 'DTS-' || lpad(nextval('summit.registration_number_seq')::text, 5, '0') NOT NULL,
	"email" text NOT NULL,
	"full_name" text NOT NULL,
	"phone" text,
	"organisation" text NOT NULL,
	"job_title" text NOT NULL,
	"country" text NOT NULL,
	"pass" text NOT NULL,
	"notes" text,
	"consented_at" timestamp with time zone NOT NULL,
	"confirmation_sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "registration_number_unique" UNIQUE("number")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "summit_registration_email_uidx" ON "summit"."registration" USING btree ("email");--> statement-breakpoint
CREATE INDEX "summit_registration_created_idx" ON "summit"."registration" USING btree ("created_at");