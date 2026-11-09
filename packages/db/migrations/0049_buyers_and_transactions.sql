CREATE TABLE "trade"."sme_buyer" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"name_key" text NOT NULL,
	"country" text DEFAULT '' NOT NULL,
	"website" text,
	"contact_name" text,
	"contact_email" text,
	"verification_status" text DEFAULT 'unverified' NOT NULL,
	"evidence_note" text,
	"status_changed_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trade"."transaction_cost" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_id" uuid NOT NULL,
	"organization_id" text NOT NULL,
	"category" text NOT NULL,
	"basis" text NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"currency" text NOT NULL,
	"note" text,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trade"."transaction_document" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_id" uuid NOT NULL,
	"organization_id" text NOT NULL,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"file_id" uuid,
	"notes" text,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trade"."transaction_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_id" uuid NOT NULL,
	"organization_id" text NOT NULL,
	"type" text NOT NULL,
	"summary" text NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" text
);
--> statement-breakpoint
ALTER TABLE "trade"."commercial_opportunity" ADD COLUMN "buyer_id" uuid;--> statement-breakpoint
ALTER TABLE "trade"."export_transaction" ADD COLUMN "buyer_id" uuid;--> statement-breakpoint
ALTER TABLE "trade"."sme_buyer" ADD CONSTRAINT "sme_buyer_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "core"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade"."sme_buyer" ADD CONSTRAINT "sme_buyer_status_changed_by_user_id_user_id_fk" FOREIGN KEY ("status_changed_by_user_id") REFERENCES "core"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade"."transaction_cost" ADD CONSTRAINT "transaction_cost_transaction_id_export_transaction_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "trade"."export_transaction"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade"."transaction_cost" ADD CONSTRAINT "transaction_cost_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "core"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade"."transaction_cost" ADD CONSTRAINT "transaction_cost_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "core"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade"."transaction_document" ADD CONSTRAINT "transaction_document_transaction_id_export_transaction_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "trade"."export_transaction"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade"."transaction_document" ADD CONSTRAINT "transaction_document_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "core"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade"."transaction_document" ADD CONSTRAINT "transaction_document_file_id_file_id_fk" FOREIGN KEY ("file_id") REFERENCES "core"."file"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade"."transaction_document" ADD CONSTRAINT "transaction_document_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "core"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade"."transaction_event" ADD CONSTRAINT "transaction_event_transaction_id_export_transaction_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "trade"."export_transaction"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade"."transaction_event" ADD CONSTRAINT "transaction_event_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "core"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade"."transaction_event" ADD CONSTRAINT "transaction_event_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "core"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "trade_sme_buyer_key_uidx" ON "trade"."sme_buyer" USING btree ("organization_id","name_key","country");--> statement-breakpoint
CREATE INDEX "trade_transaction_cost_tx_idx" ON "trade"."transaction_cost" USING btree ("transaction_id","created_at");--> statement-breakpoint
CREATE INDEX "trade_transaction_document_tx_idx" ON "trade"."transaction_document" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "trade_transaction_event_tx_idx" ON "trade"."transaction_event" USING btree ("transaction_id","occurred_at");--> statement-breakpoint
ALTER TABLE "trade"."commercial_opportunity" ADD CONSTRAINT "commercial_opportunity_buyer_id_sme_buyer_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "trade"."sme_buyer"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade"."export_transaction" ADD CONSTRAINT "export_transaction_buyer_id_sme_buyer_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "trade"."sme_buyer"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- One buyer record per business, name and country, from the opportunities already tracked. Where the same buyer appears
-- more than once, the furthest verification status wins.
INSERT INTO "trade"."sme_buyer" ("organization_id", "name", "name_key", "country", "website", "verification_status")
SELECT DISTINCT ON (o."organization_id", lower(regexp_replace(btrim(o."company_name"), '\s+', ' ', 'g')), o."country")
  o."organization_id", btrim(o."company_name"), lower(regexp_replace(btrim(o."company_name"), '\s+', ' ', 'g')), o."country", o."website", o."verification_status"
FROM "trade"."commercial_opportunity" o
WHERE btrim(o."company_name") <> ''
ORDER BY o."organization_id", lower(regexp_replace(btrim(o."company_name"), '\s+', ' ', 'g')), o."country",
  CASE o."verification_status" WHEN 'qualified_opportunity' THEN 3 WHEN 'commercially_relevant' THEN 2 WHEN 'identity_checked' THEN 1 ELSE 0 END DESC;
--> statement-breakpoint
UPDATE "trade"."commercial_opportunity" o SET "buyer_id" = b."id"
FROM "trade"."sme_buyer" b
WHERE b."organization_id" = o."organization_id" AND b."country" = o."country" AND b."name_key" = lower(regexp_replace(btrim(o."company_name"), '\s+', ' ', 'g')) AND btrim(o."company_name") <> '';
--> statement-breakpoint
INSERT INTO "trade"."sme_buyer" ("organization_id", "name", "name_key", "country")
SELECT DISTINCT ON (t."organization_id", lower(regexp_replace(btrim(t."buyer_name"), '\s+', ' ', 'g')))
  t."organization_id", btrim(t."buyer_name"), lower(regexp_replace(btrim(t."buyer_name"), '\s+', ' ', 'g')), ''
FROM "trade"."export_transaction" t
WHERE t."buyer_name" IS NOT NULL AND btrim(t."buyer_name") <> ''
  AND NOT EXISTS (SELECT 1 FROM "trade"."sme_buyer" b WHERE b."organization_id" = t."organization_id" AND b."name_key" = lower(regexp_replace(btrim(t."buyer_name"), '\s+', ' ', 'g')))
ON CONFLICT DO NOTHING;
--> statement-breakpoint
UPDATE "trade"."export_transaction" t SET "buyer_id" = (
  SELECT b."id" FROM "trade"."sme_buyer" b
  WHERE b."organization_id" = t."organization_id" AND b."name_key" = lower(regexp_replace(btrim(t."buyer_name"), '\s+', ' ', 'g'))
  ORDER BY (b."country" = '') DESC LIMIT 1)
WHERE t."buyer_name" IS NOT NULL AND btrim(t."buyer_name") <> '';
