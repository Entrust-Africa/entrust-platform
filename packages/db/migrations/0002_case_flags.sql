CREATE TABLE "clear"."case_flag" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"rule" text NOT NULL,
	"severity" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"message" text NOT NULL,
	"blocks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"raised_at" timestamp with time zone DEFAULT now() NOT NULL,
	"waived_at" timestamp with time zone,
	"waived_by_user_id" text,
	"waive_reason" text,
	"resolved_at" timestamp with time zone,
	CONSTRAINT "case_flag_waiver_check" CHECK ("clear"."case_flag"."status" <> 'waived' or ("clear"."case_flag"."waive_reason" is not null and "clear"."case_flag"."waived_at" is not null)),
	CONSTRAINT "case_flag_resolved_check" CHECK (("clear"."case_flag"."status" = 'resolved') = ("clear"."case_flag"."resolved_at" is not null))
);
--> statement-breakpoint
ALTER TABLE "clear"."case_flag" ADD CONSTRAINT "case_flag_case_id_export_case_id_fk" FOREIGN KEY ("case_id") REFERENCES "clear"."export_case"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clear"."case_flag" ADD CONSTRAINT "case_flag_waived_by_user_id_user_id_fk" FOREIGN KEY ("waived_by_user_id") REFERENCES "core"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "case_flag_case_idx" ON "clear"."case_flag" USING btree ("case_id","raised_at");--> statement-breakpoint
CREATE UNIQUE INDEX "case_flag_active_uidx" ON "clear"."case_flag" USING btree ("case_id","rule") WHERE "clear"."case_flag"."status" <> 'resolved';