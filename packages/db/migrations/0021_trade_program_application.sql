CREATE TABLE "trade"."program_application" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"program" text NOT NULL,
	"submitted_at" timestamp with time zone NOT NULL,
	"email" text NOT NULL,
	"business_name" text NOT NULL,
	"contact_name" text,
	"phone" text,
	"location" text,
	"country" text,
	"answers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "trade_program_application_response_uidx" ON "trade"."program_application" USING btree ("program","submitted_at","email");--> statement-breakpoint
CREATE INDEX "trade_program_application_country_idx" ON "trade"."program_application" USING btree ("country");