CREATE TABLE "summit"."commerce_edition" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"venue" text NOT NULL,
	"dates_note" text NOT NULL,
	"days" integer DEFAULT 3 NOT NULL,
	"expected_attendance" integer,
	"selected_smes" integer,
	"currency" text DEFAULT 'USD' NOT NULL,
	"etb_per_usd" numeric(10, 2),
	"prices_include_tax" boolean,
	"tax_note" text NOT NULL,
	"payment_methods" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"application_period_id" uuid,
	"complimentary_per_sme" integer DEFAULT 1 NOT NULL,
	"is_current" boolean DEFAULT false NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "commerce_edition_slug_unique" UNIQUE("slug"),
	CONSTRAINT "commerce_edition_complimentary_check" CHECK ("summit"."commerce_edition"."complimentary_per_sme" >= 0)
);
--> statement-breakpoint
CREATE TABLE "summit"."commerce_product" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"edition_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"price_cents" integer NOT NULL,
	"features" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"benefits" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"attributes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"capacity" integer,
	"marked_sold_out" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'published' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "commerce_product_price_check" CHECK ("summit"."commerce_product"."price_cents" >= 0),
	CONSTRAINT "commerce_product_capacity_check" CHECK ("summit"."commerce_product"."capacity" is null or "summit"."commerce_product"."capacity" >= 0)
);
--> statement-breakpoint
ALTER TABLE "summit"."commerce_edition" ADD CONSTRAINT "commerce_edition_application_period_id_application_period_id_fk" FOREIGN KEY ("application_period_id") REFERENCES "summit"."application_period"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "summit"."commerce_edition" ADD CONSTRAINT "commerce_edition_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "core"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "summit"."commerce_product" ADD CONSTRAINT "commerce_product_edition_id_commerce_edition_id_fk" FOREIGN KEY ("edition_id") REFERENCES "summit"."commerce_edition"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "commerce_edition_current_uidx" ON "summit"."commerce_edition" USING btree ("is_current") WHERE "summit"."commerce_edition"."is_current";--> statement-breakpoint
CREATE UNIQUE INDEX "commerce_product_slug_uidx" ON "summit"."commerce_product" USING btree ("edition_id","slug");--> statement-breakpoint
CREATE INDEX "commerce_product_edition_idx" ON "summit"."commerce_product" USING btree ("edition_id","kind","sort_order");