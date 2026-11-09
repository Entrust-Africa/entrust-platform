CREATE TABLE "trade"."integration_record" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"provider" text NOT NULL,
	"external_reference" text,
	"record_type" text NOT NULL,
	"sync_status" text DEFAULT 'pending' NOT NULL,
	"last_sync_at" timestamp with time zone,
	"error_code" text,
	"error_description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trade"."partner_referral" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"destination_name" text NOT NULL,
	"destination_type" text NOT NULL,
	"reason" text NOT NULL,
	"shared_data_kinds" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"consent_status" text DEFAULT 'not_requested' NOT NULL,
	"consent_at" timestamp with time zone,
	"consent_by_user_id" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"referral_date" date,
	"responsible_user_id" text,
	"outcome" text,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trade"."partner_referral_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"referral_id" uuid NOT NULL,
	"type" text NOT NULL,
	"note" text,
	"detail" jsonb,
	"actor_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "trade"."integration_record" ADD CONSTRAINT "integration_record_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "core"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade"."partner_referral" ADD CONSTRAINT "partner_referral_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "core"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade"."partner_referral" ADD CONSTRAINT "partner_referral_consent_by_user_id_user_id_fk" FOREIGN KEY ("consent_by_user_id") REFERENCES "core"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade"."partner_referral" ADD CONSTRAINT "partner_referral_responsible_user_id_user_id_fk" FOREIGN KEY ("responsible_user_id") REFERENCES "core"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade"."partner_referral" ADD CONSTRAINT "partner_referral_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "core"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade"."partner_referral_event" ADD CONSTRAINT "partner_referral_event_referral_id_partner_referral_id_fk" FOREIGN KEY ("referral_id") REFERENCES "trade"."partner_referral"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade"."partner_referral_event" ADD CONSTRAINT "partner_referral_event_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "core"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "trade_integration_record_org_idx" ON "trade"."integration_record" USING btree ("organization_id","provider");--> statement-breakpoint
CREATE INDEX "trade_partner_referral_org_idx" ON "trade"."partner_referral" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "trade_partner_referral_event_idx" ON "trade"."partner_referral_event" USING btree ("referral_id","created_at");