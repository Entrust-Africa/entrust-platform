CREATE TABLE "mizan"."notice" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"version" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"published_by" text,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mizan"."notice" ADD CONSTRAINT "notice_published_by_user_id_fk" FOREIGN KEY ("published_by") REFERENCES "core"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "mizan_notice_kind_version_uidx" ON "mizan"."notice" USING btree ("kind","version");--> statement-breakpoint
CREATE INDEX "mizan_notice_kind_published_idx" ON "mizan"."notice" USING btree ("kind","published_at");--> statement-breakpoint
-- Written by hand: the first wording of each notice. Staff publish later wordings as new versions from MIZAN (#227).
INSERT INTO "mizan"."notice" ("kind", "version", "title", "body", "published_at") VALUES
('assessment_notice', '1.0', 'MIZAN assessment: how Entrust Africa uses your information', $notice$Entrust Africa runs MIZAN, a financial readiness assessment for small and medium businesses. Before we start your assessment, please read how we use your information.

What we collect
- Your business details: name, registration, sector, location and contact person.
- Your owners and beneficial owners: names, roles and ownership shares. We do not record identity document numbers.
- Your financial statements, such as income statements, balance sheets and cash flow figures.
- Documents you give us as evidence, such as registration papers, tax returns, bank statements, contracts and policies.

Why we collect it
- To assess your business against the MIZAN standard and give you a readiness score and level.
- To write your MIZAN report, which explains your result and what to improve.

Who sees it
- The Entrust Africa staff who assess and review your business.
- Your report is yours. Entrust Africa does not send it to lenders, investors or anyone else. You decide who you share it with.

How long we keep it
- We keep your assessment records and documents for seven years after your latest assessment, so an approved report can still be checked. Then we delete them.

Changing your mind
- You can withdraw this agreement at any time by telling your Entrust Africa contact. We then stop using your information for any new assessment work. A report already issued stays as it is, and so do the records behind it.$notice$, now()),
('platform_data', '1.0', 'Using your TRADE and CLEAR records in MIZAN', $notice$This is optional. If you agree, the Entrust Africa staff assessing your business may use what you have already given Entrust Africa in TRADE (the export readiness programme) and CLEAR (export case tracking), and may add exports of those records to your MIZAN file as evidence.

This saves you giving the same information twice. It covers your TRADE diagnostic answers, training records and passport, and your CLEAR export cases and their documents.

If you do not agree, your assessment uses only what you give us for MIZAN.

You can withdraw this permission at any time by telling your Entrust Africa contact. We then stop taking new information from TRADE and CLEAR. Anything already added to an issued report stays as it is.$notice$, now());
