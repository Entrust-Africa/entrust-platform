import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { schema } from "@entrust/db";
import {
  MODULE_STATUS_LABELS,
  PATHWAY_NAMES,
  REVIEW_NOTES,
  buildPlacementReport,
  evaluatePlacement,
  scoreDomains,
  visibleQuestions,
  type Answer,
  type Answers,
  type LearningPlan,
  type PathwayAssignment,
  type PlacementOutcome,
  type PlacementReport,
  type ReviewReason,
  type ScoreResult,
} from "@entrust/trade-engine";
import { findTradeRules, type ReasonCode, type TradeRules } from "@entrust/trade-rules";
import type { LearningPlanView, PlacementReportView, PlacementResults } from "../schemas/trade";
import type { Ctx } from "./access";
import type { Executor } from "./db";
import { ServiceError } from "./errors";
import { accessTo, recordTradeChange, unwrapAnswer } from "./trade-shared";

// What happens when a placement assessment is submitted (#58): the engine scores the six domains and the eight trigger
// groups and builds the learning plan from them and the avenue the diagnostic gave. The scores, the plan and its
// module assignments are stored with the rules version, and the assessment becomes scored, or review_required when the
// engine finds something for staff to look at. Nothing here calculates: it runs the engine, stores what it returns and
// reads it back. The same answers, approvals, avenue and rules version always give the same result, so a stored result
// can be reproduced (and the report is rebuilt that way).

type AssessmentRow = typeof schema.tradeAssessment.$inferSelect;
type PlanRow = typeof schema.learningPlan.$inferSelect;
type PathwayRow = typeof schema.pathwayAssignment.$inferSelect;

/** The placement statuses that mean the answers are in and locked. */
const LOCKED = ["submitted", "scored", "review_required"] as const;

const rulesFor = (version: string): TradeRules => {
  const rules = findTradeRules(version);
  if (!rules) throw new ServiceError("not_found", `There are no TRADE rules for version ${version}.`);
  return rules;
};

// ---- Inputs ----

/** The answers the engine scores: the visible questions' answers, with "not applicable" and "not known" as the engine spells them. */
async function inputsOf(tx: Executor, rules: TradeRules, assessmentId: string): Promise<{ answers: Answers; approvedNotApplicable: string[] }> {
  const rows = await tx.select().from(schema.assessmentResponse).where(eq(schema.assessmentResponse.assessmentId, assessmentId));
  const given: Record<string, Answer> = {};
  const approved = new Set<string>();
  for (const r of rows) {
    const answer = r.unscored ?? unwrapAnswer(r.answer);
    if (answer === null || answer === undefined) continue;
    given[r.questionId] = answer as Answer;
    if (r.unscored === "not_applicable" && r.approvedAt !== null) approved.add(r.questionId);
  }
  // A question the answers no longer ask (its parent answer changed) is not scored and not reported.
  const shown = new Set(visibleQuestions(rules, given).map((q) => q.id));
  const answers = Object.fromEntries(Object.entries(given).filter(([id]) => shown.has(id)));
  return { answers, approvedNotApplicable: [...approved].filter((id) => shown.has(id)) };
}

const assignmentOf = (row: PathwayRow, rulesVersion: string): PathwayAssignment => ({
  // The avenue is decided once by the diagnostic, so a plan made with later rules carries it over under those rules.
  rulesVersion,
  pathway: row.pathway,
  provisional: row.status === "provisional",
  liveOrder: row.liveOrder,
  reasonCodes: row.reasonCodes as ReasonCode[],
});

async function liveAvenue(tx: Executor, enrollmentId: string): Promise<PathwayRow | null> {
  const [row] = await tx
    .select()
    .from(schema.pathwayAssignment)
    .where(and(eq(schema.pathwayAssignment.enrollmentId, enrollmentId), inArray(schema.pathwayAssignment.status, ["provisional", "confirmed"])))
    .limit(1);
  return row ?? null;
}

/** Whether the enrolment has an avenue yet. The placement assessment builds on it, so it can't be submitted before. */
export async function requireAvenue(tx: Executor, enrollmentId: string): Promise<void> {
  if (!(await liveAvenue(tx, enrollmentId))) {
    throw new ServiceError(
      "precondition_failed",
      "The onboarding diagnostic isn't submitted yet. It decides which avenue you are on, and the placement assessment builds on it. Finish the diagnostic first.",
    );
  }
}

// ---- Scoring ----

export type ScoringTrigger = "submitted" | "approval" | "avenue";

const scoreRow = (assessmentId: string, kind: "domain" | "group", r: ScoreResult) => ({
  assessmentId,
  kind,
  domain: r.id,
  points: r.points,
  maxPoints: r.maxPoints,
  coverage: r.coverage.toFixed(4),
  score: r.score === null ? null : r.score.toFixed(2),
  band: r.band,
  evidenceStatus: r.evidence,
});

/**
 * Scores a submitted placement assessment, builds its plan and stores both, in the caller's transaction. A plan the
 * enrolment had is superseded and kept; the assessment's scores are replaced, since they follow its answers and
 * approvals. Returns the status the assessment now has.
 */
export async function scorePlacement(
  tx: Executor,
  ctx: Pick<Ctx, "principal" | "now">,
  assessment: Pick<AssessmentRow, "id" | "enrollmentId" | "templateVersion">,
  organizationId: string,
  trigger: ScoringTrigger,
): Promise<PlacementOutcome["assessmentStatus"]> {
  const rules = rulesFor(assessment.templateVersion);
  const avenue = await liveAvenue(tx, assessment.enrollmentId);
  if (!avenue) throw new ServiceError("precondition_failed", "This enrolment has no avenue yet, so there is nothing to build a plan on.");
  const { answers, approvedNotApplicable } = await inputsOf(tx, rules, assessment.id);
  const outcome = evaluatePlacement(rules, { answers, pathway: assignmentOf(avenue, rules.version), approvedNotApplicable });

  await tx.delete(schema.capabilityScore).where(eq(schema.capabilityScore.assessmentId, assessment.id));
  await tx.insert(schema.capabilityScore).values([
    ...outcome.scores.domains.map((r) => scoreRow(assessment.id, "domain", r)),
    ...outcome.scores.groups.map((r) => scoreRow(assessment.id, "group", r)),
  ]);

  // One live plan per enrolment: the old one gives way first.
  const [old] = await tx
    .select()
    .from(schema.learningPlan)
    .where(and(eq(schema.learningPlan.enrollmentId, assessment.enrollmentId), inArray(schema.learningPlan.status, ["generated", "review_required", "approved", "active", "completed"])));
  if (old) await tx.update(schema.learningPlan).set({ status: "superseded", supersededAt: ctx.now }).where(eq(schema.learningPlan.id, old.id));
  const [plan] = await tx
    .insert(schema.learningPlan)
    .values({
      enrollmentId: assessment.enrollmentId,
      assessmentId: assessment.id,
      rulesVersion: outcome.rulesVersion,
      pathway: outcome.plan.pathway,
      pathwayAssignmentId: avenue.id,
      status: outcome.planStatus,
      requiresHumanReview: outcome.plan.requiresHumanReview,
      reviewReasons: [...outcome.plan.reviewReasons],
    })
    .returning();
  if (!plan) throw new Error("The learning plan was not created");
  if (old) await tx.update(schema.learningPlan).set({ supersededById: plan.id }).where(eq(schema.learningPlan.id, old.id));
  await tx.insert(schema.moduleAssignment).values(
    outcome.plan.modules.map((m) => ({ planId: plan.id, moduleId: m.module, status: m.status, sequence: m.sequence, reasonCodes: [...m.reasonCodes], source: "engine" as const })),
  );

  await tx.update(schema.tradeAssessment).set({ status: outcome.assessmentStatus }).where(eq(schema.tradeAssessment.id, assessment.id));
  await recordTradeChange(tx, ctx.principal.userId, {
    action: "trade.placement.scored",
    organizationId,
    entityId: assessment.id,
    after: {
      trigger,
      status: outcome.assessmentStatus,
      planId: plan.id,
      planStatus: outcome.planStatus,
      rulesVersion: outcome.rulesVersion,
      pathway: outcome.plan.pathway,
      reviewReasons: outcome.plan.reviewReasons,
      modules: outcome.plan.modules.map((m) => `${m.sequence}. ${m.module} (${m.status})`),
    },
  });
  return outcome.assessmentStatus;
}

/**
 * Scores a submitted exit assessment in the caller's transaction.
 * Exit assessment evaluates domain capability post-program, writes scores to capabilityScore,
 * and crucially NEVER modifies the learning plan (#71).
 */
export async function scoreExit(
  tx: Executor,
  ctx: Pick<Ctx, "principal" | "now">,
  assessment: Pick<AssessmentRow, "id" | "enrollmentId" | "templateVersion">,
  organizationId: string,
): Promise<PlacementOutcome["assessmentStatus"]> {
  const rules = rulesFor(assessment.templateVersion);
  const { answers, approvedNotApplicable } = await inputsOf(tx, rules, assessment.id);
  const outcome = scoreDomains(rules, { answers, approvedNotApplicable });

  await tx.delete(schema.capabilityScore).where(eq(schema.capabilityScore.assessmentId, assessment.id));
  await tx.insert(schema.capabilityScore).values(
    outcome.domains.map((r) => scoreRow(assessment.id, "domain", r)),
  );

  await tx.update(schema.tradeAssessment).set({ status: "scored" }).where(eq(schema.tradeAssessment.id, assessment.id));
  await recordTradeChange(tx, ctx.principal.userId, {
    action: "trade.assessment.scored",
    organizationId,
    entityId: assessment.id,
    after: { kind: "exit", rulesVersion: rules.version },
  });

  return "scored";
}

/**
 * The avenue or an approval changed: scores and plan are made again for the enrolment's placement assessment, if it has
 * a submitted one. A plan that waited for staff to confirm the avenue is ready once they have.
 */
export async function rescoreLivePlacement(tx: Executor, ctx: Pick<Ctx, "principal" | "now">, enrollmentId: string, organizationId: string, trigger: ScoringTrigger): Promise<void> {
  const [live] = await tx
    .select()
    .from(schema.tradeAssessment)
    .where(and(eq(schema.tradeAssessment.enrollmentId, enrollmentId), eq(schema.tradeAssessment.kind, "placement"), inArray(schema.tradeAssessment.status, [...LOCKED])));
  if (live) await scorePlacement(tx, ctx, live, organizationId, trigger);
}

// ---- Reading ----

interface Found {
  assessment: AssessmentRow;
  organizationId: string;
  organizationName: string;
}

async function findPlacement(ctx: Ctx, id: string): Promise<Found> {
  const [found] = await ctx.db
    .select({ assessment: schema.tradeAssessment, organizationId: schema.enrollment.organizationId, organizationName: schema.organization.name })
    .from(schema.tradeAssessment)
    .innerJoin(schema.enrollment, eq(schema.enrollment.id, schema.tradeAssessment.enrollmentId))
    .innerJoin(schema.organization, eq(schema.organization.id, schema.enrollment.organizationId))
    .where(and(eq(schema.tradeAssessment.id, id), eq(schema.tradeAssessment.kind, "placement")));
  const access = found ? await accessTo(ctx.db, ctx.principal, found.organizationId) : null;
  if (!found || !access) throw new ServiceError("not_found", "Assessment not found.");
  return found;
}

/** The assessment's newest plan: the live one, or the last one a retake or a rescoring replaced. */
async function planOf(db: Executor, assessmentId: string): Promise<PlanRow | null> {
  const [plan] = await db.select().from(schema.learningPlan).where(eq(schema.learningPlan.assessmentId, assessmentId)).orderBy(desc(schema.learningPlan.createdAt)).limit(1);
  return plan ?? null;
}

const percent = (coverage: string): number => Math.round(Number(coverage) * 100);

function requireSubmitted(assessment: AssessmentRow): void {
  if (assessment.status === "draft") throw new ServiceError("precondition_failed", "This assessment hasn't been submitted yet.");
}

/** The stored scores of a submitted placement assessment, with the plan they led to. */
export async function getPlacementResults(ctx: Ctx, id: string): Promise<PlacementResults> {
  const { assessment } = await findPlacement(ctx, id);
  requireSubmitted(assessment);
  const plan = await planOf(ctx.db, id);
  const rules = rulesFor(plan?.rulesVersion ?? assessment.templateVersion);
  const stored = await ctx.db.select().from(schema.capabilityScore).where(eq(schema.capabilityScore.assessmentId, id));
  const bandLabel = (band: string | null) => (band ? (rules.bands.find((b) => b.id === band)?.label ?? null) : null);
  const view = (row: (typeof stored)[number], title: string) => ({
    id: row.domain,
    title,
    score: row.score === null ? null : Number(row.score),
    band: row.band,
    bandLabel: bandLabel(row.band),
    coverage: percent(row.coverage),
    points: row.points,
    maxPoints: row.maxPoints,
    evidence: row.evidenceStatus,
  });
  return {
    assessmentId: id,
    status: assessment.status,
    rulesVersion: plan?.rulesVersion ?? assessment.templateVersion,
    learningPlanId: plan?.id ?? null,
    domains: rules.domains.flatMap((d) => stored.filter((s) => s.kind === "domain" && s.domain === d.id).map((s) => view(s, d.title))),
    groups: rules.triggerGroups.flatMap((g) => stored.filter((s) => s.kind === "group" && s.domain === g.id).map((s) => ({ ...view(s, g.title), module: g.module }))),
  };
}

/** A learning plan with its modules in order and the reason for each. */
export async function getLearningPlan(ctx: Ctx, id: string): Promise<LearningPlanView> {
  const [found] = await ctx.db
    .select({ plan: schema.learningPlan, organizationId: schema.enrollment.organizationId })
    .from(schema.learningPlan)
    .innerJoin(schema.enrollment, eq(schema.enrollment.id, schema.learningPlan.enrollmentId))
    .where(eq(schema.learningPlan.id, id));
  const access = found ? await accessTo(ctx.db, ctx.principal, found.organizationId) : null;
  if (!found || !access) throw new ServiceError("not_found", "Learning plan not found.");
  const { plan } = found;
  const rules = rulesFor(plan.rulesVersion);
  const assignments = await ctx.db.select().from(schema.moduleAssignment).where(eq(schema.moduleAssignment.planId, id)).orderBy(asc(schema.moduleAssignment.sequence));
  const reason = (code: string) => {
    const definition = rules.reasonCodes.find((r) => r.code === code);
    if (!definition) throw new Error(`TRADE rules ${rules.version} have no text for reason code ${code}`);
    return { code, text: definition.text };
  };
  return {
    id: plan.id,
    enrollmentId: plan.enrollmentId,
    organizationId: found.organizationId,
    assessmentId: plan.assessmentId,
    rulesVersion: plan.rulesVersion,
    pathway: plan.pathway,
    pathwayName: PATHWAY_NAMES[plan.pathway],
    status: plan.status,
    requiresStaffReview: plan.requiresHumanReview,
    reviewNotes: plan.reviewReasons.map((r) => REVIEW_NOTES[r as ReviewReason] ?? r),
    createdAt: plan.createdAt.toISOString(),
    supersededAt: plan.supersededAt?.toISOString() ?? null,
    modules: assignments.map((a) => ({
      sequence: a.sequence,
      module: a.moduleId,
      title: rules.modules.find((m) => m.id === a.moduleId)?.title ?? a.moduleId,
      status: a.status,
      statusLabel: MODULE_STATUS_LABELS[a.status],
      source: a.source,
      reasons: a.reasonCodes.map(reason),
    })),
  };
}

/**
 * The placement report: baseline, avenue and why, each domain's score, band, coverage and evidence status, the
 * ordered plan with a reason for every module, and the commercial objectives. It is built from the stored plan and
 * the avenue it was made on, with the scores worked out again from the stored answers and the plan's rules version,
 * so it reads the same every time. A report a retake replaced stays readable, marked superseded.
 */
export async function getPlacementReport(ctx: Ctx, id: string): Promise<PlacementReportView> {
  const { assessment, organizationId, organizationName } = await findPlacement(ctx, id);
  requireSubmitted(assessment);
  const planRow = await planOf(ctx.db, id);
  if (!planRow) throw new ServiceError("precondition_failed", "This assessment hasn't been scored yet.");
  const rules = rulesFor(planRow.rulesVersion);

  const { answers, approvedNotApplicable } = await inputsOf(ctx.db, rules, id);
  const scores = scoreDomains(rules, { answers, approvedNotApplicable });

  const assignments = await ctx.db.select().from(schema.moduleAssignment).where(eq(schema.moduleAssignment.planId, planRow.id)).orderBy(asc(schema.moduleAssignment.sequence));
  const plan: LearningPlan = {
    rulesVersion: planRow.rulesVersion,
    pathway: planRow.pathway,
    modules: assignments.map((a) => ({ module: a.moduleId, status: a.status, sequence: a.sequence, reasonCodes: a.reasonCodes as ReasonCode[] })),
    requiresHumanReview: planRow.requiresHumanReview,
    reviewReasons: planRow.reviewReasons as ReviewReason[],
  };

  const [avenue] = planRow.pathwayAssignmentId
    ? await ctx.db.select().from(schema.pathwayAssignment).where(eq(schema.pathwayAssignment.id, planRow.pathwayAssignmentId))
    : [];
  const pathway: PathwayAssignment = avenue
    ? assignmentOf(avenue, planRow.rulesVersion)
    : { rulesVersion: planRow.rulesVersion, pathway: planRow.pathway, provisional: plan.reviewReasons.includes("provisional_pathway"), liveOrder: false, reasonCodes: [] };

  const [profile] = await ctx.db.select({ smeId: schema.smeProfile.smeId }).from(schema.smeProfile).where(eq(schema.smeProfile.organizationId, organizationId));
  // 1 for the first assessment, 2 for the first retake: this one's place among the enrolment's placement assessments.
  const placements = await ctx.db
    .select({ id: schema.tradeAssessment.id })
    .from(schema.tradeAssessment)
    .where(and(eq(schema.tradeAssessment.enrollmentId, assessment.enrollmentId), eq(schema.tradeAssessment.kind, "placement")))
    .orderBy(asc(schema.tradeAssessment.createdAt));
  const attempt = Math.max(1, placements.findIndex((p) => p.id === id) + 1);

  const report = buildPlacementReport(rules, {
    baseline: {
      organisation: organizationName,
      smeId: profile?.smeId ?? "Not assigned yet",
      assessedOn: (assessment.assessedAt ?? assessment.updatedAt).toISOString().slice(0, 10),
      attempt,
    },
    answers,
    scores,
    pathway,
    plan,
    superseded: assessment.status === "superseded",
  });
  return { assessmentId: id, learningPlanId: planRow.id, report: wire(report) };
}

/** The report with mutable arrays, the shape the API sends. */
function wire(report: PlacementReport): PlacementReportView["report"] {
  return {
    ...report,
    pathway: { ...report.pathway, reasons: report.pathway.reasons.map((r) => ({ ...r })) },
    domains: report.domains.map((d) => ({ ...d })),
    plan: {
      requiresStaffReview: report.plan.requiresStaffReview,
      reviewNotes: [...report.plan.reviewNotes],
      modules: report.plan.modules.map((m) => ({ ...m, reasons: m.reasons.map((r) => ({ ...r })) })),
    },
  };
}
