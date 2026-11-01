import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { schema } from "@entrust/db";
import {
  RECOMMENDATIONS,
  SUITABLE_OPPORTUNITIES,
  VERIFIABLE_CLAIMS,
  applicableCriteria,
  applicationPathway,
  applicationSeeksInvestment,
  canAssess,
  categoryNoteProblems,
  scoreApplication,
  verificationProblems,
  type ApplicationStatus,
  type CategoryId,
  type CategoryNote,
  type Recommendation,
  type ScoreResult,
  type SuitableOpportunity,
  type SummitRules,
  type VerificationClass,
} from "@entrust/summit-engine";
import type { ApplicationTemplate } from "@entrust/summit-engine";
import type { AssessmentViewType } from "../schemas/summit";
import type { Ctx } from "./access";
import type { Executor } from "./db";
import { ServiceError } from "./errors";
import { findApplication, requireStaffRole, type ApplicationRow, type SummitAccess } from "./summit-access";
import { loadPeriod, rulesOf, templateOf } from "./summit-applications";
import { listClarifications } from "./summit-clarification-data";
import { changeStatus, recordSummitChange } from "./summit-status";

// The assessment officer's workspace (#79): scoring against the approved rubric, adjusting a score, the justification
// and evidence for each category, classifying claims, internal comments, the recommendation, and completing the
// assessment. Eligibility is a separate finding and never reaches this score.

const ASSESSING: readonly ApplicationStatus[] = ["under_assessment", "under_verification"];
/** An administrator can still adjust a score until the committee starts. */
const ADJUSTABLE_BY_ADMINISTRATORS: readonly ApplicationStatus[] = [...ASSESSING, "assessment_completed", "recommended"];
const NO_COMMENTS: readonly ApplicationStatus[] = ["draft", "withdrawn"];

const person = (id: string | null, name: string | null) => (id && name ? { id, name } : null);

// ---- Loading ----

interface Workspace {
  row: ApplicationRow;
  access: SummitAccess;
  rules: SummitRules;
  template: ApplicationTemplate;
}

/** An application the caller may work on as staff. An applicant has no part in the assessment. */
async function openWorkspace(ctx: Ctx, tx: Executor, id: string, lock: boolean): Promise<Workspace> {
  const { row, access } = await findApplication(tx, ctx.principal, id, { lock });
  if (access.applicant) throw new ServiceError("forbidden", "The assessment is for Entrust staff.");
  const period = await loadPeriod(tx, row.periodId);
  return { row, access, rules: rulesOf(period.rulesVersion), template: templateOf(row.templateVersion) };
}

/** Throws unless the caller is the officer the application is assigned to. Administrators reassign; they don't score. */
function requireOfficer(access: SummitAccess, doing: string): void {
  if (!access.assigned) throw new ServiceError("forbidden", `Only the officer the application is assigned to can ${doing}.`);
}

function requireStatus(row: ApplicationRow, allowed: readonly ApplicationStatus[], doing: string): void {
  if (!allowed.includes(row.status)) {
    throw new ServiceError("invalid_transition", `You can ${doing} only while the application is ${allowed.map((s) => s.replaceAll("_", " ")).join(" or ")}. It is ${row.status.replaceAll("_", " ")}.`);
  }
}

/** The assessment of an application, started when the first score or note is recorded. */
async function ensureAssessment(tx: Executor, ctx: Ctx, w: Workspace) {
  const [existing] = await tx.select().from(schema.assessment).where(eq(schema.assessment.applicationId, w.row.id));
  if (existing) return existing;
  if (!canAssess(w.rules)) {
    throw new ServiceError("precondition_failed", `Rules ${w.rules.version} are a draft, so officers can't score against them.`);
  }
  const pathway = applicationPathway(w.template, w.row.answers);
  if (!pathway) throw new ServiceError("precondition_failed", "The applicant hasn't chosen an opportunity pathway.");
  const [created] = await tx
    .insert(schema.assessment)
    .values({
      applicationId: w.row.id,
      rulesVersion: w.rules.version,
      pathway,
      seekingInvestment: applicationSeeksInvestment(w.template, w.row.answers),
      startedBy: ctx.principal.userId,
    })
    .returning();
  if (!created) throw new Error("The assessment was not started");
  return created;
}

type AssessmentRow = typeof schema.assessment.$inferSelect;

/** The points that count for each criterion: the original score, or the newest adjustment of it. */
async function effectiveScores(tx: Executor, assessmentId: string): Promise<Record<string, number>> {
  const [scores, adjustments] = await Promise.all([
    tx.select().from(schema.criterionScore).where(eq(schema.criterionScore.assessmentId, assessmentId)),
    tx.select().from(schema.scoreAdjustment).where(eq(schema.scoreAdjustment.assessmentId, assessmentId)).orderBy(asc(schema.scoreAdjustment.adjustedAt)),
  ]);
  const effective: Record<string, number> = Object.fromEntries(scores.map((s) => [s.criterionId, s.points]));
  for (const a of adjustments) effective[a.criterionId] = a.newPoints;
  return effective;
}

const scoreOf = (rules: SummitRules, assessment: Pick<AssessmentRow, "pathway" | "seekingInvestment">, scores: Record<string, number>): ScoreResult =>
  scoreApplication(rules, { pathway: assessment.pathway, seekingInvestment: assessment.seekingInvestment, scores });

async function notesOf(tx: Executor, assessmentId: string): Promise<Partial<Record<CategoryId, CategoryNote>>> {
  const rows = await tx.select().from(schema.categoryNote).where(eq(schema.categoryNote.assessmentId, assessmentId));
  return Object.fromEntries(rows.map((n) => [n.category, { justification: n.justification, evidence: n.evidence }]));
}

// ---- The view ----

export async function buildAssessmentView(db: Executor, row: ApplicationRow): Promise<AssessmentViewType> {
  const period = await loadPeriod(db, row.periodId);
  const template = templateOf(row.templateVersion);
  const [assessment] = await db.select().from(schema.assessment).where(eq(schema.assessment.applicationId, row.id));
  const rules = rulesOf(assessment?.rulesVersion ?? period.rulesVersion);
  const pathway = assessment?.pathway ?? applicationPathway(template, row.answers);
  if (row.submittedAt === null || !pathway) {
    throw new ServiceError("invalid_transition", "The application hasn't been submitted, so there is nothing to assess.");
  }
  const basis = { pathway, seekingInvestment: assessment?.seekingInvestment ?? applicationSeeksInvestment(template, row.answers) };

  const [scores, adjustments, notes, verification, comments, recommendations, clarifications, documents, completer, reviews] = await Promise.all([
    assessment
      ? db
          .select({ score: schema.criterionScore, userId: schema.user.id, userName: schema.user.name })
          .from(schema.criterionScore)
          .leftJoin(schema.user, eq(schema.user.id, schema.criterionScore.recordedBy))
          .where(eq(schema.criterionScore.assessmentId, assessment.id))
      : Promise.resolve([]),
    assessment
      ? db
          .select({ adjustment: schema.scoreAdjustment, userId: schema.user.id, userName: schema.user.name })
          .from(schema.scoreAdjustment)
          .leftJoin(schema.user, eq(schema.user.id, schema.scoreAdjustment.adjustedBy))
          .where(eq(schema.scoreAdjustment.assessmentId, assessment.id))
          .orderBy(asc(schema.scoreAdjustment.adjustedAt))
      : Promise.resolve([]),
    assessment
      ? db
          .select({ note: schema.categoryNote, userId: schema.user.id, userName: schema.user.name })
          .from(schema.categoryNote)
          .leftJoin(schema.user, eq(schema.user.id, schema.categoryNote.updatedBy))
          .where(eq(schema.categoryNote.assessmentId, assessment.id))
      : Promise.resolve([]),
    db
      .select({ record: schema.verificationRecord, userId: schema.user.id, userName: schema.user.name })
      .from(schema.verificationRecord)
      .leftJoin(schema.user, eq(schema.user.id, schema.verificationRecord.recordedBy))
      .where(eq(schema.verificationRecord.applicationId, row.id))
      .orderBy(asc(schema.verificationRecord.recordedAt)),
    db
      .select({ comment: schema.internalComment, userId: schema.user.id, userName: schema.user.name })
      .from(schema.internalComment)
      .leftJoin(schema.user, eq(schema.user.id, schema.internalComment.authorUserId))
      .where(eq(schema.internalComment.applicationId, row.id))
      .orderBy(asc(schema.internalComment.createdAt)),
    db
      .select({ recommendation: schema.applicationRecommendation, userId: schema.user.id, userName: schema.user.name })
      .from(schema.applicationRecommendation)
      .leftJoin(schema.user, eq(schema.user.id, schema.applicationRecommendation.recordedBy))
      .where(eq(schema.applicationRecommendation.applicationId, row.id))
      .orderBy(desc(schema.applicationRecommendation.recordedAt))
      .limit(1),
    listClarifications(db, row.id, false),
    db
      .select({ id: schema.applicationDocument.id, kind: schema.applicationDocument.kind, fileName: schema.file.originalName })
      .from(schema.applicationDocument)
      .innerJoin(schema.file, eq(schema.file.id, schema.applicationDocument.fileId))
      .where(eq(schema.applicationDocument.applicationId, row.id)),
    assessment?.completedBy
      ? db.select({ id: schema.user.id, name: schema.user.name }).from(schema.user).where(eq(schema.user.id, assessment.completedBy))
      : Promise.resolve([]),
    db
      .select({ review: schema.assessmentReview, userId: schema.user.id, userName: schema.user.name })
      .from(schema.assessmentReview)
      .leftJoin(schema.user, eq(schema.user.id, schema.assessmentReview.reviewedBy))
      .where(eq(schema.assessmentReview.applicationId, row.id))
      .orderBy(asc(schema.assessmentReview.reviewedAt)),
  ]);

  const original = new Map(scores.map((s) => [s.score.criterionId, s]));
  const adjusted = new Set(adjustments.map((a) => a.adjustment.criterionId));
  const effective: Record<string, number> = Object.fromEntries(scores.map((s) => [s.score.criterionId, s.score.points]));
  for (const a of adjustments) effective[a.adjustment.criterionId] = a.adjustment.newPoints;

  const result = scoreOf(rules, basis, effective);
  const noteMap = Object.fromEntries(notes.map((n) => [n.note.category, { justification: n.note.justification, evidence: n.note.evidence }]));
  const documentById = new Map(documents.map((d) => [d.id, d]));
  const recommendation = recommendations[0];

  return {
    applicationId: row.id,
    number: row.number,
    status: row.status,
    rulesVersion: rules.version,
    approved: canAssess(rules),
    state: !assessment ? "not_started" : assessment.completedAt ? "completed" : "in_progress",
    pathway,
    seekingInvestment: basis.seekingInvestment,
    categories: rules.rubric.categories.map((category) => {
      const summary = result.categories.find((c) => c.id === category.id);
      const applicable = summary?.applicable ?? true;
      const note = notes.find((n) => n.note.category === category.id);
      return {
        id: category.id,
        title: category.title,
        maxPoints: category.maxPoints,
        assess: [...category.assess],
        evidence: [...(category.evidence ?? [])],
        applicable,
        criteria: applicable
          ? applicableCriteria(category, pathway).map((criterion) => {
              const first = original.get(criterion.id);
              return {
                id: criterion.id,
                text: criterion.text,
                maxPoints: criterion.maxPoints,
                guidance: (criterion.guidance ?? []).map((g) => ({ from: g.from, to: g.to, text: g.text })),
                evidence: [...criterion.evidence],
                points: effective[criterion.id] ?? null,
                original: first ? { points: first.score.points, by: person(first.userId, first.userName), at: first.score.recordedAt.toISOString() } : null,
                adjusted: adjusted.has(criterion.id),
              };
            })
          : [],
        points: summary?.points ?? null,
        note: note
          ? { justification: note.note.justification, evidence: note.note.evidence, by: person(note.userId, note.userName), updatedAt: note.note.updatedAt.toISOString() }
          : null,
      };
    }),
    score: {
      complete: result.complete,
      points: result.points ?? null,
      possible: result.possible,
      total: result.total ?? null,
      normalized: result.normalized,
      notApplicable: [...result.notApplicable],
    },
    noteProblems: categoryNoteProblems(result, noteMap),
    adjustments: adjustments.map(({ adjustment: a, userId, userName }) => ({
      criterion: a.criterionId,
      previousPoints: a.previousPoints,
      newPoints: a.newPoints,
      reason: a.reason,
      by: person(userId, userName),
      at: a.adjustedAt.toISOString(),
    })),
    claims: VERIFIABLE_CLAIMS.map((c) => ({ id: c.id, label: c.label, evidence: c.evidence })),
    verification: verification.map(({ record, userId, userName }) => ({
      claim: record.claim,
      label: VERIFIABLE_CLAIMS.find((c) => c.id === record.claim)?.label ?? null,
      class: record.class,
      documents: record.documentIds.flatMap((id) => {
        const d = documentById.get(id);
        return d ? [{ id: d.id, kind: d.kind, fileName: d.fileName }] : [];
      }),
      independentCheck: record.independentCheck,
      by: person(userId, userName),
      at: record.recordedAt.toISOString(),
    })),
    comments: comments.map(({ comment, userId, userName }) => ({ id: comment.id, body: comment.body, by: person(userId, userName), at: comment.createdAt.toISOString() })),
    clarifications,
    recommendation: recommendation
      ? {
          recommendation: recommendation.recommendation.recommendation,
          label: RECOMMENDATIONS.find((r) => r.id === recommendation.recommendation.recommendation)?.label ?? recommendation.recommendation.recommendation,
          suitableOpportunity: recommendation.recommendation.suitableOpportunity,
          rationale: recommendation.recommendation.rationale,
          by: person(recommendation.userId, recommendation.userName),
          at: recommendation.recommendation.recordedAt.toISOString(),
        }
      : null,
    reviews: reviews.map(({ review, userId, userName }) => ({
      decision: review.decision,
      reason: review.reason,
      by: person(userId, userName),
      at: review.reviewedAt.toISOString(),
    })),
    completedAt: assessment?.completedAt?.toISOString() ?? null,
    completedBy: person(completer[0]?.id ?? null, completer[0]?.name ?? null),
  };
}

/** The workspace for an application: the assigned officer, an administrator or a facilitator. */
export async function getAssessment(ctx: Ctx, id: string): Promise<AssessmentViewType> {
  const w = await openWorkspace(ctx, ctx.db, id, false);
  return buildAssessmentView(ctx.db, w.row);
}

// ---- Scoring ----

/** Every problem the score check raised for the criteria just entered, as one sentence. */
const problemsText = (problems: readonly { criterion: string; message: string }[], only: ReadonlySet<string>): string =>
  problems.filter((p) => only.has(p.criterion)).map((p) => p.message).join("; ");

/**
 * Records the officer's points, a whole number for each criterion up to its maximum. A score is written once and
 * never overwritten: a mistake afterwards is fixed by an adjustment, which keeps the original and says why. The
 * assessment is started with the first score, under the rules version the application's period names.
 */
export async function recordScores(ctx: Ctx, id: string, scores: Readonly<Record<string, number>>): Promise<AssessmentViewType> {
  return ctx.db.transaction(async (tx) => {
    const w = await openWorkspace(ctx, tx, id, true);
    requireOfficer(w.access, "record scores");
    requireStatus(w.row, ASSESSING, "record scores");
    const assessment = await ensureAssessment(tx, ctx, w);

    const effective = await effectiveScores(tx, assessment.id);
    const entered = new Set(Object.keys(scores));
    const already = [...entered].filter((criterion) => effective[criterion] !== undefined);
    if (already.length) {
      throw new ServiceError(
        "invalid_transition",
        `${already.join(", ")} ${already.length === 1 ? "is" : "are"} already scored. A recorded score isn't overwritten: ask an administrator to adjust it.`,
      );
    }
    const check = scoreOf(w.rules, assessment, { ...effective, ...scores });
    const problem = problemsText(check.problems, entered);
    if (problem) throw new ServiceError("invalid", problem);

    await tx
      .insert(schema.criterionScore)
      .values(Object.entries(scores).map(([criterionId, points]) => ({ assessmentId: assessment.id, criterionId, points, recordedBy: ctx.principal.userId })));
    await recordSummitChange(tx, ctx.principal.userId, {
      action: "summit.assessment.scored",
      entityType: "summit_application",
      entityId: id,
      organizationId: w.row.organizationId,
      after: { rulesVersion: assessment.rulesVersion, scores },
    });
    return buildAssessmentView(tx, w.row);
  });
}

/**
 * Changes a recorded score by hand, keeping the score before, the score after, the reason, who and when. The
 * officer can do it until they complete the assessment; an administrator or facilitator until the committee starts.
 */
export async function adjustScore(ctx: Ctx, id: string, input: { criterion: string; points: number; reason: string }): Promise<AssessmentViewType> {
  return ctx.db.transaction(async (tx) => {
    const w = await openWorkspace(ctx, tx, id, true);
    if (w.access.assigned) requireStatus(w.row, ASSESSING, "adjust a score");
    else {
      requireStaffRole(w.access, ["admin", "facilitator"], "adjust a score");
      requireStatus(w.row, ADJUSTABLE_BY_ADMINISTRATORS, "adjust a score");
    }
    const [assessment] = await tx.select().from(schema.assessment).where(eq(schema.assessment.applicationId, id));
    const effective = assessment ? await effectiveScores(tx, assessment.id) : {};
    const previous = effective[input.criterion];
    if (!assessment || previous === undefined) {
      throw new ServiceError("invalid", `${input.criterion} hasn't been scored. Record a score first; only a recorded score can be adjusted.`);
    }
    const check = scoreOf(w.rules, assessment, { ...effective, [input.criterion]: input.points });
    const problem = problemsText(check.problems, new Set([input.criterion]));
    if (problem) throw new ServiceError("invalid", problem);
    if (input.points === previous) throw new ServiceError("invalid", `${input.criterion} already has ${previous} points.`);

    await tx.insert(schema.scoreAdjustment).values({
      assessmentId: assessment.id,
      criterionId: input.criterion,
      previousPoints: previous,
      newPoints: input.points,
      reason: input.reason,
      adjustedBy: ctx.principal.userId,
      adjustedAt: sql`clock_timestamp()`,
    });
    await recordSummitChange(tx, ctx.principal.userId, {
      action: "summit.assessment.adjusted",
      entityType: "summit_application",
      entityId: id,
      organizationId: w.row.organizationId,
      before: { criterion: input.criterion, points: previous },
      after: { criterion: input.criterion, points: input.points },
      reason: input.reason,
    });
    return buildAssessmentView(tx, w.row);
  });
}

/** The short justification and the evidence the officer relies on for one category, which the scorecard asks for. */
export async function saveCategoryNote(
  ctx: Ctx,
  id: string,
  category: CategoryId,
  input: { justification: string; evidence: readonly string[] },
): Promise<AssessmentViewType> {
  return ctx.db.transaction(async (tx) => {
    const w = await openWorkspace(ctx, tx, id, true);
    requireOfficer(w.access, "write category notes");
    requireStatus(w.row, ASSESSING, "write category notes");
    const assessment = await ensureAssessment(tx, ctx, w);
    const summary = scoreOf(w.rules, assessment, {}).categories.find((c) => c.id === category);
    if (!summary?.applicable) {
      throw new ServiceError("invalid", `Category ${category} isn't scored for this applicant, so it needs no note.`);
    }

    const [before] = await tx
      .select()
      .from(schema.categoryNote)
      .where(and(eq(schema.categoryNote.assessmentId, assessment.id), eq(schema.categoryNote.category, category)));
    const values = { justification: input.justification, evidence: [...input.evidence], updatedBy: ctx.principal.userId, updatedAt: ctx.now };
    await tx
      .insert(schema.categoryNote)
      .values({ assessmentId: assessment.id, category, ...values })
      .onConflictDoUpdate({ target: [schema.categoryNote.assessmentId, schema.categoryNote.category], set: values });
    await recordSummitChange(tx, ctx.principal.userId, {
      action: "summit.assessment.note",
      entityType: "summit_application",
      entityId: id,
      organizationId: w.row.organizationId,
      before: before ? { category, justification: before.justification, evidence: before.evidence } : null,
      after: { category, justification: input.justification, evidence: input.evidence },
    });
    return buildAssessmentView(tx, w.row);
  });
}

// ---- Verification ----

/**
 * Classifies one claim of the application: self-reported, document-supported, independently verified, not verified
 * or not applicable. A claim is never independently verified because a document was uploaded: that needs a note of
 * what the officer checked outside the application. Classifying again replaces the earlier row, and the audit log
 * keeps it.
 */
export async function classifyClaim(
  ctx: Ctx,
  id: string,
  claim: string,
  input: { class: VerificationClass; documents: readonly string[]; independentCheck?: string | undefined },
): Promise<AssessmentViewType> {
  return ctx.db.transaction(async (tx) => {
    const w = await openWorkspace(ctx, tx, id, true);
    requireOfficer(w.access, "classify claims");
    requireStatus(w.row, ASSESSING, "classify claims");

    const documents = [...new Set(input.documents)];
    if (documents.length) {
      const found = await tx
        .select({ id: schema.applicationDocument.id })
        .from(schema.applicationDocument)
        .where(and(eq(schema.applicationDocument.applicationId, id), inArray(schema.applicationDocument.id, documents)));
      if (found.length !== documents.length) throw new ServiceError("invalid", "A document named isn't one of this application's documents.");
    }
    const problems = verificationProblems({ claim, class: input.class, documents, ...(input.independentCheck ? { independentCheck: input.independentCheck } : {}) });
    if (problems.length) throw new ServiceError("invalid", problems.join(" "));

    const [before] = await tx
      .select()
      .from(schema.verificationRecord)
      .where(and(eq(schema.verificationRecord.applicationId, id), eq(schema.verificationRecord.claim, claim)));
    const values = {
      class: input.class,
      documentIds: documents,
      independentCheck: input.independentCheck || null,
      recordedBy: ctx.principal.userId,
      recordedAt: ctx.now,
    };
    await tx
      .insert(schema.verificationRecord)
      .values({ applicationId: id, claim, ...values })
      .onConflictDoUpdate({ target: [schema.verificationRecord.applicationId, schema.verificationRecord.claim], set: values });
    await recordSummitChange(tx, ctx.principal.userId, {
      action: "summit.verification.recorded",
      entityType: "summit_application",
      entityId: id,
      organizationId: w.row.organizationId,
      before: before ? { claim, class: before.class, documents: before.documentIds, independentCheck: before.independentCheck } : null,
      after: { claim, class: input.class, documents, independentCheck: input.independentCheck ?? null },
    });
    return buildAssessmentView(tx, w.row);
  });
}

/** Moves an application between assessment and verification. */
export async function setStage(ctx: Ctx, id: string, to: "under_assessment" | "under_verification"): Promise<AssessmentViewType> {
  return ctx.db.transaction(async (tx) => {
    const w = await openWorkspace(ctx, tx, id, true);
    requireOfficer(w.access, "change the stage");
    await changeStatus(tx, w.row, to, ctx.principal.userId);
    return buildAssessmentView(tx, w.row);
  });
}

// ---- Comments ----

/** An internal note. The applicant can't see it. */
export async function addComment(ctx: Ctx, id: string, body: string): Promise<AssessmentViewType> {
  return ctx.db.transaction(async (tx) => {
    const w = await openWorkspace(ctx, tx, id, true);
    if (NO_COMMENTS.includes(w.row.status)) throw new ServiceError("invalid_transition", "An application that isn't submitted has nothing to comment on.");
    const [comment] = await tx
      .insert(schema.internalComment)
      .values({ applicationId: id, authorUserId: ctx.principal.userId, body, createdAt: sql`clock_timestamp()` })
      .returning({ id: schema.internalComment.id });
    await recordSummitChange(tx, ctx.principal.userId, {
      action: "summit.comment.added",
      entityType: "summit_application",
      entityId: id,
      organizationId: w.row.organizationId,
      after: { commentId: comment?.id },
    });
    return buildAssessmentView(tx, w.row);
  });
}

// ---- Completing ----

/**
 * Completes the assessment. Every applicable criterion has to be scored, every scored category needs its
 * justification, and a category that earned points needs the evidence its points rest on. The application then waits
 * for the officer's recommendation.
 */
export async function completeAssessment(ctx: Ctx, id: string): Promise<AssessmentViewType> {
  return ctx.db.transaction(async (tx) => {
    const w = await openWorkspace(ctx, tx, id, true);
    requireOfficer(w.access, "complete the assessment");
    requireStatus(w.row, ASSESSING, "complete the assessment");
    const [assessment] = await tx.select().from(schema.assessment).where(eq(schema.assessment.applicationId, id));
    if (!assessment) throw new ServiceError("precondition_failed", "Nothing is scored yet.");

    const result = scoreOf(w.rules, assessment, await effectiveScores(tx, assessment.id));
    if (!result.complete) {
      const missing = result.categories.flatMap((c) => c.missing);
      throw new ServiceError("precondition_failed", `Score every criterion before completing the assessment. Still to score: ${missing.join(", ")}.`);
    }
    const notes = categoryNoteProblems(result, await notesOf(tx, assessment.id));
    if (notes.length) throw new ServiceError("precondition_failed", notes.map((n) => n.message).join(" "));

    await tx.update(schema.assessment).set({ completedAt: ctx.now, completedBy: ctx.principal.userId }).where(eq(schema.assessment.id, assessment.id));
    await changeStatus(tx, w.row, "assessment_completed", ctx.principal.userId);
    await recordSummitChange(tx, ctx.principal.userId, {
      action: "summit.assessment.completed",
      entityType: "summit_application",
      entityId: id,
      organizationId: w.row.organizationId,
      after: { rulesVersion: assessment.rulesVersion, points: result.points, possible: result.possible, total: result.total, normalized: result.normalized },
    });
    return buildAssessmentView(tx, w.row);
  });
}

/** The officer's recommendation, once the assessment is complete. The application is then ready for the committee. */
export async function recordRecommendation(
  ctx: Ctx,
  id: string,
  input: { recommendation: string; suitableOpportunity?: string | undefined; rationale: string },
): Promise<AssessmentViewType> {
  const recommendation = RECOMMENDATIONS.find((r) => r.id === input.recommendation)?.id as Recommendation | undefined;
  if (!recommendation) throw new ServiceError("invalid", `"${input.recommendation}" isn't a recommendation.`);
  const suitable = input.suitableOpportunity
    ? (SUITABLE_OPPORTUNITIES.find((o) => o.id === input.suitableOpportunity)?.id as SuitableOpportunity | undefined)
    : undefined;
  if (input.suitableOpportunity && !suitable) throw new ServiceError("invalid", `"${input.suitableOpportunity}" isn't a Summit opportunity.`);

  return ctx.db.transaction(async (tx) => {
    const w = await openWorkspace(ctx, tx, id, true);
    requireOfficer(w.access, "make a recommendation");
    requireStatus(w.row, ["assessment_completed"], "make a recommendation");
    await tx.insert(schema.applicationRecommendation).values({
      applicationId: id,
      recommendation,
      suitableOpportunity: suitable ?? null,
      rationale: input.rationale,
      recordedBy: ctx.principal.userId,
    });
    await changeStatus(tx, w.row, "recommended", ctx.principal.userId, recommendation);
    await recordSummitChange(tx, ctx.principal.userId, {
      action: "summit.assessment.recommended",
      entityType: "summit_application",
      entityId: id,
      organizationId: w.row.organizationId,
      after: { recommendation, suitableOpportunity: suitable ?? null },
      reason: input.rationale,
    });
    return buildAssessmentView(tx, w.row);
  });
}
