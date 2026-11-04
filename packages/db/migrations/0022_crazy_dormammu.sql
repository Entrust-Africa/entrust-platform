ALTER TABLE "core"."sme_profile" ADD COLUMN "trading_name" text;--> statement-breakpoint
ALTER TABLE "core"."sme_profile" ADD COLUMN "registration_number" text;--> statement-breakpoint
ALTER TABLE "core"."sme_profile" ADD COLUMN "registration_status" text DEFAULT 'registered' NOT NULL;--> statement-breakpoint
ALTER TABLE "core"."sme_profile" ADD COLUMN "business_status" text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "core"."sme_profile" ADD COLUMN "sector" text;--> statement-breakpoint
ALTER TABLE "core"."sme_profile" ADD COLUMN "merged_into_sme_id" text;--> statement-breakpoint
CREATE UNIQUE INDEX "sme_profile_reg_country_uidx" ON "core"."sme_profile" USING btree ("registration_number","country") WHERE registration_number is not null;--> statement-breakpoint
CREATE INDEX "sme_profile_merged_into_idx" ON "core"."sme_profile" USING btree ("merged_into_sme_id");