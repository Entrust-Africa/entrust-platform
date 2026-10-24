CREATE TABLE "clear"."minimum_price" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"table_id" uuid NOT NULL,
	"effective_from" date NOT NULL,
	"effective_to" date NOT NULL,
	"coffee_type" text NOT NULL,
	"grade" text NOT NULL,
	"origin" text,
	"currency" text NOT NULL,
	"unit" text NOT NULL,
	"min_price" numeric(14, 4) NOT NULL,
	CONSTRAINT "minimum_price_dates_check" CHECK ("clear"."minimum_price"."effective_to" >= "clear"."minimum_price"."effective_from"),
	CONSTRAINT "minimum_price_amount_check" CHECK ("clear"."minimum_price"."min_price" > 0)
);
--> statement-breakpoint
CREATE TABLE "clear"."minimum_price_table" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text NOT NULL,
	"label" text,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "clear"."sales_contract" ADD COLUMN "unit_price" numeric(14, 4);--> statement-breakpoint
ALTER TABLE "clear"."sales_contract" ADD COLUMN "price_currency" text;--> statement-breakpoint
ALTER TABLE "clear"."sales_contract" ADD COLUMN "price_unit" text;--> statement-breakpoint
ALTER TABLE "clear"."sales_contract" ADD COLUMN "coffee_type" text;--> statement-breakpoint
ALTER TABLE "clear"."sales_contract" ADD COLUMN "grade" text;--> statement-breakpoint
ALTER TABLE "clear"."sales_contract" ADD COLUMN "origin" text;--> statement-breakpoint
ALTER TABLE "clear"."minimum_price" ADD CONSTRAINT "minimum_price_table_id_minimum_price_table_id_fk" FOREIGN KEY ("table_id") REFERENCES "clear"."minimum_price_table"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clear"."minimum_price_table" ADD CONSTRAINT "minimum_price_table_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "core"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "minimum_price_lookup_idx" ON "clear"."minimum_price" USING btree ("coffee_type","effective_from","effective_to");--> statement-breakpoint
CREATE INDEX "minimum_price_table_idx" ON "clear"."minimum_price" USING btree ("table_id");--> statement-breakpoint
ALTER TABLE "clear"."sales_contract" ADD CONSTRAINT "sales_contract_unit_price_check" CHECK (("clear"."sales_contract"."unit_price" is null) = ("clear"."sales_contract"."price_currency" is null) and ("clear"."sales_contract"."unit_price" is null) = ("clear"."sales_contract"."price_unit" is null) and ("clear"."sales_contract"."unit_price" is null or "clear"."sales_contract"."unit_price" > 0));