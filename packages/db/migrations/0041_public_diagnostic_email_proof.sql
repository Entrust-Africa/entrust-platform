ALTER TABLE "trade"."public_diagnostic" ADD COLUMN "email_proof_hash" text;--> statement-breakpoint
ALTER TABLE "trade"."public_diagnostic" ADD COLUMN "email_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "trade"."public_diagnostic" ADD COLUMN "user_id" text;--> statement-breakpoint
ALTER TABLE "trade"."public_diagnostic" ADD CONSTRAINT "public_diagnostic_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "core"."user"("id") ON DELETE set null ON UPDATE no action;