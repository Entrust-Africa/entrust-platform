CREATE TABLE "trade"."attendance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"status" text NOT NULL,
	"notes" text,
	"recorded_by_user_id" text,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trade"."live_session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cohort_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"module_codes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"facilitator_user_id" text,
	"start_time" timestamp with time zone NOT NULL,
	"end_time" timestamp with time zone NOT NULL,
	"venue" text,
	"recording_url" text,
	"learner_materials" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"facilitator_materials" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "trade"."cohort" ADD COLUMN "attendance_required" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "trade"."attendance" ADD CONSTRAINT "attendance_session_id_live_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "trade"."live_session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade"."attendance" ADD CONSTRAINT "attendance_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "core"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade"."attendance" ADD CONSTRAINT "attendance_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "core"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade"."attendance" ADD CONSTRAINT "attendance_recorded_by_user_id_user_id_fk" FOREIGN KEY ("recorded_by_user_id") REFERENCES "core"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade"."live_session" ADD CONSTRAINT "live_session_cohort_id_cohort_id_fk" FOREIGN KEY ("cohort_id") REFERENCES "trade"."cohort"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade"."live_session" ADD CONSTRAINT "live_session_facilitator_user_id_user_id_fk" FOREIGN KEY ("facilitator_user_id") REFERENCES "core"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "trade_attendance_session_user_uidx" ON "trade"."attendance" USING btree ("session_id","user_id");--> statement-breakpoint
CREATE INDEX "trade_attendance_org_idx" ON "trade"."attendance" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "trade_session_cohort_idx" ON "trade"."live_session" USING btree ("cohort_id");--> statement-breakpoint
CREATE INDEX "trade_session_start_idx" ON "trade"."live_session" USING btree ("start_time");