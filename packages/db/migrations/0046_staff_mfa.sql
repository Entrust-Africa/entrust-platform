CREATE TABLE "trade"."staff_mfa" (
	"user_id" text PRIMARY KEY NOT NULL,
	"secret_encrypted" text NOT NULL,
	"confirmed_at" timestamp with time zone,
	"recovery_hashes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"last_step" integer,
	"failed_attempts" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trade"."staff_mfa_session" (
	"session_id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"verified_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "trade"."staff_mfa" ADD CONSTRAINT "staff_mfa_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "core"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade"."staff_mfa_session" ADD CONSTRAINT "staff_mfa_session_session_id_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "core"."session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade"."staff_mfa_session" ADD CONSTRAINT "staff_mfa_session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "core"."user"("id") ON DELETE cascade ON UPDATE no action;