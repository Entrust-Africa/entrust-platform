CREATE TABLE "summit"."application_result" (
	"application_id" uuid PRIMARY KEY NOT NULL,
	"decision" text NOT NULL,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	"notified_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "summit"."final_list" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"period_id" uuid NOT NULL,
	"selected" integer NOT NULL,
	"waitlisted" integer NOT NULL,
	"not_selected" integer NOT NULL,
	"note" text,
	"approved_by" text,
	"approved_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "final_list_period_id_unique" UNIQUE("period_id")
);
--> statement-breakpoint
ALTER TABLE "summit"."application_result" ADD CONSTRAINT "application_result_application_id_application_id_fk" FOREIGN KEY ("application_id") REFERENCES "summit"."application"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "summit"."final_list" ADD CONSTRAINT "final_list_period_id_application_period_id_fk" FOREIGN KEY ("period_id") REFERENCES "summit"."application_period"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "summit"."final_list" ADD CONSTRAINT "final_list_approved_by_user_id_fk" FOREIGN KEY ("approved_by") REFERENCES "core"."user"("id") ON DELETE set null ON UPDATE no action;