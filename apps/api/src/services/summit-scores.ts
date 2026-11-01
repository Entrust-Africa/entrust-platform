import { asc, inArray } from "drizzle-orm";
import { schema } from "@entrust/db";
import { applicationPathway, applicationSeeksInvestment, scoreApplication, type OpportunityPathway, type ScoreResult, type SummitRules } from "@entrust/summit-engine";
import type { Executor } from "./db";
import { rulesOf, templateOf } from "./summit-applications";

// An application's score as it stands now, for the lists and dashboards that need many at once. It is worked out from
// the stored points, the manual adjustments and the rules version the assessment was made under, the same way the
// officer's workspace shows it.

type PeriodRow = typeof schema.applicationPeriod.$inferSelect;
type ApplicationRow = typeof schema.application.$inferSelect;

export interface Scored {
  /** Absent until the first score or note is recorded. */
  assessment: typeof schema.assessment.$inferSelect | undefined;
  rules: SummitRules;
  pathway: OpportunityPathway | null;
  /** Null when the applicant never chose a pathway. */
  result: ScoreResult | null;
  /** Manual adjustments made to the scores. */
  adjustments: number;
}

export async function scoreApplications(
  db: Executor,
  period: Pick<PeriodRow, "rulesVersion">,
  rows: readonly Pick<ApplicationRow, "id" | "templateVersion" | "answers">[],
): Promise<Map<string, Scored>> {
  const scored = new Map<string, Scored>();
  if (rows.length === 0) return scored;

  const assessments = await db.select().from(schema.assessment).where(inArray(schema.assessment.applicationId, rows.map((r) => r.id)));
  const assessmentIds = assessments.map((a) => a.id);
  const [scores, adjustments] = assessmentIds.length
    ? await Promise.all([
        db.select().from(schema.criterionScore).where(inArray(schema.criterionScore.assessmentId, assessmentIds)),
        db.select().from(schema.scoreAdjustment).where(inArray(schema.scoreAdjustment.assessmentId, assessmentIds)).orderBy(asc(schema.scoreAdjustment.adjustedAt)),
      ])
    : [[], []];
  const assessmentOf = new Map(assessments.map((a) => [a.applicationId, a]));

  for (const row of rows) {
    const template = templateOf(row.templateVersion);
    const assessment = assessmentOf.get(row.id);
    const rules = rulesOf(assessment?.rulesVersion ?? period.rulesVersion);
    const pathway = assessment?.pathway ?? applicationPathway(template, row.answers) ?? null;

    const effective: Record<string, number> = {};
    let adjusted = 0;
    if (assessment) {
      for (const s of scores) if (s.assessmentId === assessment.id) effective[s.criterionId] = s.points;
      // Oldest first, so the newest adjustment of a criterion is the one that counts.
      for (const a of adjustments) {
        if (a.assessmentId !== assessment.id) continue;
        effective[a.criterionId] = a.newPoints;
        adjusted += 1;
      }
    }
    const result = pathway
      ? scoreApplication(rules, {
          pathway,
          seekingInvestment: assessment?.seekingInvestment ?? applicationSeeksInvestment(template, row.answers),
          scores: effective,
        })
      : null;
    scored.set(row.id, { assessment, rules, pathway, result, adjustments: adjusted });
  }
  return scored;
}
