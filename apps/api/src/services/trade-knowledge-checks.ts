import { and, desc, eq, inArray } from "drizzle-orm";
import { schema } from "@entrust/db";
import { gradeKnowledgeCheck } from "@entrust/trade-engine";
import { MODULE_IDS, type ModuleId } from "@entrust/trade-rules";
import type { Ctx } from "./access";
import { ServiceError } from "./errors";
import { canReachCohort, canReachOrganization, refuseNewWork } from "./trade-shared";
import { currentLearnerVersion, evaluateAndSyncModuleCompletion } from "./trade-completion";
import { resolveTradeModuleContent } from "./trade-modules";
import type {
  CohortKnowledgeCheckStats,
  KnowledgeCheckAttemptInput,
  KnowledgeCheckAttemptResult,
  KnowledgeCheckHistoryList,
} from "../schemas/trade";

export async function submitKnowledgeCheckAttempt(
  ctx: Ctx,
  moduleId: ModuleId,
  input: KnowledgeCheckAttemptInput
): Promise<KnowledgeCheckAttemptResult> {
  const { principal, db } = ctx;

  const [enrollment] = await db
    .select({
      id: schema.enrollment.id,
      organizationId: schema.enrollment.organizationId,
      status: schema.enrollment.status,
    })
    .from(schema.enrollment)
    .where(eq(schema.enrollment.id, input.enrollmentId))
    .limit(1);

  if (!enrollment) {
    throw new ServiceError("not_found", "Enrollment not found.");
  }

  // Staff cannot submit learner attempts ("Staff can open any learner's view, read-only")
  if (principal.staffRole && !principal.smeRoles.has(enrollment.organizationId)) {
    throw new ServiceError("forbidden", "Staff have read-only access to learner progress.");
  }

  if (!principal.smeRoles.has(enrollment.organizationId)) {
    throw new ServiceError("forbidden", "Access denied.");
  }
  refuseNewWork(enrollment.status);

  // Graded on the version the learner is pinned to, which is set when they start the module (the newest approved one
  // then). Naming another version, such as a retired one with easier questions, isn't the learner's choice.
  const [pinnedProgress] = await db
    .select({ contentVersion: schema.moduleProgress.contentVersion })
    .from(schema.moduleProgress)
    .where(and(eq(schema.moduleProgress.enrollmentId, input.enrollmentId), eq(schema.moduleProgress.moduleId, moduleId)))
    .limit(1);
  const pinned = pinnedProgress?.contentVersion ?? (await currentLearnerVersion(db, moduleId));
  if (!pinned) throw new ServiceError("not_found", `Module ${moduleId} has no approved content available.`);
  if (input.contentVersion !== undefined && input.contentVersion !== pinned) {
    throw new ServiceError("invalid", `You're working on version ${pinned} of ${moduleId}, so its knowledge check is the one you take.`);
  }
  // Load the module content with answer keys (server-side grading).
  const content = await resolveTradeModuleContent(db, moduleId, "staff", pinned);
  if (!content) {
    throw new ServiceError("not_found", `Module ${moduleId} has no approved content available.`);
  }

  if (!content.knowledgeCheck?.questions?.length) {
    throw new ServiceError("invalid", `Module ${moduleId} has no knowledge check configured.`);
  }

  const evaluation = gradeKnowledgeCheck(
    content.knowledgeCheck.questions,
    input.answers,
    content.knowledgeCheck.passMark ?? 80
  );

  // Determine next attempt number
  const [latestAttempt] = await db
    .select({ attemptNumber: schema.knowledgeCheckAttempt.attemptNumber })
    .from(schema.knowledgeCheckAttempt)
    .where(
      and(
        eq(schema.knowledgeCheckAttempt.enrollmentId, input.enrollmentId),
        eq(schema.knowledgeCheckAttempt.moduleId, moduleId)
      )
    )
    .orderBy(desc(schema.knowledgeCheckAttempt.attemptNumber))
    .limit(1);

  const nextAttemptNumber = (latestAttempt?.attemptNumber ?? 0) + 1;

  // Persist attempt
  const [attempt] = await db
    .insert(schema.knowledgeCheckAttempt)
    .values({
      enrollmentId: input.enrollmentId,
      moduleId,
      contentVersion: content.version,
      attemptNumber: nextAttemptNumber,
      score: String(evaluation.score),
      passed: evaluation.passed,
      totalQuestions: evaluation.totalQuestions,
      correctCount: evaluation.correctCount,
      answers: input.answers,
      results: evaluation.results,
      submittedByUserId: principal.userId,
    })
    .returning();

  // Update or insert module progress
  const [existingProgress] = await db
    .select()
    .from(schema.moduleProgress)
    .where(
      and(
        eq(schema.moduleProgress.enrollmentId, input.enrollmentId),
        eq(schema.moduleProgress.moduleId, moduleId)
      )
    )
    .limit(1);

  const now = new Date();
  let theoryCompletedAt: Date | null = existingProgress?.theoryCompletedAt ?? null;
  const currentScore = existingProgress?.knowledgeCheckScore
    ? Number(existingProgress.knowledgeCheckScore)
    : null;
  const bestScore = currentScore !== null ? Math.max(currentScore, evaluation.score) : evaluation.score;

  if (evaluation.passed && !theoryCompletedAt) {
    theoryCompletedAt = now;
  }

  let status = existingProgress?.status ?? "not_started";
  if (status === "not_started") {
    status = "in_progress";
  }

  if (existingProgress) {
    await db
      .update(schema.moduleProgress)
      .set({
        status,
        theoryCompletedAt,
        knowledgeCheckScore: String(bestScore),
        updatedAt: now,
      })
      .where(eq(schema.moduleProgress.id, existingProgress.id));
  } else {
    await db.insert(schema.moduleProgress).values({
      enrollmentId: input.enrollmentId,
      moduleId,
      contentVersion: content.version,
      status,
      startedAt: now,
      theoryCompletedAt,
      knowledgeCheckScore: String(bestScore),
      lessonProgress: {},
    });
  }

  if (evaluation.passed) {
    await evaluateAndSyncModuleCompletion(db, ctx, input.enrollmentId, moduleId);
  }

  // Audit log
  await db.insert(schema.auditLog).values({
    actorUserId: principal.userId,
    organizationId: enrollment.organizationId,
    platform: "trade",
    action: evaluation.passed ? "trade.knowledge_check.passed" : "trade.knowledge_check.attempted",
    entityType: "trade.knowledge_check_attempt",
    entityId: attempt!.id,
    after: {
      enrollmentId: input.enrollmentId,
      moduleId,
      contentVersion: content.version,
      attemptNumber: nextAttemptNumber,
      score: evaluation.score,
      passed: evaluation.passed,
    },
  });

  return {
    id: attempt!.id,
    enrollmentId: attempt!.enrollmentId,
    moduleId,
    contentVersion: attempt!.contentVersion,
    attemptNumber: attempt!.attemptNumber,
    score: Number(attempt!.score),
    passed: attempt!.passed,
    totalQuestions: attempt!.totalQuestions,
    correctCount: attempt!.correctCount,
    // A failed attempt gives the score only. Retakes are unlimited, so the key, or even which questions were right, would let
    // anyone pass by changing only the wrong answers (four options each: four tries at most). A pass shows everything.
    results: evaluation.passed
      ? evaluation.results
      : evaluation.results.map((r) => ({ questionId: r.questionId, questionText: r.questionText, submittedAnswers: r.submittedAnswers, correctAnswers: [] })),
    theoryCompletedAt: theoryCompletedAt?.toISOString() ?? null,
    createdAt: attempt!.createdAt.toISOString(),
  };
}

export async function listKnowledgeCheckAttempts(
  ctx: Ctx,
  moduleId: ModuleId,
  enrollmentId: string
): Promise<KnowledgeCheckHistoryList> {
  const { principal, db } = ctx;

  const [enrollment] = await db
    .select({
      id: schema.enrollment.id,
      organizationId: schema.enrollment.organizationId,
    })
    .from(schema.enrollment)
    .where(eq(schema.enrollment.id, enrollmentId))
    .limit(1);

  if (!enrollment) {
    throw new ServiceError("not_found", "Enrollment not found.");
  }

  if (!principal.staffRole && !principal.smeRoles.has(enrollment.organizationId)) {
    throw new ServiceError("forbidden", "Access denied.");
  }
  if (principal.staffRole && !(await canReachOrganization(db, principal, enrollment.organizationId))) {
    throw new ServiceError("not_found", "Enrollment not found.");
  }

  const rows = await db
    .select()
    .from(schema.knowledgeCheckAttempt)
    .where(
      and(
        eq(schema.knowledgeCheckAttempt.enrollmentId, enrollmentId),
        eq(schema.knowledgeCheckAttempt.moduleId, moduleId)
      )
    )
    .orderBy(desc(schema.knowledgeCheckAttempt.attemptNumber));

  let bestScore: number | null = null;
  let hasPassed = false;

  for (const row of rows) {
    const num = Number(row.score);
    if (bestScore === null || num > bestScore) {
      bestScore = num;
    }
    if (row.passed) {
      hasPassed = true;
    }
  }

  return {
    items: rows.map((r) => ({
      id: r.id,
      attemptNumber: r.attemptNumber,
      score: Number(r.score),
      passed: r.passed,
      totalQuestions: r.totalQuestions,
      correctCount: r.correctCount,
      contentVersion: r.contentVersion,
      createdAt: r.createdAt.toISOString(),
    })),
    bestScore,
    hasPassed,
  };
}

export async function getCohortKnowledgeCheckStats(
  ctx: Ctx,
  cohortId: string
): Promise<CohortKnowledgeCheckStats> {
  const { principal, db } = ctx;

  if (!principal.staffRole) {
    throw new ServiceError("forbidden", "Staff access required.");
  }
  if (!(await canReachCohort(db, principal, cohortId))) {
    throw new ServiceError("not_found", "Cohort not found.");
  }

  const [cohort] = await db
    .select({ id: schema.cohort.id })
    .from(schema.cohort)
    .where(eq(schema.cohort.id, cohortId))
    .limit(1);

  if (!cohort) {
    throw new ServiceError("not_found", "Cohort not found.");
  }

  const enrollments = await db
    .select({ id: schema.enrollment.id })
    .from(schema.enrollment)
    .where(eq(schema.enrollment.cohortId, cohortId));

  const totalLearners = enrollments.length;

  if (totalLearners === 0) {
    return {
      cohortId,
      modules: MODULE_IDS.map((moduleId) => ({
        moduleId,
        attemptsCount: 0,
        learnersPassed: 0,
        totalLearners: 0,
        passRate: 0,
      })),
    };
  }

  const enrollmentIds = enrollments.map((e) => e.id);

  const attempts = await db
    .select({
      moduleId: schema.knowledgeCheckAttempt.moduleId,
      enrollmentId: schema.knowledgeCheckAttempt.enrollmentId,
      passed: schema.knowledgeCheckAttempt.passed,
    })
    .from(schema.knowledgeCheckAttempt)
    .where(inArray(schema.knowledgeCheckAttempt.enrollmentId, enrollmentIds));

  const modules = MODULE_IDS.map((moduleId) => {
    const modAttempts = attempts.filter((a) => a.moduleId === moduleId);
    const passedEnrollments = new Set(
      modAttempts.filter((a) => a.passed).map((a) => a.enrollmentId)
    );
    const learnersPassed = passedEnrollments.size;
    const passRate = totalLearners > 0 ? Math.round((learnersPassed / totalLearners) * 100) : 0;

    return {
      moduleId,
      attemptsCount: modAttempts.length,
      learnersPassed,
      totalLearners,
      passRate,
    };
  });

  return {
    cohortId,
    modules,
  };
}
