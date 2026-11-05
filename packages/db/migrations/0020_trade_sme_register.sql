CREATE TABLE "trade"."sme_register" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"company_name" text NOT NULL,
	"participant_name" text,
	"phone" text,
	"email" text,
	"year_established" integer,
	"location" text,
	"employees" integer,
	"export_licence" boolean,
	"current_bank" text,
	"main_product" text,
	"monthly_production_capacity" numeric(16, 2),
	"average_monthly_revenue" numeric(16, 2),
	"largest_order_completed" numeric(16, 2),
	"current_markets" text,
	"target_export_market" text,
	"monthly_operating_cost" numeric(16, 2),
	"estimated_monthly_profit" numeric(16, 2),
	"existing_loan" boolean,
	"loan_amount" numeric(16, 2),
	"cashflow_stability" text,
	"working_capital_gap" numeric(16, 2),
	"equipment_investment_needed" numeric(16, 2),
	"export_logistics_gap" numeric(16, 2),
	"costing_knowledge" integer,
	"production_capacity_strength" integer,
	"documentation_knowledge" integer,
	"financial_record_keeping" integer,
	"market_readiness" integer,
	"entrust_support_needed" text,
	"bank_opportunity" text,
	"service_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trade_sme_register_scores_ck" CHECK (("trade"."sme_register"."costing_knowledge" is null or "trade"."sme_register"."costing_knowledge" between 1 and 5)
        and ("trade"."sme_register"."production_capacity_strength" is null or "trade"."sme_register"."production_capacity_strength" between 1 and 5)
        and ("trade"."sme_register"."documentation_knowledge" is null or "trade"."sme_register"."documentation_knowledge" between 1 and 5)
        and ("trade"."sme_register"."financial_record_keeping" is null or "trade"."sme_register"."financial_record_keeping" between 1 and 5)
        and ("trade"."sme_register"."market_readiness" is null or "trade"."sme_register"."market_readiness" between 1 and 5))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "trade_sme_register_code_uidx" ON "trade"."sme_register" USING btree ("code");