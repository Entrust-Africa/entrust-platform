CREATE TABLE "trade"."commercial_activity" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"opportunity_id" uuid NOT NULL,
	"organization_id" text NOT NULL,
	"actor_user_id" text,
	"type" text NOT NULL,
	"summary" text NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"follow_up_date" timestamp with time zone,
	"evidence_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "trade"."commercial_opportunity" ADD COLUMN "company_name" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "trade"."commercial_opportunity" ADD COLUMN "country" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "trade"."commercial_opportunity" ADD COLUMN "website" text;--> statement-breakpoint
ALTER TABLE "trade"."commercial_opportunity" ADD COLUMN "source_links" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "trade"."commercial_opportunity" ADD COLUMN "decision_maker_role" text;--> statement-breakpoint
ALTER TABLE "trade"."commercial_opportunity" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "trade"."commercial_opportunity" ADD COLUMN "verification_status" text DEFAULT 'unverified' NOT NULL;--> statement-breakpoint
ALTER TABLE "trade"."commercial_opportunity" ADD COLUMN "scorecard" jsonb;--> statement-breakpoint
ALTER TABLE "trade"."commercial_opportunity" ADD COLUMN "scorecard_total" integer;--> statement-breakpoint
ALTER TABLE "trade"."commercial_opportunity" ADD COLUMN "scorecard_band" text;--> statement-breakpoint
ALTER TABLE "trade"."commercial_opportunity" ADD COLUMN "stage" text DEFAULT 'lead_discovered' NOT NULL;--> statement-breakpoint
ALTER TABLE "trade"."commercial_activity" ADD CONSTRAINT "commercial_activity_opportunity_id_commercial_opportunity_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "trade"."commercial_opportunity"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade"."commercial_activity" ADD CONSTRAINT "commercial_activity_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "core"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade"."commercial_activity" ADD CONSTRAINT "commercial_activity_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "core"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "trade_activity_opportunity_idx" ON "trade"."commercial_activity" USING btree ("opportunity_id");--> statement-breakpoint
CREATE INDEX "trade_activity_org_idx" ON "trade"."commercial_activity" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "trade_opportunity_stage_idx" ON "trade"."commercial_opportunity" USING btree ("stage");