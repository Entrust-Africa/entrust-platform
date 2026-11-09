-- Application form 0.2.0 and rules 1.1.0 take financial records out of the ADTIS application (the partner pack says they
-- do not need to be submitted). A published form never changes and an application keeps the version it started on, so this
-- moves only what nobody has sent yet: a period whose applications are all still drafts, and those drafts. The draft's
-- answer to the dropped question (S5.2) and a choice of "financial statements" among its documents (S8.1) are removed,
-- since 0.2.0 has neither. A period with a sent application stays on 0.1.0 and 1.0.0 for an administrator to decide.
UPDATE "summit"."application_period" AS p
SET "template_version" = '0.2.0', "rules_version" = '1.1.0'
WHERE p."template_version" = '0.1.0'
  AND p."rules_version" = '1.0.0'
  AND NOT EXISTS (SELECT 1 FROM "summit"."application" AS a WHERE a."period_id" = p."id" AND a."status" <> 'draft');
--> statement-breakpoint
UPDATE "summit"."application" AS a
SET "template_version" = '0.2.0',
    "answers" = CASE
      WHEN jsonb_typeof(a."answers" -> 'S8.1') = 'array'
        THEN jsonb_set(
          a."answers" - 'S5.2',
          '{S8.1}',
          COALESCE((SELECT jsonb_agg(e) FROM jsonb_array_elements(a."answers" -> 'S8.1') AS e WHERE e <> '"financial_statements"'::jsonb), '[]'::jsonb)
        )
      ELSE a."answers" - 'S5.2'
    END
WHERE a."template_version" = '0.1.0'
  AND a."status" = 'draft'
  AND EXISTS (SELECT 1 FROM "summit"."application_period" AS p WHERE p."id" = a."period_id" AND p."template_version" = '0.2.0');
