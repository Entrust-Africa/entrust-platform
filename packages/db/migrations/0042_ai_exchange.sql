CREATE TABLE "trade"."ai_exchange" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"organization_id" text,
	"module_id" text NOT NULL,
	"content_version" text NOT NULL,
	"prompt_id" text NOT NULL,
	"input" jsonb NOT NULL,
	"output" text,
	"status" text NOT NULL,
	"model" text,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"cost_usd" numeric(10, 6) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "trade"."ai_exchange" ADD CONSTRAINT "ai_exchange_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "core"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade"."ai_exchange" ADD CONSTRAINT "ai_exchange_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "core"."organization"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "trade_ai_exchange_user_created_idx" ON "trade"."ai_exchange" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "trade_ai_exchange_created_idx" ON "trade"."ai_exchange" USING btree ("created_at");