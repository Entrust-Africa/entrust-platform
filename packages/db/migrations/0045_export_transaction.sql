CREATE TABLE "trade"."export_transaction" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"reference" text NOT NULL,
	"is_practice" boolean DEFAULT false NOT NULL,
	"stage" text DEFAULT 'enquiry' NOT NULL,
	"product" text NOT NULL,
	"destination" text,
	"quantity" text,
	"buyer_name" text,
	"buyer_status" text,
	"order_document" text,
	"agreed_price" text,
	"currency" text,
	"incoterm" text,
	"named_place" text,
	"costing_and_margin" text,
	"payment_terms" text,
	"payment_risk" text,
	"production_status" text,
	"document_checklist" text,
	"logistics" text,
	"customs_status" text,
	"insurance_status" text,
	"exceptions" text,
	"outstanding_actions" text,
	"responsible" text,
	"payment_status" text,
	"actual_costs" text,
	"closeout" text,
	"clear_case_id" uuid,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "export_transaction_reference_unique" UNIQUE("reference")
);
--> statement-breakpoint
ALTER TABLE "trade"."export_transaction" ADD CONSTRAINT "export_transaction_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "core"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade"."export_transaction" ADD CONSTRAINT "export_transaction_clear_case_id_export_case_id_fk" FOREIGN KEY ("clear_case_id") REFERENCES "clear"."export_case"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade"."export_transaction" ADD CONSTRAINT "export_transaction_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "core"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "trade_export_transaction_org_idx" ON "trade"."export_transaction" USING btree ("organization_id","created_at");