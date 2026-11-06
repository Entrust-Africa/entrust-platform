DROP INDEX "trade"."trade_capability_score_assessment_domain_uidx";--> statement-breakpoint
ALTER TABLE "trade"."capability_score" ALTER COLUMN "score" SET DATA TYPE numeric(5, 2);--> statement-breakpoint
ALTER TABLE "trade"."capability_score" ADD COLUMN "kind" text DEFAULT 'domain' NOT NULL;--> statement-breakpoint
ALTER TABLE "trade"."learning_plan" ADD COLUMN "pathway_assignment_id" uuid;--> statement-breakpoint
ALTER TABLE "trade"."learning_plan" ADD CONSTRAINT "learning_plan_pathway_assignment_id_pathway_assignment_id_fk" FOREIGN KEY ("pathway_assignment_id") REFERENCES "trade"."pathway_assignment"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "trade_capability_score_assessment_domain_uidx" ON "trade"."capability_score" USING btree ("assessment_id","kind","domain");