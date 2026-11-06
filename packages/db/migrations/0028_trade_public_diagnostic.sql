CREATE TABLE "trade"."public_diagnostic" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_hash" text NOT NULL,
	"email" text NOT NULL,
	"business_name" text,
	"template_version" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"answers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"pathway" text,
	"pathway_provisional" boolean,
	"live_order" boolean,
	"rules_version" text,
	"reason_codes" jsonb,
	"signed_name" text,
	"signed_position" text,
	"signed_date" text,
	"ip_hash" text,
	"link_emailed_at" timestamp with time zone,
	"submitted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "public_diagnostic_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE INDEX "trade_public_diagnostic_email_idx" ON "trade"."public_diagnostic" USING btree ("email");--> statement-breakpoint
CREATE INDEX "trade_public_diagnostic_status_idx" ON "trade"."public_diagnostic" USING btree ("status","submitted_at");--> statement-breakpoint
CREATE INDEX "trade_public_diagnostic_created_idx" ON "trade"."public_diagnostic" USING btree ("created_at");