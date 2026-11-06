CREATE TABLE "trade"."module_exemption" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enrollment_id" uuid NOT NULL,
	"module_id" text NOT NULL,
	"evidence_record_id" uuid NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"reason" text NOT NULL,
	"requested_by_user_id" text,
	"reviewed_by_user_id" text,
	"reviewed_at" timestamp with time zone,
	"review_comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "trade"."learning_plan" ADD COLUMN "reviewed_by_user_id" text;--> statement-breakpoint
ALTER TABLE "trade"."learning_plan" ADD COLUMN "reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "trade"."learning_plan" ADD COLUMN "review_notes" text;--> statement-breakpoint
ALTER TABLE "trade"."module_exemption" ADD CONSTRAINT "module_exemption_enrollment_id_enrollment_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "trade"."enrollment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade"."module_exemption" ADD CONSTRAINT "module_exemption_evidence_record_id_evidence_record_id_fk" FOREIGN KEY ("evidence_record_id") REFERENCES "trade"."evidence_record"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade"."module_exemption" ADD CONSTRAINT "module_exemption_requested_by_user_id_user_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "core"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade"."module_exemption" ADD CONSTRAINT "module_exemption_reviewed_by_user_id_user_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "core"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "trade_module_exemption_enrollment_idx" ON "trade"."module_exemption" USING btree ("enrollment_id");--> statement-breakpoint
CREATE INDEX "trade_module_exemption_enr_module_idx" ON "trade"."module_exemption" USING btree ("enrollment_id","module_id");--> statement-breakpoint
CREATE INDEX "trade_module_exemption_evidence_idx" ON "trade"."module_exemption" USING btree ("evidence_record_id");--> statement-breakpoint
ALTER TABLE "trade"."learning_plan" ADD CONSTRAINT "learning_plan_reviewed_by_user_id_user_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "core"."user"("id") ON DELETE set null ON UPDATE no action;