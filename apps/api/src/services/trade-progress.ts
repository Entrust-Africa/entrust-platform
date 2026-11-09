import { and, eq, sql } from "drizzle-orm";
import { schema } from "@entrust/db";
import type { ModuleProgressStatus } from "@entrust/trade-engine";
import type { ModuleId } from "@entrust/trade-rules";
import type { Ctx } from "./access";
import { ServiceError } from "./errors";
import { canReachOrganization } from "./trade-shared";
import { evaluateAndSyncModuleCompletion } from "./trade-completion";
import type {
  ModuleProgressQueryInput,
  ModuleProgressView,
  RecordModuleProgressInput,
} from "../schemas/trade";

export async function listEnrollmentProgress(
  ctx: Ctx,
  query: ModuleProgressQueryInput
): Promise<ModuleProgressView[]> {
  const { principal, db } = ctx;

  const [enrollment] = await db
    .select({
      id: schema.enrollment.id,
      organizationId: schema.enrollment.organizationId,
    })
    .from(schema.enrollment)
    .where(eq(schema.enrollment.id, query.enrollmentId))
    .limit(1);

  if (!enrollment) {
    throw new ServiceError("not_found", "Enrollment not found.");
  }

  // Staff can inspect any learner's progress read-only.
  // SME users can only inspect their own organization's enrollment.
  if (!principal.staffRole) {
    if (!principal.smeRoles.has(enrollment.organizationId)) {
      throw new ServiceError("forbidden", "Access denied.");
    }
  } else if (!(await canReachOrganization(db, principal, enrollment.organizationId))) {
    throw new ServiceError("not_found", "Enrollment not found.");
  }

  const conditions = [eq(schema.moduleProgress.enrollmentId, query.enrollmentId)];
  if (query.moduleId) {
    conditions.push(eq(schema.moduleProgress.moduleId, query.moduleId));
  }

  const rows = await db
    .select()
    .from(schema.moduleProgress)
    .where(and(...conditions));

  return rows.map((r) => ({
    id: r.id,
    enrollmentId: r.enrollmentId,
    moduleId: r.moduleId as ModuleId,
    contentVersion: r.contentVersion,
    status: r.status as ModuleProgressStatus,
    lessonProgress: (r.lessonProgress as Record<string, unknown>) ?? {},
    startedAt: r.startedAt?.toISOString() ?? null,
    theoryCompletedAt: r.theoryCompletedAt?.toISOString() ?? null,
    knowledgeCheckScore: r.knowledgeCheckScore !== null ? Number(r.knowledgeCheckScore) : null,
    completedAt: r.completedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));
}

const LEARNER_SET_STATUSES: readonly ModuleProgressStatus[] = ["not_started", "in_progress", "submitted"];
const RESULT_STATUSES: readonly ModuleProgressStatus[] = ["passed", "exempted"];

/** Saves for one enrolment run one at a time. Two at once could collide on a first save, or lose a completed lesson. */
export async function recordModuleProgress(ctx: Ctx, input: RecordModuleProgressInput): Promise<ModuleProgressView> {
  return ctx.db.transaction(async (tx) => {
    await tx.select({ id: schema.enrollment.id }).from(schema.enrollment).where(eq(schema.enrollment.id, input.enrollmentId)).for("update");
    return applyModuleProgress({ ...ctx, db: tx }, input);
  });
}

async function applyModuleProgress(
  ctx: Ctx,
  input: RecordModuleProgressInput
): Promise<ModuleProgressView> {
  const { principal, db } = ctx;

  const [enrollment] = await db
    .select({
      id: schema.enrollment.id,
      organizationId: schema.enrollment.organizationId,
    })
    .from(schema.enrollment)
    .where(eq(schema.enrollment.id, input.enrollmentId))
    .limit(1);

  if (!enrollment) {
    throw new ServiceError("not_found", "Enrollment not found.");
  }

  // Staff cannot record learner progress ("Staff can open any learner's view, read-only")
  if (principal.staffRole && !principal.smeRoles.has(enrollment.organizationId)) {
    throw new ServiceError("forbidden", "Staff have read-only access to learner progress.");
  }

  if (!principal.smeRoles.has(enrollment.organizationId)) {
    throw new ServiceError("forbidden", "Access denied.");
  }

  // Check active plan and assignment for submission constraints:
  // "Modules outside the learner's plan can be read as a preview but not submitted."
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

  let isAssigned = false;
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
    if (assignment) isAssigned = true;
  }

  if (input.status === "submitted" && !isAssigned) {
    throw new ServiceError(
      "invalid",
      "A module outside the plan cannot be submitted."
    );
  }

  const [existing] = await db
    .select()
    .from(schema.moduleProgress)
    .where(
      and(
        eq(schema.moduleProgress.enrollmentId, input.enrollmentId),
        eq(schema.moduleProgress.moduleId, input.moduleId)
      )
    )
    .limit(1);

  const progressData: Record<string, unknown> =
    (existing?.lessonProgress as Record<string, unknown>) ?? {};
  const completedLessons: string[] = Array.isArray(progressData.completedLessons)
    ? [...(progressData.completedLessons as string[])]
    : [];

  if (input.lessonId) {
    progressData.lastLessonId = input.lessonId;
    if (input.completed === true) {
      if (!completedLessons.includes(input.lessonId)) {
        completedLessons.push(input.lessonId);
      }
    } else if (input.completed === false) {
      const idx = completedLessons.indexOf(input.lessonId);
      if (idx !== -1) completedLessons.splice(idx, 1);
    }
  }
  progressData.completedLessons = completedLessons;

  // A module's result comes from its assessment, an approved exemption or a staff override, never from
  // the learner's own request. Once it has one, the learner's requests can't change it either.
  if (input.status) {
    if (!LEARNER_SET_STATUSES.includes(input.status)) {
      throw new ServiceError("forbidden", "A module's result comes from its assessment.");
    }
    if (existing && RESULT_STATUSES.includes(existing.status as ModuleProgressStatus) && input.status !== existing.status) {
      throw new ServiceError("invalid_transition", "This module already has a result.");
    }
  }

  let newStatus: ModuleProgressStatus =
    input.status ?? (existing?.status as ModuleProgressStatus) ?? "in_progress";
  if (newStatus === "not_started" && (input.lessonId || input.completed)) {
    newStatus = "in_progress";
  }

  const now = new Date();
  const startedAt = existing?.startedAt ?? now;
  let completedAt = existing?.completedAt ?? null;
  if (["passed", "submitted", "exempted"].includes(newStatus)) {
    completedAt = completedAt ?? now;
  }

  const contentVersion = input.contentVersion ?? existing?.contentVersion ?? "1.0.0";

  let record: typeof schema.moduleProgress.$inferSelect;

  if (existing) {
    const [updated] = await db
      .update(schema.moduleProgress)
      .set({
        status: newStatus,
        lessonProgress: progressData,
        contentVersion,
        startedAt,
        completedAt,
        updatedAt: now,
      })
      .where(eq(schema.moduleProgress.id, existing.id))
      .returning();
    record = updated!;
  } else {
    const [inserted] = await db
      .insert(schema.moduleProgress)
      .values({
        enrollmentId: input.enrollmentId,
        moduleId: input.moduleId,
        contentVersion,
        status: newStatus,
        lessonProgress: progressData,
        startedAt,
        completedAt,
      })
      .returning();
    record = inserted!;
  }

  await db.insert(schema.auditLog).values({
    actorUserId: principal.userId,
    organizationId: enrollment.organizationId,
    platform: "trade",
    action: "trade.module_progress.updated",
    entityType: "trade.module_progress",
    entityId: record.id,
    after: {
      enrollmentId: input.enrollmentId,
      moduleId: input.moduleId,
      status: newStatus,
      lastLessonId: progressData.lastLessonId,
      completedLessonsCount: completedLessons.length,
    },
  });

  // The last lesson can be what's left, after the knowledge check and the assessor's score.
  if (input.completed === true && record.status !== "passed") {
    await evaluateAndSyncModuleCompletion(db, ctx, input.enrollmentId, input.moduleId);
    const [latest] = await db.select().from(schema.moduleProgress).where(eq(schema.moduleProgress.id, record.id)).limit(1);
    if (latest) record = latest;
  }

  return {
    id: record.id,
    enrollmentId: record.enrollmentId,
    moduleId: record.moduleId as ModuleId,
    contentVersion: record.contentVersion,
    status: record.status as ModuleProgressStatus,
    lessonProgress: (record.lessonProgress as Record<string, unknown>) ?? {},
    startedAt: record.startedAt?.toISOString() ?? null,
    theoryCompletedAt: record.theoryCompletedAt?.toISOString() ?? null,
    knowledgeCheckScore: record.knowledgeCheckScore !== null ? Number(record.knowledgeCheckScore) : null,
    completedAt: record.completedAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}
