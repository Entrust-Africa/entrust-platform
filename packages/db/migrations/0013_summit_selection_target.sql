CREATE TABLE "summit"."selection_target" (
	"period_id" uuid PRIMARY KEY NOT NULL,
	"per_country" integer NOT NULL,
	"overrides" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "summit"."selection_target" ADD CONSTRAINT "selection_target_period_id_application_period_id_fk" FOREIGN KEY ("period_id") REFERENCES "summit"."application_period"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "summit"."selection_target" ADD CONSTRAINT "selection_target_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "core"."user"("id") ON DELETE set null ON UPDATE no action;