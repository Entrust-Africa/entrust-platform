import { and, count, eq, isNull } from "drizzle-orm";
import { schema } from "@entrust/db";
import { ELIGIBILITY_CRITERIA, type EligibilityCriterionId } from "@entrust/summit-engine";
import type { ApplicationDetailView, OfficerListView } from "../schemas/summit";
import { requireStaff, type Ctx } from "./access";
import type { Executor } from "./db";
import { ServiceError } from "./errors";
import { findApplication, requireStaffRole } from "./summit-access";
import { buildDetail, latestEligibility, loadPeriod, reload, screenApplication } from "./summit-applications";
import { changeStatus, recordSummitChange } from "./summit-status";

// What Entrust's administrators do with an application before and during assessment (#79): hand it to an
// assessment officer, and accept an applicant that falls short of a requirement.

/** The assessment officers: members of the Entrust organisation with the reviewer role. */
async function officers(db: Executor) {
  const entrustOrganizationId = process.env.ENTRUST_ORG_ID;
  if (!entrustOrganizationId) return [];
  return db
    .select({ userId: schema.user.id, name: schema.user.name, email: schema.user.email })
    .from(schema.member)
    .innerJoin(schema.user, eq(schema.user.id, schema.member.userId))
    .where(and(eq(schema.member.organizationId, entrustOrganizationId), eq(schema.member.role, "reviewer")))
    .orderBy(schema.user.name);
}

export async function listOfficers(ctx: Ctx): Promise<OfficerListView> {
  requireStaff(ctx.principal, ["admin", "facilitator"], "list the assessment officers");
  const [list, workload] = await Promise.all([
    officers(ctx.db),
    ctx.db
      .select({ userId: schema.officerAssignment.officerUserId, assigned: count() })
      .from(schema.officerAssignment)
      .where(isNull(schema.officerAssignment.endedAt))
      .groupBy(schema.officerAssignment.officerUserId),
  ]);
  const assigned = new Map(workload.map((w) => [w.userId, w.assigned]));
  return { items: list.map((o) => ({ ...o, assigned: assigned.get(o.userId) ?? 0 })) };
}

/**
 * Assigns an eligible application to an assessment officer, which starts its assessment, or hands one already in
 * assessment to another officer. Only the officer it is assigned to can open it from then on. The earlier
 * assignment is kept with the time it ended.
 */
export async function assignOfficer(ctx: Ctx, id: string, officerUserId: string): Promise<ApplicationDetailView> {
  return ctx.db.transaction(async (tx) => {
    const { row, access } = await findApplication(tx, ctx.principal, id, { lock: true });
    requireStaffRole(access, ["admin", "facilitator"], "assign an application to an officer");
    if (row.status !== "eligible" && row.status !== "under_assessment") {
      throw new ServiceError("invalid_transition", "Only an eligible application, or one already in assessment, can be assigned to an officer.");
    }
    const officer = (await officers(tx)).find((o) => o.userId === officerUserId);
    if (!officer) throw new ServiceError("invalid", "That user isn't an assessment officer.");

    const [current] = await tx
      .select()
      .from(schema.officerAssignment)
      .where(and(eq(schema.officerAssignment.applicationId, id), isNull(schema.officerAssignment.endedAt)));
    if (current?.officerUserId === officerUserId) {
      throw new ServiceError("invalid_transition", "The application is already assigned to that officer.");
    }
    if (current) {
      await tx.update(schema.officerAssignment).set({ endedAt: ctx.now }).where(eq(schema.officerAssignment.id, current.id));
    }
    await tx.insert(schema.officerAssignment).values({ applicationId: id, officerUserId, assignedBy: ctx.principal.userId });
    if (row.status === "eligible") await changeStatus(tx, row, "under_assessment", ctx.principal.userId, `Assigned to ${officer.name}`);
    await recordSummitChange(tx, ctx.principal.userId, {
      action: "summit.application.assigned",
      entityType: "summit_application",
      entityId: id,
      organizationId: row.organizationId,
      before: { officerUserId: current?.officerUserId ?? null },
      after: { officerUserId },
    });
    return buildDetail(tx, await reload(tx, id), access, ctx.now);
  });
}

/**
 * Accepts an applicant that doesn't meet a requirement, or whose answers don't settle one, and records why. The
 * application is screened again with the exception counted as satisfied, so an ineligible or waiting application can
 * become eligible. It is the administrator's decision, kept with their name, and the applicant sees the requirement as met.
 */
export async function recordException(
  ctx: Ctx,
  id: string,
  input: { criterion: string; reason: string },
): Promise<ApplicationDetailView> {
  const criterion = ELIGIBILITY_CRITERIA.find((c) => c.id === input.criterion)?.id as EligibilityCriterionId | undefined;
  if (!criterion) throw new ServiceError("invalid", `"${input.criterion}" isn't one of the six requirements.`);

  return ctx.db.transaction(async (tx) => {
    const { row, access } = await findApplication(tx, ctx.principal, id, { lock: true });
    requireStaffRole(access, ["admin", "facilitator"], "record an eligibility exception");
    const latest = await latestEligibility(tx, id);
    const open =
      (row.status === "ineligible" && latest?.outcome === "ineligible") ||
      (row.status === "awaiting_additional_information" && latest?.outcome === "pending_clarification");
    if (!latest || !open) {
      throw new ServiceError("invalid_transition", "An exception can be recorded only while the application's eligibility is being decided.");
    }
    const finding = latest.criteria.find((c) => c.id === criterion);
    if (!finding || finding.result === "met" || finding.result === "excepted") {
      throw new ServiceError("invalid", "That requirement is already met, so it needs no exception.");
    }

    const [added] = await tx
      .insert(schema.eligibilityException)
      .values({ applicationId: id, criterion, reason: input.reason, recordedBy: ctx.principal.userId })
      .onConflictDoNothing()
      .returning({ id: schema.eligibilityException.id });
    if (!added) throw new ServiceError("invalid_transition", "An exception is already recorded for that requirement.");

    const result = await screenApplication(tx, row, await loadPeriod(tx, row.periodId), ctx.principal.userId, `Exception recorded for ${criterion}`);
    await recordSummitChange(tx, ctx.principal.userId, {
      action: "summit.eligibility.exception",
      entityType: "summit_application",
      entityId: id,
      organizationId: row.organizationId,
      before: { outcome: latest.outcome },
      after: { criterion, outcome: result.outcome },
      reason: input.reason,
    });
    return buildDetail(tx, await reload(tx, id), access, ctx.now);
  });
}
