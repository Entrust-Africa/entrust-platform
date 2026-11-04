CREATE TABLE "trade"."sponsor_consent" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sponsor_organization_id" text NOT NULL,
	"sme_organization_id" text NOT NULL,
	"kind" text NOT NULL,
	"granted_by_user_id" text,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"wording_version" text NOT NULL,
	"wording" text NOT NULL,
	"withdrawn_by_user_id" text,
	"withdrawn_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "trade"."sponsor_consent" ADD CONSTRAINT "sponsor_consent_sponsor_organization_id_organization_id_fk" FOREIGN KEY ("sponsor_organization_id") REFERENCES "core"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade"."sponsor_consent" ADD CONSTRAINT "sponsor_consent_sme_organization_id_organization_id_fk" FOREIGN KEY ("sme_organization_id") REFERENCES "core"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade"."sponsor_consent" ADD CONSTRAINT "sponsor_consent_granted_by_user_id_user_id_fk" FOREIGN KEY ("granted_by_user_id") REFERENCES "core"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade"."sponsor_consent" ADD CONSTRAINT "sponsor_consent_withdrawn_by_user_id_user_id_fk" FOREIGN KEY ("withdrawn_by_user_id") REFERENCES "core"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "trade_sponsor_consent_live_uidx" ON "trade"."sponsor_consent" USING btree ("sponsor_organization_id","sme_organization_id","kind") WHERE "trade"."sponsor_consent"."withdrawn_at" is null;--> statement-breakpoint
CREATE INDEX "trade_sponsor_consent_sme_idx" ON "trade"."sponsor_consent" USING btree ("sme_organization_id");--> statement-breakpoint
CREATE INDEX "trade_sponsor_consent_sponsor_idx" ON "trade"."sponsor_consent" USING btree ("sponsor_organization_id");