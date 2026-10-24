CREATE TABLE "clear"."case_amendment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"reason" text NOT NULL,
	"changes" jsonb NOT NULL,
	"impact" jsonb NOT NULL,
	"made_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	CONSTRAINT "case_amendment_version_check" CHECK ("clear"."case_amendment"."version" >= 2),
	CONSTRAINT "case_amendment_reason_check" CHECK (btrim("clear"."case_amendment"."reason") <> '')
);
--> statement-breakpoint
ALTER TABLE "clear"."case_amendment" ADD CONSTRAINT "case_amendment_case_id_export_case_id_fk" FOREIGN KEY ("case_id") REFERENCES "clear"."export_case"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clear"."case_amendment" ADD CONSTRAINT "case_amendment_made_by_user_id_user_id_fk" FOREIGN KEY ("made_by_user_id") REFERENCES "core"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "case_amendment_version_uidx" ON "clear"."case_amendment" USING btree ("case_id","version");