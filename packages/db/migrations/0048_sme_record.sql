CREATE TABLE "trade"."pathway_review" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enrollment_id" uuid NOT NULL,
	"export_history_id" uuid,
	"status" text DEFAULT 'open' NOT NULL,
	"resolved_by_user_id" text,
	"resolved_at" timestamp with time zone,
	"resolution" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trade"."sme_export_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"transaction_id" uuid,
	"product" text NOT NULL,
	"destination" text,
	"buyer_name" text,
	"shipment_date" date,
	"evidence_status" text DEFAULT 'self_reported' NOT NULL,
	"evidence_note" text,
	"recorded_by_user_id" text,
	"status_changed_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sme_export_history_transaction_id_unique" UNIQUE("transaction_id")
);
--> statement-breakpoint
CREATE TABLE "trade"."sme_product" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"category" text,
	"hs_code" text,
	"archived_at" timestamp with time zone,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trade"."sme_profile_change" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"changed_by_user_id" text,
	"field" text NOT NULL,
	"old_value" text,
	"new_value" text,
	"material" boolean DEFAULT false NOT NULL,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "trade"."pathway_review" ADD CONSTRAINT "pathway_review_enrollment_id_enrollment_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "trade"."enrollment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade"."pathway_review" ADD CONSTRAINT "pathway_review_export_history_id_sme_export_history_id_fk" FOREIGN KEY ("export_history_id") REFERENCES "trade"."sme_export_history"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade"."pathway_review" ADD CONSTRAINT "pathway_review_resolved_by_user_id_user_id_fk" FOREIGN KEY ("resolved_by_user_id") REFERENCES "core"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade"."sme_export_history" ADD CONSTRAINT "sme_export_history_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "core"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade"."sme_export_history" ADD CONSTRAINT "sme_export_history_transaction_id_export_transaction_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "trade"."export_transaction"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade"."sme_export_history" ADD CONSTRAINT "sme_export_history_recorded_by_user_id_user_id_fk" FOREIGN KEY ("recorded_by_user_id") REFERENCES "core"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade"."sme_export_history" ADD CONSTRAINT "sme_export_history_status_changed_by_user_id_user_id_fk" FOREIGN KEY ("status_changed_by_user_id") REFERENCES "core"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade"."sme_product" ADD CONSTRAINT "sme_product_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "core"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade"."sme_product" ADD CONSTRAINT "sme_product_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "core"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade"."sme_profile_change" ADD CONSTRAINT "sme_profile_change_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "core"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade"."sme_profile_change" ADD CONSTRAINT "sme_profile_change_changed_by_user_id_user_id_fk" FOREIGN KEY ("changed_by_user_id") REFERENCES "core"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "trade_pathway_review_enrollment_idx" ON "trade"."pathway_review" USING btree ("enrollment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "trade_pathway_review_open_uidx" ON "trade"."pathway_review" USING btree ("enrollment_id") WHERE "trade"."pathway_review"."status" = 'open';--> statement-breakpoint
CREATE INDEX "trade_export_history_org_idx" ON "trade"."sme_export_history" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "trade_sme_product_org_idx" ON "trade"."sme_product" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "trade_sme_profile_change_org_idx" ON "trade"."sme_profile_change" USING btree ("organization_id","changed_at");