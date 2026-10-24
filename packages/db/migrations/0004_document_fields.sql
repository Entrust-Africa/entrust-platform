CREATE TABLE "clear"."document_field" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"document" text NOT NULL,
	"field" text NOT NULL,
	"value" text NOT NULL,
	"entered_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "document_field_value_check" CHECK (btrim("clear"."document_field"."value") <> '')
);
--> statement-breakpoint
ALTER TABLE "clear"."document_field" ADD CONSTRAINT "document_field_case_id_export_case_id_fk" FOREIGN KEY ("case_id") REFERENCES "clear"."export_case"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clear"."document_field" ADD CONSTRAINT "document_field_entered_by_user_id_user_id_fk" FOREIGN KEY ("entered_by_user_id") REFERENCES "core"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "document_field_case_uidx" ON "clear"."document_field" USING btree ("case_id","document","field");