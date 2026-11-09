CREATE TABLE "trade"."cohort_staff" (
	"cohort_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"assigned_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cohort_staff_cohort_id_user_id_pk" PRIMARY KEY("cohort_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "trade"."cohort_staff" ADD CONSTRAINT "cohort_staff_cohort_id_cohort_id_fk" FOREIGN KEY ("cohort_id") REFERENCES "trade"."cohort"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade"."cohort_staff" ADD CONSTRAINT "cohort_staff_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "core"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade"."cohort_staff" ADD CONSTRAINT "cohort_staff_assigned_by_user_id_user_id_fk" FOREIGN KEY ("assigned_by_user_id") REFERENCES "core"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "trade_cohort_staff_user_idx" ON "trade"."cohort_staff" USING btree ("user_id");