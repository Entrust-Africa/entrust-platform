CREATE TABLE "trade"."outcome_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"outcome_id" uuid NOT NULL,
	"organization_id" text NOT NULL,
	"actor_user_id" text,
	"previous_status" text,
	"new_status" text NOT NULL,
	"evidence_tier" text DEFAULT 'self_reported' NOT NULL,
	"evidence_url" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "trade"."outcome" ADD COLUMN "lender_name" text;--> statement-breakpoint
ALTER TABLE "trade"."outcome" ADD COLUMN "financing_type" text;--> statement-breakpoint
ALTER TABLE "trade"."outcome" ADD COLUMN "amount_requested" numeric(14, 2);--> statement-breakpoint
ALTER TABLE "trade"."outcome" ADD COLUMN "amount_approved" numeric(14, 2);--> statement-breakpoint
ALTER TABLE "trade"."outcome" ADD COLUMN "amount_disbursed" numeric(14, 2);--> statement-breakpoint
ALTER TABLE "trade"."outcome" ADD COLUMN "currency" text DEFAULT 'USD';--> statement-breakpoint
ALTER TABLE "trade"."outcome" ADD COLUMN "approval_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "trade"."outcome" ADD COLUMN "disbursement_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "trade"."outcome" ADD COLUMN "opportunity_id" uuid;--> statement-breakpoint
ALTER TABLE "trade"."outcome" ADD COLUMN "buyer_name" text;--> statement-breakpoint
ALTER TABLE "trade"."outcome" ADD COLUMN "destination_country" text;--> statement-breakpoint
ALTER TABLE "trade"."outcome" ADD COLUMN "product_description" text;--> statement-breakpoint
ALTER TABLE "trade"."outcome" ADD COLUMN "value_planned" numeric(14, 2);--> statement-breakpoint
ALTER TABLE "trade"."outcome" ADD COLUMN "value_shipped" numeric(14, 2);--> statement-breakpoint
ALTER TABLE "trade"."outcome" ADD COLUMN "value_paid" numeric(14, 2);--> statement-breakpoint
ALTER TABLE "trade"."outcome" ADD COLUMN "shipment_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "trade"."outcome" ADD COLUMN "delivery_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "trade"."outcome" ADD COLUMN "payment_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "trade"."outcome" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "trade"."outcome" ADD COLUMN "evidence_tier" text DEFAULT 'self_reported' NOT NULL;--> statement-breakpoint
ALTER TABLE "trade"."outcome" ADD COLUMN "evidence_url" text;--> statement-breakpoint
ALTER TABLE "trade"."outcome_event" ADD CONSTRAINT "outcome_event_outcome_id_outcome_id_fk" FOREIGN KEY ("outcome_id") REFERENCES "trade"."outcome"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade"."outcome_event" ADD CONSTRAINT "outcome_event_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "core"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade"."outcome_event" ADD CONSTRAINT "outcome_event_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "core"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "trade_outcome_event_outcome_idx" ON "trade"."outcome_event" USING btree ("outcome_id");--> statement-breakpoint
CREATE INDEX "trade_outcome_event_org_idx" ON "trade"."outcome_event" USING btree ("organization_id");--> statement-breakpoint
ALTER TABLE "trade"."outcome" ADD CONSTRAINT "outcome_opportunity_id_commercial_opportunity_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "trade"."commercial_opportunity"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "trade_outcome_opp_idx" ON "trade"."outcome" USING btree ("opportunity_id");