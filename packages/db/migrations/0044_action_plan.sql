CREATE TABLE "trade"."action_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"description" text NOT NULL,
	"priority" text,
	"responsible" text NOT NULL,
	"start_date" date,
	"due_date" date,
	"resources" text,
	"expected_result" text,
	"performance_indicator" text,
	"status" text DEFAULT 'not_started' NOT NULL,
	"evidence" text,
	"review_comments" text,
	"milestone" integer DEFAULT 90 NOT NULL,
	"source_worksheet_version_id" uuid,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trade"."action_review" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"day" integer NOT NULL,
	"answers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "trade"."action_item" ADD CONSTRAINT "action_item_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "core"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade"."action_item" ADD CONSTRAINT "action_item_source_worksheet_version_id_worksheet_version_id_fk" FOREIGN KEY ("source_worksheet_version_id") REFERENCES "trade"."worksheet_version"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade"."action_item" ADD CONSTRAINT "action_item_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "core"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade"."action_review" ADD CONSTRAINT "action_review_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "core"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade"."action_review" ADD CONSTRAINT "action_review_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "core"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "trade_action_item_org_idx" ON "trade"."action_item" USING btree ("organization_id","milestone");--> statement-breakpoint
CREATE INDEX "trade_action_review_org_idx" ON "trade"."action_review" USING btree ("organization_id","created_at");