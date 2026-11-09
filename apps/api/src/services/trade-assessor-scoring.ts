import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { schema } from "@entrust/db";
import { evaluateRubric, WORKSHEET_DEFINITIONS } from "@entrust/trade-engine";
import { findVersion } from "@entrust/trade-content";
import { type ModuleId } from "@entrust/trade-rules";
import { enqueue, JOB_NAMES } from "@entrust/jobs";
import type { Ctx } from "./access";
import { ServiceError } from "./errors";
import { evaluateAndSyncModuleCompletion, reopenAfterFailedOverride } from "./trade-completion";
import { accessTo, assignedCohortIds, canReachCohort, limitedToAssignedCohorts, refuseNewWork } from "./trade-shared";
import { isLearningPlan, moduleContentWorksheets } from "./trade-worksheet-definitions";
import type {
  CreateModuleSubmissionInput,
  ModuleSubmissionListQueryInput,
  ModuleSubmissionView,
  OverrideScoreInput,
  RubricAssessmentView,
  ScoreSubmissionInput,
  SubmissionScoresList,
} from "../schemas/trade";

export async function createModuleSubmission(
  ctx: Ctx,
  input: CreateModuleSubmissionInput
): Promise<ModuleSubmissionView> {
  const { principal, db } = ctx;

  const [enrollment] = await db
    .select({
      id: schema.enrollment.id,
      organizationId: schema.enrollment.organizationId,
      cohortId: schema.enrollment.cohortId,
      status: schema.enrollment.status,
    })
    .from(schema.enrollment)
    .where(eq(schema.enrollment.id, input.enrollmentId))
    .limit(1);

  if (!enrollment) {
    throw new ServiceError("not_found", "Enrollment not found.");
  }

  // Staff cannot submit learner deliverables ("Staff can open any learner's view, read-only")
  if (principal.staffRole && !principal.smeRoles.has(enrollment.organizationId)) {
    throw new ServiceError("forbidden", "Staff have read-only access to learner submissions.");
  }

  if (!principal.smeRoles.has(enrollment.organizationId)) {
    throw new ServiceError("forbidden", "Access denied.");
  }
  refuseNewWork(enrollment.status);

  // 1. Verify module assignment in active plan
  const [activePlan] = await db
    .select({ id: schema.learningPlan.id })
    .from(schema.learningPlan)
    .where(
      and(
        eq(schema.learningPlan.enrollmentId, input.enrollmentId),
        sql`${schema.learningPlan.status} <> 'superseded'`
      )
    )
    .limit(1);

  if (activePlan) {
    const [assignment] = await db
      .select({ id: schema.moduleAssignment.id })
      .from(schema.moduleAssignment)
      .where(
        and(
          eq(schema.moduleAssignment.planId, activePlan.id),
          eq(schema.moduleAssignment.moduleId, input.moduleId)
        )
      )
      .limit(1);

    if (!assignment) {
      throw new ServiceError("invalid", "A module outside the plan cannot be submitted.");
    }
  }

  // 2. Verify theory completion prerequisite (#63 prerequisite to #67)
  const [progress] = await db
    .select()
    .from(schema.moduleProgress)
    .where(
      and(
        eq(schema.moduleProgress.enrollmentId, input.enrollmentId),
        eq(schema.moduleProgress.moduleId, input.moduleId)
      )
    )
    .limit(1);

  if (!progress?.theoryCompletedAt) {
    throw new ServiceError(
      "invalid",
      "The theory knowledge check must be passed before submitting the practical deliverable."
    );
  }

  // Evidence attached to a submission has to be this business's own.
  if (input.evidenceRecordIds?.length) {
    const own = await db
      .select({ id: schema.evidenceRecord.id })
      .from(schema.evidenceRecord)
      .where(and(inArray(schema.evidenceRecord.id, input.evidenceRecordIds), eq(schema.evidenceRecord.organizationId, enrollment.organizationId)));
    if (own.length !== new Set(input.evidenceRecordIds).size) throw new ServiceError("not_found", "Evidence record not found.");
  }

  // 3. Resolve worksheet version and snapshot
  let worksheetVersionId: string | null = input.worksheetVersionId ?? null;
  let worksheetSnapshot: Record<string, unknown> = {};

  // A module whose content carries its worksheets is assessed on every required output, so the assessor sees them all.
  // The individual learning plan isn't one: it follows the assessor's review.
  // M03's financial pack is four worksheets, and it's assessed on all four in the same way.
  const engineOutputs = WORKSHEET_DEFINITIONS.filter((d) => d.module === input.moduleId);
  const requiredOutputs = engineOutputs.length > 1 ? engineOutputs : moduleContentWorksheets(input.moduleId as ModuleId).filter((d) => !isLearningPlan(d));
  if (requiredOutputs.length) {
    const submitted = await db
      .select()
      .from(schema.worksheetVersion)
      .where(
        and(
          eq(schema.worksheetVersion.enrollmentId, input.enrollmentId),
          eq(schema.worksheetVersion.moduleId, input.moduleId),
          eq(schema.worksheetVersion.status, "submitted")
        )
      )
      .orderBy(desc(schema.worksheetVersion.version));
    const newest = requiredOutputs.map((def) => ({ def, version: submitted.find((v) => v.worksheetId === def.id) }));
    const missing = newest.filter((o) => !o.version).map((o) => o.def.title);
    if (missing.length) {
      throw new ServiceError("precondition_failed", `Submit these worksheets first: ${missing.join("; ")}.`);
    }
    worksheetVersionId = newest[0]!.version!.id;
    worksheetSnapshot = {
      worksheets: newest.map(({ def, version }) => ({
        id: version!.id,
        worksheetId: def.id,
        title: def.title,
        version: version!.version,
        values: version!.values,
        result: version!.result,
        submittedAt: version!.submittedAt?.toISOString() ?? null,
      })),
    };
  } else if (worksheetVersionId) {
    const [ws] = await db
      .select()
      .from(schema.worksheetVersion)
      .where(
        and(
          eq(schema.worksheetVersion.id, worksheetVersionId),
          eq(schema.worksheetVersion.enrollmentId, input.enrollmentId)
        )
      )
      .limit(1);

    if (!ws) {
      throw new ServiceError("not_found", "Specified worksheet version not found.");
    }
    worksheetSnapshot = {
      id: ws.id,
      worksheetId: ws.worksheetId,
      version: ws.version,
      values: ws.values,
      result: ws.result,
      confidence: ws.confidence,
      submittedAt: ws.submittedAt?.toISOString() ?? null,
    };
  } else {
    // Find newest submitted worksheet for this module
    const [latestWs] = await db
      .select()
      .from(schema.worksheetVersion)
      .where(
        and(
          eq(schema.worksheetVersion.enrollmentId, input.enrollmentId),
          eq(schema.worksheetVersion.moduleId, input.moduleId),
          eq(schema.worksheetVersion.status, "submitted")
        )
      )
      .orderBy(desc(schema.worksheetVersion.version))
      .limit(1);

    if (latestWs) {
      worksheetVersionId = latestWs.id;
      worksheetSnapshot = {
        id: latestWs.id,
        worksheetId: latestWs.worksheetId,
        version: latestWs.version,
        values: latestWs.values,
        result: latestWs.result,
        confidence: latestWs.confidence,
        submittedAt: latestWs.submittedAt?.toISOString() ?? null,
      };
    } else if (WORKSHEET_DEFINITIONS.some((d) => d.module === input.moduleId)) {
      // Nothing to assess otherwise: a module with a worksheet is assessed on it.
      throw new ServiceError("precondition_failed", "Submit this module's worksheet first.");
    }
  }

  // Determine submission attempt version
  const [latestSub] = await db
    .select({ version: schema.moduleSubmission.version })
    .from(schema.moduleSubmission)
    .where(
      and(
        eq(schema.moduleSubmission.enrollmentId, input.enrollmentId),
        eq(schema.moduleSubmission.moduleId, input.moduleId)
      )
    )
    .orderBy(desc(schema.moduleSubmission.version))
    .limit(1);

  const nextVersion = (latestSub?.version ?? 0) + 1;
  const contentVersion = input.contentVersion ?? progress.contentVersion ?? "0.1.0";
  const now = new Date();

  const [submission] = await db
    .insert(schema.moduleSubmission)
    .values({
      enrollmentId: input.enrollmentId,
      moduleId: input.moduleId,
      contentVersion,
      version: nextVersion,
      status: "submitted",
      worksheetVersionId,
      evidenceRecordIds: input.evidenceRecordIds ?? [],
      worksheetSnapshot,
      submittedByUserId: principal.userId,
      submittedAt: now,
    })
    .returning();

  // Update module progress to submitted
  await db
    .update(schema.moduleProgress)
    .set({
      status: "submitted",
      updatedAt: now,
    })
    .where(eq(schema.moduleProgress.id, progress.id));

  // Audit log
  await db.insert(schema.auditLog).values({
    actorUserId: principal.userId,
    organizationId: enrollment.organizationId,
    platform: "trade",
    action: "trade.module_submission.created",
    entityType: "trade.module_submission",
    entityId: submission!.id,
    after: {
      enrollmentId: input.enrollmentId,
      moduleId: input.moduleId,
      version: nextVersion,
      worksheetVersionId,
    },
  });

  return {
    id: submission!.id,
    enrollmentId: submission!.enrollmentId,
    organizationId: enrollment.organizationId,
    moduleId: submission!.moduleId as ModuleId,
    contentVersion: submission!.contentVersion,
    version: submission!.version,
    status: submission!.status as ModuleSubmissionView["status"],
    worksheetVersionId: submission!.worksheetVersionId,
    evidenceRecordIds: submission!.evidenceRecordIds,
    worksheetSnapshot: submission!.worksheetSnapshot,
    waitingTimeHours: 0,
    submittedAt: submission!.submittedAt.toISOString(),
    reviewedAt: null,
    officialScore: null,
    scoresCount: 0,
    createdAt: submission!.createdAt.toISOString(),
    updatedAt: submission!.updatedAt.toISOString(),
  };
}

export async function listModuleSubmissions(
  ctx: Ctx,
  query: ModuleSubmissionListQueryInput
): Promise<ModuleSubmissionView[]> {
  const { principal, db } = ctx;

  const conditions = [];

  if (query.cohortId) {
    conditions.push(eq(schema.enrollment.cohortId, query.cohortId));
  }
  if (query.moduleId) {
    conditions.push(eq(schema.moduleSubmission.moduleId, query.moduleId));
  }
  if (query.status) {
    conditions.push(eq(schema.moduleSubmission.status, query.status));
  }
  if (query.enrollmentId) {
    conditions.push(eq(schema.moduleSubmission.enrollmentId, query.enrollmentId));
  }

  // SME users are restricted to their own organizations
  if (!principal.staffRole) {
    const userOrgIds = Array.from(principal.smeRoles.keys());
    if (userOrgIds.length === 0) return [];
    conditions.push(inArray(schema.enrollment.organizationId, userOrgIds));
  }

  // A facilitator or reviewer sees the queue of their own cohorts.
  if (limitedToAssignedCohorts(principal)) {
    const cohorts = await assignedCohortIds(db, principal.userId);
    if (cohorts.length === 0) return [];
    conditions.push(inArray(schema.enrollment.cohortId, cohorts));
  }

  // Queue ordering:
  // If filtering for "submitted" queue, sort by submittedAt asc (oldest waiting time first)
  // Otherwise newest first
  const orderByClause = query.status === "submitted"
    ? [asc(schema.moduleSubmission.submittedAt)]
    : [desc(schema.moduleSubmission.submittedAt)];

  const rows = await db
    .select({
      submission: schema.moduleSubmission,
      enrollment: schema.enrollment,
      cohortName: schema.cohort.name,
      orgName: schema.organization.name,
    })
    .from(schema.moduleSubmission)
    .innerJoin(schema.enrollment, eq(schema.moduleSubmission.enrollmentId, schema.enrollment.id))
    .leftJoin(schema.cohort, eq(schema.enrollment.cohortId, schema.cohort.id))
    .leftJoin(schema.organization, eq(schema.enrollment.organizationId, schema.organization.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(...orderByClause);

  if (rows.length === 0) return [];

  const submissionIds = rows.map((r) => r.submission.id);

  // Fetch official / first scores
  const scores = await db
    .select()
    .from(schema.rubricAssessment)
    .where(
      and(
        inArray(schema.rubricAssessment.submissionId, submissionIds),
        eq(schema.rubricAssessment.isFirstScore, true)
      )
    );

  const scoreMap = new Map(scores.map((s) => [s.submissionId, s]));
  const nowMs = Date.now();

  return rows.map((r) => {
    const sub = r.submission;
    const score = scoreMap.get(sub.id);
    const waitingTimeHours = Math.round(((nowMs - sub.submittedAt.getTime()) / (1000 * 60 * 60)) * 10) / 10;

    let officialScore: RubricAssessmentView | null = null;
    if (score) {
      officialScore = {
        id: score.id,
        submissionId: score.submissionId,
        assessorUserId: score.assessorUserId,
        isFirstScore: score.isFirstScore,
        scores: score.scores,
        criterionResults: score.criterionResults as RubricAssessmentView["criterionResults"],
        confirmedCriticalFailures: score.confirmedCriticalFailures,
        totalPoints: score.totalPoints,
        maxPoints: score.maxPoints,
        percentage: Number(score.percentage),
        band: score.band,
        passed: score.passed,
        outcome: score.outcome as RubricAssessmentView["outcome"],
        feedback: score.feedback,
        overriddenByUserId: score.overriddenByUserId,
        overrideReason: score.overrideReason,
        createdAt: score.createdAt.toISOString(),
        updatedAt: score.updatedAt.toISOString(),
      };
    }

    return {
      id: sub.id,
      enrollmentId: sub.enrollmentId,
      organizationId: r.enrollment.organizationId,
      organizationName: r.orgName ?? undefined,
      cohortId: r.enrollment.cohortId,
      cohortName: r.cohortName ?? undefined,
      moduleId: sub.moduleId as ModuleId,
      contentVersion: sub.contentVersion,
      version: sub.version,
      status: sub.status as ModuleSubmissionView["status"],
      worksheetVersionId: sub.worksheetVersionId,
      evidenceRecordIds: sub.evidenceRecordIds,
      worksheetSnapshot: sub.worksheetSnapshot,
      waitingTimeHours,
      submittedAt: sub.submittedAt.toISOString(),
      reviewedAt: sub.reviewedAt?.toISOString() ?? null,
      officialScore,
      createdAt: sub.createdAt.toISOString(),
      updatedAt: sub.updatedAt.toISOString(),
    };
  });
}

export async function getModuleSubmission(
  ctx: Ctx,
  id: string
): Promise<ModuleSubmissionView> {
  const { principal, db } = ctx;

  const [row] = await db
    .select({
      submission: schema.moduleSubmission,
      enrollment: schema.enrollment,
      cohortName: schema.cohort.name,
      orgName: schema.organization.name,
    })
    .from(schema.moduleSubmission)
    .innerJoin(schema.enrollment, eq(schema.moduleSubmission.enrollmentId, schema.enrollment.id))
    .leftJoin(schema.cohort, eq(schema.enrollment.cohortId, schema.cohort.id))
    .leftJoin(schema.organization, eq(schema.enrollment.organizationId, schema.organization.id))
    .where(eq(schema.moduleSubmission.id, id))
    .limit(1);

  if (!row) {
    throw new ServiceError("not_found", "Submission not found.");
  }

  if (!principal.staffRole && !principal.smeRoles.has(row.enrollment.organizationId)) {
    throw new ServiceError("forbidden", "Access denied.");
  }
  if (principal.staffRole && !(await canReachCohort(db, principal, row.enrollment.cohortId))) {
    throw new ServiceError("not_found", "Submission not found.");
  }

  const [score] = await db
    .select()
    .from(schema.rubricAssessment)
    .where(
      and(
        eq(schema.rubricAssessment.submissionId, id),
        eq(schema.rubricAssessment.isFirstScore, true)
      )
    )
    .limit(1);

  const sub = row.submission;
  const waitingTimeHours =
    Math.round(((Date.now() - sub.submittedAt.getTime()) / (1000 * 60 * 60)) * 10) / 10;

  let officialScore: RubricAssessmentView | null = null;
  if (score) {
    officialScore = {
      id: score.id,
      submissionId: score.submissionId,
      assessorUserId: score.assessorUserId,
      isFirstScore: score.isFirstScore,
      scores: score.scores,
      criterionResults: score.criterionResults as RubricAssessmentView["criterionResults"],
      confirmedCriticalFailures: score.confirmedCriticalFailures,
      totalPoints: score.totalPoints,
      maxPoints: score.maxPoints,
      percentage: Number(score.percentage),
      band: score.band,
      passed: score.passed,
      outcome: score.outcome as RubricAssessmentView["outcome"],
      feedback: score.feedback,
      overriddenByUserId: score.overriddenByUserId,
      overrideReason: score.overrideReason,
      createdAt: score.createdAt.toISOString(),
      updatedAt: score.updatedAt.toISOString(),
    };
  }

  return {
    id: sub.id,
    enrollmentId: sub.enrollmentId,
    organizationId: row.enrollment.organizationId,
    organizationName: row.orgName ?? undefined,
    cohortId: row.enrollment.cohortId,
    cohortName: row.cohortName ?? undefined,
    moduleId: sub.moduleId as ModuleId,
    contentVersion: sub.contentVersion,
    version: sub.version,
    status: sub.status as ModuleSubmissionView["status"],
    worksheetVersionId: sub.worksheetVersionId,
    evidenceRecordIds: sub.evidenceRecordIds,
    worksheetSnapshot: sub.worksheetSnapshot,
    waitingTimeHours,
    submittedAt: sub.submittedAt.toISOString(),
    reviewedAt: sub.reviewedAt?.toISOString() ?? null,
    officialScore,
    createdAt: sub.createdAt.toISOString(),
    updatedAt: sub.updatedAt.toISOString(),
  };
}

/** One score at a time per submission, so two assessors at once can't both be the official first score. */
export async function scoreModuleSubmission(ctx: Ctx, submissionId: string, input: ScoreSubmissionInput): Promise<RubricAssessmentView> {
  const after: AfterCommit[] = [];
  const view = await ctx.db.transaction(async (tx) => {
    const [locked] = await tx.select({ enrollmentId: schema.moduleSubmission.enrollmentId }).from(schema.moduleSubmission).where(eq(schema.moduleSubmission.id, submissionId)).for("update");
    // The enrolment before the module's progress, the order a lesson save takes them in, so the two can't deadlock.
    if (locked) await tx.select({ id: schema.enrollment.id }).from(schema.enrollment).where(eq(schema.enrollment.id, locked.enrollmentId)).for("update");
    return applyScore({ ...ctx, db: tx }, submissionId, input, after);
  });
  for (const run of after) await run(ctx.db);
  return view;
}

type AfterCommit = (db: Ctx["db"]) => Promise<void>;

async function applyScore(
  ctx: Ctx,
  submissionId: string,
  input: ScoreSubmissionInput,
  after: AfterCommit[]
): Promise<RubricAssessmentView> {
  const { principal, db } = ctx;

  // In TRADE, Entrust reviewers and facilitators score, and admins can change a score.
  if (!principal.staffRole) {
    throw new ServiceError("forbidden", "Only Entrust staff assessors can score submissions.");
  }

  const [row] = await db
    .select({
      submission: schema.moduleSubmission,
      enrollment: schema.enrollment,
    })
    .from(schema.moduleSubmission)
    .innerJoin(schema.enrollment, eq(schema.moduleSubmission.enrollmentId, schema.enrollment.id))
    .where(eq(schema.moduleSubmission.id, submissionId))
    .limit(1);

  // An assessor scores only the cohorts they're assigned to. To anyone else the submission isn't there.
  if (!row || !(await canReachCohort(db, principal, row.enrollment.cohortId))) {
    throw new ServiceError("not_found", "Submission not found.");
  }

  const sub = row.submission;

  // Load rubric definition from module content
  const content = findVersion(sub.moduleId as ModuleId, "staff", sub.contentVersion);
  if (!content?.rubric) {
    throw new ServiceError("invalid", `Module ${sub.moduleId} has no rubric configured.`);
  }

  // Check if current assessor already scored this submission (inter-rater reliability rule:
  // a second assessor can score the same submission, but the same user cannot score twice without override).
  const existingScores = await db
    .select()
    .from(schema.rubricAssessment)
    .where(eq(schema.rubricAssessment.submissionId, submissionId))
    .orderBy(asc(schema.rubricAssessment.createdAt));

  if (existingScores.some((s) => s.assessorUserId === principal.userId)) {
    throw new ServiceError("invalid", "You have already scored this submission. Admins may override scores.");
  }

  const isFirstScore = existingScores.length === 0;
  // A second assessor's reading is a check on the first, and changes nothing, so it can still come in afterwards.
  if (isFirstScore) refuseNewWork(row.enrollment.status);

  // Evaluate scores against rubric
  const evaluation = evaluateRubric(
    content.rubric,
    input.scores,
    input.confirmedCriticalFailures ?? []
  );

  const now = new Date();

  const [assessment] = await db
    .insert(schema.rubricAssessment)
    .values({
      submissionId,
      assessorUserId: principal.userId,
      isFirstScore,
      scores: input.scores,
      criterionResults: evaluation.criterionResults,
      confirmedCriticalFailures: evaluation.confirmedCriticalFailures,
      totalPoints: evaluation.totalPoints,
      maxPoints: evaluation.maxPoints,
      percentage: String(evaluation.percentage),
      band: evaluation.band,
      passed: evaluation.passed,
      outcome: evaluation.outcome,
      feedback: input.feedback,
    })
    .returning();

  // If this is the first score, it counts for learner progress:
  if (isFirstScore) {
    // An exemption approved before the work was scored can't stand over a confirmed critical failure.
    if (evaluation.confirmedCriticalFailures.length) {
      const withdrawn = await db
        .update(schema.moduleExemption)
        .set({ status: "rejected", reviewComment: "Withdrawn: the module's submission has a confirmed critical failure.", reviewedAt: now, updatedAt: now })
        .where(and(eq(schema.moduleExemption.enrollmentId, sub.enrollmentId), eq(schema.moduleExemption.moduleId, sub.moduleId), inArray(schema.moduleExemption.status, ["pending", "approved"])))
        .returning({ id: schema.moduleExemption.id });
      for (const { id } of withdrawn) {
        await db.insert(schema.auditLog).values({
          actorUserId: principal.userId,
          organizationId: row.enrollment.organizationId,
          platform: "trade",
          action: "trade.module_exemption.withdrawn",
          entityType: "trade.module_exemption",
          entityId: id,
          reason: "Confirmed critical failure",
        });
      }
    }

    const submissionStatus = evaluation.passed ? "passed" : "revision_required";
    await db
      .update(schema.moduleSubmission)
      .set({
        status: submissionStatus,
        reviewedAt: now,
        updatedAt: now,
      })
      .where(eq(schema.moduleSubmission.id, submissionId));

    // Update module progress. A passing score is only one requirement: the evaluator below decides
    // whether the module is passed, once its lessons, knowledge check and plan are done as well.
    const progressStatus = evaluation.passed ? "in_progress" : "needs_revision";
    await db
      .update(schema.moduleProgress)
      .set({
        status: progressStatus,
        completedAt: null,
        updatedAt: now,
      })
      .where(
        and(
          eq(schema.moduleProgress.enrollmentId, sub.enrollmentId),
          eq(schema.moduleProgress.moduleId, sub.moduleId)
        )
      );

    if (evaluation.passed) {
      await evaluateAndSyncModuleCompletion(db, ctx, sub.enrollmentId, sub.moduleId as ModuleId);
    }

    // Queued after the score commits: the learner isn't told about a score that rolled back, and a queue problem can't undo one.
    after.push(async (db) => {
      try {
        const [ownerUser] = await db
          .select({ email: schema.user.email })
          .from(schema.member)
          .innerJoin(schema.user, eq(schema.member.userId, schema.user.id))
          .where(
            and(
              eq(schema.member.organizationId, row.enrollment.organizationId),
              eq(schema.member.role, "owner")
            )
          )
          .limit(1);

        if (ownerUser?.email) {
          await enqueue(JOB_NAMES.SEND_EMAIL, {
            to: ownerUser.email,
            subject: `TRADE Feedback: Module ${sub.moduleId} submission has been scored`,
            text: `Your practical deliverable for Module ${sub.moduleId} has been evaluated.\nOutcome: ${evaluation.outcome}\nScore: ${evaluation.totalPoints}/${evaluation.maxPoints} (${evaluation.band})\n\nLog in to the TRADE platform to review your assessor feedback.`,
          });
        }
      } catch (err) {
        console.warn("[trade:scoring] Could not queue notification email:", err);
      }
    });
  }

  // Audit log
  await db.insert(schema.auditLog).values({
    actorUserId: principal.userId,
    organizationId: row.enrollment.organizationId,
    platform: "trade",
    action: "trade.rubric_assessment.submitted",
    entityType: "trade.rubric_assessment",
    entityId: assessment!.id,
    after: {
      submissionId,
      isFirstScore,
      totalPoints: evaluation.totalPoints,
      percentage: evaluation.percentage,
      passed: evaluation.passed,
      outcome: evaluation.outcome,
    },
  });

  return {
    id: assessment!.id,
    submissionId: assessment!.submissionId,
    assessorUserId: assessment!.assessorUserId,
    isFirstScore: assessment!.isFirstScore,
    scores: assessment!.scores,
    criterionResults: assessment!.criterionResults as RubricAssessmentView["criterionResults"],
    confirmedCriticalFailures: assessment!.confirmedCriticalFailures,
    totalPoints: assessment!.totalPoints,
    maxPoints: assessment!.maxPoints,
    percentage: Number(assessment!.percentage),
    band: assessment!.band,
    passed: assessment!.passed,
    outcome: assessment!.outcome as RubricAssessmentView["outcome"],
    feedback: assessment!.feedback,
    overriddenByUserId: assessment!.overriddenByUserId,
    overrideReason: assessment!.overrideReason,
    createdAt: assessment!.createdAt.toISOString(),
    updatedAt: assessment!.updatedAt.toISOString(),
  };
}

/** One transaction, so a failed audit write can't leave a score changed with no record of it. */
export async function overrideRubricScore(
  ctx: Ctx,
  submissionId: string,
  input: OverrideScoreInput
): Promise<RubricAssessmentView> {
  return ctx.db.transaction((tx) => applyScoreOverride({ ...ctx, db: tx }, submissionId, input));
}

async function applyScoreOverride(
  ctx: Ctx,
  submissionId: string,
  input: OverrideScoreInput
): Promise<RubricAssessmentView> {
  const { principal, db } = ctx;

  // Only Entrust admins can change a score
  if (principal.staffRole !== "admin") {
    throw new ServiceError("forbidden", "Only Entrust administrators can override a score.");
  }

  const [row] = await db
    .select({
      submission: schema.moduleSubmission,
      enrollment: schema.enrollment,
    })
    .from(schema.moduleSubmission)
    .innerJoin(schema.enrollment, eq(schema.moduleSubmission.enrollmentId, schema.enrollment.id))
    .where(eq(schema.moduleSubmission.id, submissionId))
    .limit(1);

  if (!row) {
    throw new ServiceError("not_found", "Submission not found.");
  }

  // Find official / first score
  const [officialScore] = await db
    .select()
    .from(schema.rubricAssessment)
    .where(
      and(
        eq(schema.rubricAssessment.submissionId, submissionId),
        eq(schema.rubricAssessment.isFirstScore, true)
      )
    )
    .limit(1);

  if (!officialScore) {
    throw new ServiceError("not_found", "No official score exists on this submission to override.");
  }

  const sub = row.submission;
  const content = findVersion(sub.moduleId as ModuleId, "staff", sub.contentVersion);
  if (!content?.rubric) {
    throw new ServiceError("invalid", "Module has no rubric.");
  }

  const mergedScores = {
    ...officialScore.scores,
    ...(input.scores ?? {}),
  };
  const confirmedFailures = input.confirmedCriticalFailures ?? officialScore.confirmedCriticalFailures;

  const evaluation = evaluateRubric(content.rubric, mergedScores, confirmedFailures);
  const now = new Date();

  const [updated] = await db
    .update(schema.rubricAssessment)
    .set({
      scores: mergedScores,
      criterionResults: evaluation.criterionResults,
      confirmedCriticalFailures: confirmedFailures,
      totalPoints: evaluation.totalPoints,
      maxPoints: evaluation.maxPoints,
      percentage: String(evaluation.percentage),
      band: evaluation.band,
      passed: evaluation.passed,
      outcome: evaluation.outcome,
      feedback: input.feedback ?? officialScore.feedback,
      overriddenByUserId: principal.userId,
      overrideReason: input.overrideReason,
      updatedAt: now,
    })
    .where(eq(schema.rubricAssessment.id, officialScore.id))
    .returning();

  // Update submission and module progress with overridden outcome
  const submissionStatus = evaluation.passed ? "passed" : "revision_required";
  await db
    .update(schema.moduleSubmission)
    .set({
      status: submissionStatus,
      updatedAt: now,
    })
    .where(eq(schema.moduleSubmission.id, submissionId));

  const progressStatus = evaluation.passed ? "in_progress" : "needs_revision";
  await db
    .update(schema.moduleProgress)
    .set({
      status: progressStatus,
      completedAt: null,
      updatedAt: now,
    })
    .where(
      and(
        eq(schema.moduleProgress.enrollmentId, sub.enrollmentId),
        eq(schema.moduleProgress.moduleId, sub.moduleId)
      )
    );

  if (evaluation.passed) {
    await evaluateAndSyncModuleCompletion(db, ctx, sub.enrollmentId, sub.moduleId as ModuleId);
  } else if (officialScore.passed) {
    await reopenAfterFailedOverride(db, { principal, now }, sub.enrollmentId, sub.moduleId as ModuleId, input.overrideReason);
  }

  // Audit log with before and after details (M01 AT-15, M03 AT-15, M04 AT-11)
  await db.insert(schema.auditLog).values({
    actorUserId: principal.userId,
    organizationId: row.enrollment.organizationId,
    platform: "trade",
    action: "trade.rubric_assessment.overridden",
    entityType: "trade.rubric_assessment",
    entityId: officialScore.id,
    reason: input.overrideReason,
    before: {
      scores: officialScore.scores,
      confirmedCriticalFailures: officialScore.confirmedCriticalFailures,
      totalPoints: officialScore.totalPoints,
      passed: officialScore.passed,
      outcome: officialScore.outcome,
    },
    after: {
      overrideReason: input.overrideReason,
      scores: mergedScores,
      confirmedCriticalFailures: confirmedFailures,
      totalPoints: evaluation.totalPoints,
      passed: evaluation.passed,
      outcome: evaluation.outcome,
    },
  });

  return {
    id: updated!.id,
    submissionId: updated!.submissionId,
    assessorUserId: updated!.assessorUserId,
    isFirstScore: updated!.isFirstScore,
    scores: updated!.scores,
    criterionResults: updated!.criterionResults as RubricAssessmentView["criterionResults"],
    confirmedCriticalFailures: updated!.confirmedCriticalFailures,
    totalPoints: updated!.totalPoints,
    maxPoints: updated!.maxPoints,
    percentage: Number(updated!.percentage),
    band: updated!.band,
    passed: updated!.passed,
    outcome: updated!.outcome as RubricAssessmentView["outcome"],
    feedback: updated!.feedback,
    overriddenByUserId: updated!.overriddenByUserId,
    overrideReason: updated!.overrideReason,
    createdAt: updated!.createdAt.toISOString(),
    updatedAt: updated!.updatedAt.toISOString(),
  };
}

export async function listSubmissionScores(
  ctx: Ctx,
  submissionId: string
): Promise<SubmissionScoresList> {
  const { principal, db } = ctx;

  const [sub] = await db
    .select({
      id: schema.moduleSubmission.id,
      enrollmentId: schema.moduleSubmission.enrollmentId,
      organizationId: schema.enrollment.organizationId,
    })
    .from(schema.moduleSubmission)
    .innerJoin(schema.enrollment, eq(schema.moduleSubmission.enrollmentId, schema.enrollment.id))
    .where(eq(schema.moduleSubmission.id, submissionId))
    .limit(1);

  if (!sub) {
    throw new ServiceError("not_found", "Submission not found.");
  }

  if (!principal.staffRole && !principal.smeRoles.has(sub.organizationId)) {
    throw new ServiceError("forbidden", "Access denied.");
  }
  if (principal.staffRole && !(await accessTo(db, principal, sub.organizationId))) {
    throw new ServiceError("not_found", "Submission not found.");
  }

  const scores = await db
    .select()
    .from(schema.rubricAssessment)
    .where(eq(schema.rubricAssessment.submissionId, submissionId))
    .orderBy(asc(schema.rubricAssessment.createdAt));

  // "SME users never see the second assessor's score"
  const visibleScores = principal.staffRole
    ? scores
    : scores.filter((s) => s.isFirstScore);

  const official = scores.find((s) => s.isFirstScore) ?? null;

  const format = (s: typeof schema.rubricAssessment.$inferSelect): RubricAssessmentView => ({
    id: s.id,
    submissionId: s.submissionId,
    assessorUserId: s.assessorUserId,
    isFirstScore: s.isFirstScore,
    scores: s.scores,
    criterionResults: s.criterionResults as RubricAssessmentView["criterionResults"],
    confirmedCriticalFailures: s.confirmedCriticalFailures,
    totalPoints: s.totalPoints,
    maxPoints: s.maxPoints,
    percentage: Number(s.percentage),
    band: s.band,
    passed: s.passed,
    outcome: s.outcome as RubricAssessmentView["outcome"],
    feedback: s.feedback,
    overriddenByUserId: s.overriddenByUserId,
    overrideReason: s.overrideReason,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  });

  return {
    items: visibleScores.map(format),
    officialScore: official ? format(official) : null,
  };
}
