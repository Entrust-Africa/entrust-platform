CREATE TABLE "trade"."action_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"action_item_id" uuid NOT NULL,
	"file_id" uuid NOT NULL,
	"description" text,
	"submitted_by_user_id" text,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trade"."learning_resource" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"module_id" text NOT NULL,
	"lesson_id" text,
	"name" text NOT NULL,
	"file_id" uuid NOT NULL,
	"resource_type" text DEFAULT 'other' NOT NULL,
	"version" text DEFAULT '1.0.0' NOT NULL,
	"access_level" text DEFAULT 'learner' NOT NULL,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "trade"."worksheet_attachment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"worksheet_version_id" uuid NOT NULL,
	"file_id" uuid NOT NULL,
	"description" text,
	"attached_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trade"."worksheet_version_review" (
	"worksheet_version_id" uuid PRIMARY KEY NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"reviewer_user_id" text,
	"comments" text,
	"reviewed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "trade"."action_evidence" ADD CONSTRAINT "action_evidence_action_item_id_action_item_id_fk" FOREIGN KEY ("action_item_id") REFERENCES "trade"."action_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade"."action_evidence" ADD CONSTRAINT "action_evidence_file_id_file_id_fk" FOREIGN KEY ("file_id") REFERENCES "core"."file"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade"."action_evidence" ADD CONSTRAINT "action_evidence_submitted_by_user_id_user_id_fk" FOREIGN KEY ("submitted_by_user_id") REFERENCES "core"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade"."learning_resource" ADD CONSTRAINT "learning_resource_file_id_file_id_fk" FOREIGN KEY ("file_id") REFERENCES "core"."file"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade"."learning_resource" ADD CONSTRAINT "learning_resource_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "core"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade"."worksheet_attachment" ADD CONSTRAINT "worksheet_attachment_worksheet_version_id_worksheet_version_id_fk" FOREIGN KEY ("worksheet_version_id") REFERENCES "trade"."worksheet_version"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade"."worksheet_attachment" ADD CONSTRAINT "worksheet_attachment_file_id_file_id_fk" FOREIGN KEY ("file_id") REFERENCES "core"."file"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade"."worksheet_attachment" ADD CONSTRAINT "worksheet_attachment_attached_by_user_id_user_id_fk" FOREIGN KEY ("attached_by_user_id") REFERENCES "core"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade"."worksheet_version_review" ADD CONSTRAINT "worksheet_version_review_worksheet_version_id_worksheet_version_id_fk" FOREIGN KEY ("worksheet_version_id") REFERENCES "trade"."worksheet_version"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade"."worksheet_version_review" ADD CONSTRAINT "worksheet_version_review_reviewer_user_id_user_id_fk" FOREIGN KEY ("reviewer_user_id") REFERENCES "core"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "trade_action_evidence_item_idx" ON "trade"."action_evidence" USING btree ("action_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "trade_action_evidence_file_uidx" ON "trade"."action_evidence" USING btree ("action_item_id","file_id");--> statement-breakpoint
CREATE INDEX "trade_learning_resource_module_idx" ON "trade"."learning_resource" USING btree ("module_id");--> statement-breakpoint
CREATE INDEX "trade_worksheet_attachment_version_idx" ON "trade"."worksheet_attachment" USING btree ("worksheet_version_id");--> statement-breakpoint
CREATE UNIQUE INDEX "trade_worksheet_attachment_file_uidx" ON "trade"."worksheet_attachment" USING btree ("worksheet_version_id","file_id");