import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { notify, organizationMemberIds } from "./trade-notifications";
import { alias } from "drizzle-orm/pg-core";
import { schema } from "@entrust/db";
import type {
  LearningPlanStatus,
  ModuleAssignmentSource,
  ModuleExemptionStatus,
  ModuleStatus,
} from "@entrust/trade-engine";
import { latestTradeRules, type ModuleId, type Pathway } from "@entrust/trade-rules";
import type { Ctx } from "./access";
import { ServiceError } from "./errors";
import { assignedOrganizationIds, canReachOrganization, limitedToAssignedCohorts } from "./trade-shared";
import { currentLearnerVersion, evaluateAndSyncModuleCompletion, hasUnresolvedCriticalFailure, resyncCompletion, resyncProgramme } from "./trade-completion";

const isMandatoryModule = (moduleId: string): boolean => latestTradeRules().modules.some((m) => m.id === moduleId && m.requiredForAll);
import type {
  ApprovePlanInput,
  CreateExemptionInput,
  ExemptionListQueryInput,
  LearningPlanListQueryInput,
  LearningPlanRecord,
  ModuleAssignmentView,
  ModuleExemptionView,
  OverridePlanInput,
  ReviewExemptionInput,
} from "../schemas/trade";

const planReviewerUser = alias(schema.user, "plan_reviewer_user");
const exemptionRequesterUser = alias(schema.user, "exemption_requester_user");
const exemptionReviewerUser = alias(schema.user, "exemption_reviewer_user");

export async function listPlans(
  ctx: Ctx,
  query: LearningPlanListQueryInput
): Promise<LearningPlanRecord[]> {
  const { principal, db } = ctx;

  let allowedOrgIds: string[] | null = null;
  if (!principal.staffRole) {
    const smeOrgs = Array.from(principal.smeRoles.keys());
    if (smeOrgs.length === 0) {
      throw new ServiceError("forbidden", "Access denied.");
    }
    if (query.organizationId) {
      if (!principal.smeRoles.has(query.organizationId)) {
        throw new ServiceError("forbidden", "You cannot access plans for this organization.");
      }
      allowedOrgIds = [query.organizationId];
    } else {
      allowedOrgIds = smeOrgs;
    }
  } else if (query.organizationId) {
    allowedOrgIds = [query.organizationId];
  }
  // A facilitator or reviewer sees the plans of the businesses in their own cohorts.
  if (limitedToAssignedCohorts(principal)) {
    const assigned = await assignedOrganizationIds(db, principal.userId);
    allowedOrgIds = allowedOrgIds ? allowedOrgIds.filter((o) => assigned.includes(o)) : assigned;
  }

  const conditions = [];
  if (allowedOrgIds) {
    conditions.push(inArray(schema.enrollment.organizationId, allowedOrgIds));
  }
  if (query.enrollmentId) {
    conditions.push(eq(schema.learningPlan.enrollmentId, query.enrollmentId));
  }
  if (query.cohortId) {
    conditions.push(eq(schema.enrollment.cohortId, query.cohortId));
  }
  if (query.status) {
    conditions.push(eq(schema.learningPlan.status, query.status));
  }
  if (query.requiresHumanReview !== undefined) {
    conditions.push(
      eq(schema.learningPlan.requiresHumanReview, query.requiresHumanReview)
    );
  }

  const rows = await db
    .select({
      id: schema.learningPlan.id,
      enrollmentId: schema.learningPlan.enrollmentId,
      organizationId: schema.enrollment.organizationId,
      organizationName: schema.organization.name,
      assessmentId: schema.learningPlan.assessmentId,
      rulesVersion: schema.learningPlan.rulesVersion,
      pathway: schema.learningPlan.pathway,
      status: schema.learningPlan.status,
      requiresHumanReview: schema.learningPlan.requiresHumanReview,
      reviewReasons: schema.learningPlan.reviewReasons,
      reviewedByUserId: schema.learningPlan.reviewedByUserId,
      reviewedByUserName: planReviewerUser.name,
      reviewedAt: schema.learningPlan.reviewedAt,
      reviewNotes: schema.learningPlan.reviewNotes,
      acknowledgedAt: schema.learningPlan.acknowledgedAt,
      supersededById: schema.learningPlan.supersededById,
      supersededAt: schema.learningPlan.supersededAt,
      createdAt: schema.learningPlan.createdAt,
      updatedAt: schema.learningPlan.updatedAt,
    })
    .from(schema.learningPlan)
    .innerJoin(
      schema.enrollment,
      eq(schema.enrollment.id, schema.learningPlan.enrollmentId)
    )
    .innerJoin(
      schema.organization,
      eq(schema.organization.id, schema.enrollment.organizationId)
    )
    .leftJoin(
      planReviewerUser,
      eq(planReviewerUser.id, schema.learningPlan.reviewedByUserId)
    )
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(schema.learningPlan.createdAt));

  if (rows.length === 0) return [];

  const planIds = rows.map((r) => r.id);
  const assignments = await db
    .select()
    .from(schema.moduleAssignment)
    .where(inArray(schema.moduleAssignment.planId, planIds))
    .orderBy(asc(schema.moduleAssignment.sequence));

  const assignmentsByPlan = new Map<string, ModuleAssignmentView[]>();
  for (const a of assignments) {
    const list = assignmentsByPlan.get(a.planId) ?? [];
    list.push({
      id: a.id,
      planId: a.planId,
      moduleId: a.moduleId as ModuleId,
      status: a.status as ModuleStatus,
      sequence: a.sequence,
      reasonCodes: a.reasonCodes,
      source: a.source as ModuleAssignmentSource,
      createdAt: a.createdAt.toISOString(),
    });
    assignmentsByPlan.set(a.planId, list);
  }

  return rows.map((r) => ({
    id: r.id,
    enrollmentId: r.enrollmentId,
    organizationId: r.organizationId,
    organizationName: r.organizationName,
    assessmentId: r.assessmentId,
    rulesVersion: r.rulesVersion,
    pathway: r.pathway as Pathway,
    status: r.status as LearningPlanStatus,
    requiresHumanReview: r.requiresHumanReview,
    reviewReasons: r.reviewReasons,
    reviewedByUserId: r.reviewedByUserId,
    reviewedByUserName: r.reviewedByUserName ?? undefined,
    reviewedAt: r.reviewedAt ? r.reviewedAt.toISOString() : null,
    reviewNotes: r.reviewNotes,
    acknowledgedAt: r.acknowledgedAt ? r.acknowledgedAt.toISOString() : null,
    supersededById: r.supersededById,
    supersededAt: r.supersededAt ? r.supersededAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    modules: assignmentsByPlan.get(r.id) ?? [],
  }));
}

export async function getPlan(ctx: Ctx, planId: string): Promise<LearningPlanRecord> {
  const plans = await listPlans(ctx, {});
  const found = plans.find((p) => p.id === planId);
  if (!found) {
    throw new ServiceError("not_found", "Learning plan not found.");
  }
  return found;
}

export async function approvePlan(
  ctx: Ctx,
  planId: string,
  input: ApprovePlanInput
): Promise<LearningPlanRecord> {
  const { principal, now } = ctx;

  // A reviewer (the Assessor role) reads plans and changes nothing.
  if (principal.staffRole !== "admin" && principal.staffRole !== "facilitator") {
    throw new ServiceError("forbidden", "Only an Entrust administrator or facilitator can approve learning plans.");
  }
  return ctx.db.transaction(async (db) => {

  const [existing] = await db
    .select({
      id: schema.learningPlan.id,
      status: schema.learningPlan.status,
      enrollmentId: schema.learningPlan.enrollmentId,
      organizationId: schema.enrollment.organizationId,
    })
    .from(schema.learningPlan)
    .innerJoin(
      schema.enrollment,
      eq(schema.enrollment.id, schema.learningPlan.enrollmentId)
    )
    .where(eq(schema.learningPlan.id, planId));

  if (!existing || !(await canReachOrganization(db, principal, existing.organizationId))) {
    throw new ServiceError("not_found", "Learning plan not found.");
  }
  refuseFinishedPlan(existing.status);

  await db
    .update(schema.learningPlan)
    .set({
      status: "approved",
      requiresHumanReview: false,
      reviewedByUserId: principal.userId,
      reviewedAt: now,
      reviewNotes: input.notes?.trim() || null,
      updatedAt: now,
    })
    .where(eq(schema.learningPlan.id, planId));

  await db.insert(schema.auditLog).values({
    actorUserId: principal.userId,
    organizationId: existing.organizationId,
    platform: "trade",
    action: "trade.learning_plan.approved",
    entityType: "learning_plan",
    entityId: planId,
    before: { status: existing.status },
    after: { status: "approved", notes: input.notes?.trim() || null },
    reason: input.notes?.trim() || null,
  });

  await notify(db, {
    userIds: await organizationMemberIds(db, existing.organizationId),
    kind: "module_assigned",
    title: "Your learning plan was approved",
    body: "Entrust has approved your learning plan. Open it to see the modules assigned to you.",
    path: "/",
    organizationId: existing.organizationId,
  });

  return getPlan({ ...ctx, db }, planId);
  });
}

/**
 * A superseded plan was replaced by a newer one, and a completed one ended with its programme. Approving or changing
 * either would make it live again next to the plan the learner works from.
 */
function refuseFinishedPlan(status: string): void {
  if (status === "superseded") throw new ServiceError("invalid_transition", "This learning plan was replaced by a newer one, so it can't be approved or changed.");
  if (status === "completed") throw new ServiceError("invalid_transition", "This learning plan is completed, so it can't be approved or changed.");
}

/** The SME confirms it has read its plan, which M01 asks for (#71). Saying so twice changes nothing. */
export async function acknowledgePlan(ctx: Ctx, planId: string): Promise<LearningPlanRecord> {
  const { principal, db, now } = ctx;
  const [existing] = await db
    .select({ status: schema.learningPlan.status, acknowledgedAt: schema.learningPlan.acknowledgedAt, enrollmentId: schema.learningPlan.enrollmentId, organizationId: schema.enrollment.organizationId })
    .from(schema.learningPlan)
    .innerJoin(schema.enrollment, eq(schema.enrollment.id, schema.learningPlan.enrollmentId))
    .where(eq(schema.learningPlan.id, planId));
  if (!existing) throw new ServiceError("not_found", "Learning plan not found.");
  if (!principal.smeRoles.has(existing.organizationId)) {
    throw new ServiceError(principal.staffRole ? "forbidden" : "not_found", "Only the business itself can acknowledge its learning plan.");
  }
  if (existing.status === "superseded") throw new ServiceError("invalid_transition", "This learning plan has been replaced by a newer one.");
  if (!existing.acknowledgedAt) {
    await db.update(schema.learningPlan).set({ acknowledgedAt: now, updatedAt: now }).where(eq(schema.learningPlan.id, planId));
    await db.insert(schema.auditLog).values({
      actorUserId: principal.userId,
      organizationId: existing.organizationId,
      platform: "trade",
      action: "trade.learning_plan.acknowledged",
      entityType: "learning_plan",
      entityId: planId,
    });
    // M01 needs the plan acknowledged, and this can be the last thing it was waiting for.
    await evaluateAndSyncModuleCompletion(db, ctx, existing.enrollmentId, "M01");
  }
  return getPlan(ctx, planId);
}

export async function overridePlan(
  ctx: Ctx,
  planId: string,
  input: OverridePlanInput
): Promise<LearningPlanRecord> {
  return ctx.db.transaction((db) => applyPlanOverride({ ...ctx, db }, planId, input));
}

async function applyPlanOverride(
  ctx: Ctx,
  planId: string,
  input: OverridePlanInput
): Promise<LearningPlanRecord> {
  const { principal, db, now } = ctx;

  if (principal.staffRole !== "admin" && principal.staffRole !== "facilitator") {
    throw new ServiceError("forbidden", "Only an Entrust administrator or facilitator can override learning plans.");
  }

  if (!input.reason?.trim()) {
    throw new ServiceError(
      "invalid",
      "An override reason is mandatory and required."
    );
  }

  const [existing] = await db
    .select({
      id: schema.learningPlan.id,
      status: schema.learningPlan.status,
      enrollmentId: schema.learningPlan.enrollmentId,
      organizationId: schema.enrollment.organizationId,
    })
    .from(schema.learningPlan)
    .innerJoin(
      schema.enrollment,
      eq(schema.enrollment.id, schema.learningPlan.enrollmentId)
    )
    .where(eq(schema.learningPlan.id, planId));

  if (!existing || !(await canReachOrganization(db, principal, existing.organizationId))) {
    throw new ServiceError("not_found", "Learning plan not found.");
  }
  refuseFinishedPlan(existing.status);

  const currentAssignments = await db
    .select()
    .from(schema.moduleAssignment)
    .where(eq(schema.moduleAssignment.planId, planId))
    .orderBy(asc(schema.moduleAssignment.sequence));

  const beforeModules = currentAssignments.map((a) => a.moduleId);

  // Checked before anything changes, so a refused override changes nothing.
  const softened = (input.additions ?? []).filter((a) => isMandatoryModule(a.moduleId) && !["required", "priority_required"].includes(a.status ?? "required"));
  if (softened.length) throw new ServiceError("invalid", `${softened.map((a) => a.moduleId).join(", ")} must stay required: every learner has to complete them.`);

  if (input.removals && input.removals.length > 0) {
    // M11 and M12 are mandatory for everyone completing the programme (review section 8), so a plan can't drop them.
    const mandatory = latestTradeRules().modules.filter((m) => m.requiredForAll).map((m) => m.id as string);
    const blocked = input.removals.filter((id) => mandatory.includes(id));
    if (blocked.length) throw new ServiceError("invalid", `${blocked.join(", ")} can't be removed: every learner has to complete them.`);
    await db
      .delete(schema.moduleAssignment)
      .where(
        and(
          eq(schema.moduleAssignment.planId, planId),
          inArray(schema.moduleAssignment.moduleId, input.removals)
        )
      );
  }

  if (input.additions && input.additions.length > 0) {
    let maxSeq = currentAssignments.reduce(
      (max, a) => Math.max(max, a.sequence),
      0
    );

    for (const add of input.additions) {
      const seq = add.sequence ?? ++maxSeq;
      const existingItem = currentAssignments.find(
        (a) => a.moduleId === add.moduleId
      );

      if (existingItem) {
        await db
          .update(schema.moduleAssignment)
          .set({
            status: add.status ?? "required",
            sequence: seq,
            source: "staff_override",
            reasonCodes: ["STAFF_OVERRIDE"],
          })
          .where(eq(schema.moduleAssignment.id, existingItem.id));
      } else {
        await db.insert(schema.moduleAssignment).values({
          planId,
          moduleId: add.moduleId,
          status: add.status ?? "required",
          sequence: seq,
          source: "staff_override",
          reasonCodes: ["STAFF_OVERRIDE"],
          createdAt: now,
        });
      }
    }
  }

  const targetStatus = input.status ?? "approved";
  await db
    .update(schema.learningPlan)
    .set({
      status: targetStatus,
      requiresHumanReview: false,
      reviewedByUserId: principal.userId,
      reviewedAt: now,
      reviewNotes: input.reason.trim(),
      updatedAt: now,
    })
    .where(eq(schema.learningPlan.id, planId));

  await db.insert(schema.auditLog).values({
    actorUserId: principal.userId,
    organizationId: existing.organizationId,
    platform: "trade",
    action: "trade.learning_plan.overridden",
    entityType: "learning_plan",
    entityId: planId,
    before: { modules: beforeModules, status: existing.status },
    after: {
      status: targetStatus,
      additions: input.additions,
      removals: input.removals,
    },
    reason: input.reason.trim(),
  });

  // Dropping the last module left can finish the programme, and adding one to a finished programme reopens it.
  await resyncProgramme(db, ctx, existing.enrollmentId, `Learning plan changed: ${input.reason.trim()}`);

  return getPlan(ctx, planId);
}

export async function listExemptions(
  ctx: Ctx,
  query: ExemptionListQueryInput
): Promise<ModuleExemptionView[]> {
  const { principal, db } = ctx;

  let allowedOrgIds: string[] | null = null;
  if (!principal.staffRole) {
    const smeOrgs = Array.from(principal.smeRoles.keys());
    if (smeOrgs.length === 0) {
      throw new ServiceError("forbidden", "Access denied.");
    }
    if (query.organizationId) {
      if (!principal.smeRoles.has(query.organizationId)) {
        throw new ServiceError("forbidden", "You cannot access exemptions for this organization.");
      }
      allowedOrgIds = [query.organizationId];
    } else {
      allowedOrgIds = smeOrgs;
    }
  } else if (query.organizationId) {
    allowedOrgIds = [query.organizationId];
  }
  // A facilitator or reviewer sees the plans of the businesses in their own cohorts.
  if (limitedToAssignedCohorts(principal)) {
    const assigned = await assignedOrganizationIds(db, principal.userId);
    allowedOrgIds = allowedOrgIds ? allowedOrgIds.filter((o) => assigned.includes(o)) : assigned;
  }

  const conditions = [];
  if (allowedOrgIds) {
    conditions.push(inArray(schema.enrollment.organizationId, allowedOrgIds));
  }
  if (query.enrollmentId) {
    conditions.push(eq(schema.moduleExemption.enrollmentId, query.enrollmentId));
  }
  if (query.moduleId) {
    conditions.push(eq(schema.moduleExemption.moduleId, query.moduleId));
  }
  if (query.status) {
    conditions.push(eq(schema.moduleExemption.status, query.status));
  }

  const rows = await db
    .select({
      id: schema.moduleExemption.id,
      enrollmentId: schema.moduleExemption.enrollmentId,
      organizationId: schema.enrollment.organizationId,
      organizationName: schema.organization.name,
      moduleId: schema.moduleExemption.moduleId,
      evidenceRecordId: schema.moduleExemption.evidenceRecordId,
      evidenceTitle: schema.evidenceRecord.title,
      status: schema.moduleExemption.status,
      reason: schema.moduleExemption.reason,
      requestedByUserId: schema.moduleExemption.requestedByUserId,
      requestedByUserName: exemptionRequesterUser.name,
      reviewedByUserId: schema.moduleExemption.reviewedByUserId,
      reviewedByUserName: exemptionReviewerUser.name,
      reviewedAt: schema.moduleExemption.reviewedAt,
      reviewComment: schema.moduleExemption.reviewComment,
      createdAt: schema.moduleExemption.createdAt,
      updatedAt: schema.moduleExemption.updatedAt,
    })
    .from(schema.moduleExemption)
    .innerJoin(
      schema.enrollment,
      eq(schema.enrollment.id, schema.moduleExemption.enrollmentId)
    )
    .innerJoin(
      schema.organization,
      eq(schema.organization.id, schema.enrollment.organizationId)
    )
    .innerJoin(
      schema.evidenceRecord,
      eq(schema.evidenceRecord.id, schema.moduleExemption.evidenceRecordId)
    )
    .leftJoin(
      exemptionRequesterUser,
      eq(exemptionRequesterUser.id, schema.moduleExemption.requestedByUserId)
    )
    .leftJoin(
      exemptionReviewerUser,
      eq(exemptionReviewerUser.id, schema.moduleExemption.reviewedByUserId)
    )
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(schema.moduleExemption.createdAt));

  return rows.map((r) => ({
    id: r.id,
    enrollmentId: r.enrollmentId,
    organizationId: r.organizationId,
    organizationName: r.organizationName,
    moduleId: r.moduleId as ModuleId,
    evidenceRecordId: r.evidenceRecordId,
    evidenceTitle: r.evidenceTitle,
    status: r.status as ModuleExemptionStatus,
    reason: r.reason,
    requestedByUserId: r.requestedByUserId,
    requestedByUserName: r.requestedByUserName ?? undefined,
    reviewedByUserId: r.reviewedByUserId,
    reviewedByUserName: r.reviewedByUserName ?? undefined,
    reviewedAt: r.reviewedAt ? r.reviewedAt.toISOString() : null,
    reviewComment: r.reviewComment,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));
}

export async function createExemption(
  ctx: Ctx,
  input: CreateExemptionInput
): Promise<ModuleExemptionView> {
  const { principal, db, now } = ctx;

  const [enr] = await db
    .select({
      id: schema.enrollment.id,
      organizationId: schema.enrollment.organizationId,
    })
    .from(schema.enrollment)
    .where(eq(schema.enrollment.id, input.enrollmentId));

  if (!enr) {
    throw new ServiceError("not_found", "Enrollment not found.");
  }

  if (!principal.staffRole && !principal.smeRoles.has(enr.organizationId)) {
    throw new ServiceError(
      "forbidden",
      "You cannot request exemptions for this organization."
    );
  }
  if (principal.staffRole && !principal.smeRoles.has(enr.organizationId) && !(await canReachOrganization(db, principal, enr.organizationId))) {
    throw new ServiceError("not_found", "Enrollment not found.");
  }
  if (isMandatoryModule(input.moduleId)) {
    throw new ServiceError("invalid", `${input.moduleId} can't be exempted: every learner has to complete it.`);
  }

  const [evidence] = await db
    .select({
      id: schema.evidenceRecord.id,
      organizationId: schema.evidenceRecord.organizationId,
    })
    .from(schema.evidenceRecord)
    .where(eq(schema.evidenceRecord.id, input.evidenceRecordId));

  if (!evidence) {
    throw new ServiceError(
      "not_found",
      "Backing evidence record not found."
    );
  }

  if (evidence.organizationId !== enr.organizationId) {
    throw new ServiceError(
      "invalid",
      "Evidence record does not belong to this SME organization."
    );
  }

  const [inserted] = await db
    .insert(schema.moduleExemption)
    .values({
      enrollmentId: input.enrollmentId,
      moduleId: input.moduleId,
      evidenceRecordId: input.evidenceRecordId,
      status: "pending",
      reason: input.reason.trim(),
      requestedByUserId: principal.userId,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  if (!inserted) {
    throw new Error("Failed to create module exemption.");
  }

  await db.insert(schema.auditLog).values({
    actorUserId: principal.userId,
    organizationId: enr.organizationId,
    platform: "trade",
    action: "trade.module_exemption.requested",
    entityType: "module_exemption",
    entityId: inserted.id,
    after: {
      id: inserted.id,
      moduleId: input.moduleId,
      evidenceRecordId: input.evidenceRecordId,
      reason: input.reason.trim(),
    },
  });

  const list = await listExemptions(ctx, {
    enrollmentId: input.enrollmentId,
  });
  const found = list.find((e) => e.id === inserted.id);
  if (!found) {
    throw new ServiceError("not_found", "Failed to retrieve created exemption.");
  }
  return found;
}

export async function reviewExemption(
  ctx: Ctx,
  exemptionId: string,
  input: ReviewExemptionInput
): Promise<ModuleExemptionView> {
  return ctx.db.transaction((db) => applyExemptionReview({ ...ctx, db }, exemptionId, input));
}

async function applyExemptionReview(
  ctx: Ctx,
  exemptionId: string,
  input: ReviewExemptionInput
): Promise<ModuleExemptionView> {
  const { principal, db, now } = ctx;

  if (principal.staffRole !== "admin" && principal.staffRole !== "facilitator") {
    throw new ServiceError("forbidden", "Only an Entrust administrator or facilitator can review exemptions.");
  }

  if (input.status === "rejected" && !input.comment?.trim()) {
    throw new ServiceError(
      "invalid",
      "A comment is required when rejecting a module exemption."
    );
  }

  const [existing] = await db
    .select({
      id: schema.moduleExemption.id,
      enrollmentId: schema.moduleExemption.enrollmentId,
      moduleId: schema.moduleExemption.moduleId,
      status: schema.moduleExemption.status,
      organizationId: schema.enrollment.organizationId,
    })
    .from(schema.moduleExemption)
    .innerJoin(
      schema.enrollment,
      eq(schema.enrollment.id, schema.moduleExemption.enrollmentId)
    )
    .where(eq(schema.moduleExemption.id, exemptionId));

  if (!existing || !(await canReachOrganization(db, principal, existing.organizationId))) {
    throw new ServiceError("not_found", "Module exemption not found.");
  }

  if (input.status === "approved") {
    if (isMandatoryModule(existing.moduleId)) {
      throw new ServiceError("invalid", `${existing.moduleId} can't be exempted: every learner has to complete it.`);
    }
    // Critical failures block a pass whatever the score, so an exemption can't be the way round one until a later pass.
    if (await hasUnresolvedCriticalFailure(db, existing.enrollmentId, existing.moduleId)) {
      throw new ServiceError("invalid", "This module has a confirmed critical failure, so it can't be exempted.");
    }
  }

  await db
    .update(schema.moduleExemption)
    .set({
      status: input.status,
      reviewedByUserId: principal.userId,
      reviewedAt: now,
      reviewComment: input.comment?.trim() || null,
      updatedAt: now,
    })
    .where(eq(schema.moduleExemption.id, exemptionId));

  // If approved, update or insert moduleProgress to "exempted"
  if (input.status === "approved") {
    const [existingProgress] = await db
      .select({ id: schema.moduleProgress.id })
      .from(schema.moduleProgress)
      .where(
        and(
          eq(schema.moduleProgress.enrollmentId, existing.enrollmentId),
          eq(schema.moduleProgress.moduleId, existing.moduleId)
        )
      );

    if (existingProgress) {
      await db
        .update(schema.moduleProgress)
        .set({
          status: "exempted",
          completedAt: now,
          updatedAt: now,
        })
        .where(eq(schema.moduleProgress.id, existingProgress.id));
    } else {
      const version = await currentLearnerVersion(db, existing.moduleId as ModuleId);
      if (!version) throw new ServiceError("invalid", `${existing.moduleId} has no approved content yet.`);
      await db.insert(schema.moduleProgress).values({
        enrollmentId: existing.enrollmentId,
        moduleId: existing.moduleId,
        contentVersion: version,
        status: "exempted",
        completedAt: now,
        createdAt: now,
        updatedAt: now,
      });
    }
  } else if (existing.status === "approved") {
    // Taking an exemption back puts the module back to work: it no longer counts towards the certificate.
    const [progress] = await db
      .select({ id: schema.moduleProgress.id, status: schema.moduleProgress.status, startedAt: schema.moduleProgress.startedAt })
      .from(schema.moduleProgress)
      .where(and(eq(schema.moduleProgress.enrollmentId, existing.enrollmentId), eq(schema.moduleProgress.moduleId, existing.moduleId)));
    if (progress?.status === "exempted") {
      await db
        .update(schema.moduleProgress)
        .set({ status: progress.startedAt ? "in_progress" : "not_started", completedAt: null, updatedAt: now })
        .where(eq(schema.moduleProgress.id, progress.id));
    }
  }

  await db.insert(schema.auditLog).values({
    actorUserId: principal.userId,
    organizationId: existing.organizationId,
    platform: "trade",
    action: "trade.module_exemption.reviewed",
    entityType: "module_exemption",
    entityId: exemptionId,
    before: { status: existing.status },
    after: {
      status: input.status,
      comment: input.comment?.trim() || null,
    },
    reason: input.comment?.trim() || null,
  });

  // An approval can finish the programme; taking one back can reopen it.
  if (existing.status !== input.status) {
    await resyncCompletion(db, ctx, existing.enrollmentId, existing.moduleId as ModuleId, `Exemption for ${existing.moduleId} ${input.status}`);
  }

  const list = await listExemptions(ctx, {
    enrollmentId: existing.enrollmentId,
  });
  const found = list.find((e) => e.id === exemptionId);
  if (!found) {
    throw new ServiceError("not_found", "Module exemption not found.");
  }
  return found;
}
