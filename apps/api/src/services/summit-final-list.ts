import { and, count, eq, inArray, isNull, sql } from "drizzle-orm";
import { schema } from "@entrust/db";
import { enqueue, JOB_NAMES } from "@entrust/jobs";
import { APPLICANT_RESULTS, RESULT_STATUSES, type ResultStatus } from "@entrust/summit-engine";
import type { FinalListViewType } from "../schemas/summit";
import type { Ctx } from "./access";
import type { Executor } from "./db";
import { ServiceError } from "./errors";
import { recordSummitChange } from "./summit-status";

// The committee's final list for a period (#80). Approving it closes the committee's work: decisions can no longer
// change, each decided applicant's result is published to their status page, and they are emailed. It happens once,
// and isn't undone. An application still in committee review blocks it; one still being assessed doesn't, and stays
// "in review" for its applicant.

/** The workflow before the committee, for the applications that are still on their way to it. */
const BEFORE_COMMITTEE = [
  "submitted",
  "under_eligibility_review",
  "eligible",
  "under_assessment",
  "awaiting_additional_information",
  "under_verification",
  "assessment_completed",
  "recommended",
] as const;

/** Who may look at the final list: the committee, and the administrators who run the selection. */
function requireView(ctx: Ctx, doing: string): void {
  const { staffRole, committee } = ctx.principal;
  if (!committee && staffRole !== "admin" && staffRole !== "facilitator") {
    throw new ServiceError("forbidden", `Only the selection committee, administrators and facilitators can ${doing}.`);
  }
}

/** The approved final list of a period, if there is one. */
export async function approvedFinalList(db: Executor, periodId: string) {
  const [list] = await db.select().from(schema.finalList).where(eq(schema.finalList.periodId, periodId));
  return list;
}

async function loadPeriod(db: Executor, periodId: string, lock = false) {
  const query = db.select().from(schema.applicationPeriod).where(eq(schema.applicationPeriod.id, periodId));
  const [period] = lock ? await query.for("update") : await query;
  if (!period) throw new ServiceError("not_found", "No such application period.");
  return period;
}

/**
 * Takes the period's lock and refuses if its final list is approved. Whatever moves an application into or out of the
 * committee's hands calls this in its transaction, so a decision can't slip in while the list is being approved.
 */
export async function requireOpenSelection(db: Executor, periodId: string, doing: string): Promise<void> {
  await loadPeriod(db, periodId, true);
  if (await approvedFinalList(db, periodId)) {
    throw new ServiceError("invalid_transition", `The final list for this period is approved, so you can no longer ${doing}.`);
  }
}

/** How many applications of the period are in each status. */
async function statusCounts(db: Executor, periodId: string): Promise<Record<string, number>> {
  const rows = await db
    .select({ status: schema.application.status, total: count() })
    .from(schema.application)
    .where(eq(schema.application.periodId, periodId))
    .groupBy(schema.application.status);
  return Object.fromEntries(rows.map((r) => [r.status, r.total]));
}

export async function finalListView(db: Executor, periodId: string): Promise<FinalListViewType> {
  const period = await loadPeriod(db, periodId);
  const [approved, byStatus, [unsent]] = await Promise.all([
    db
      .select({ list: schema.finalList, userId: schema.user.id, userName: schema.user.name })
      .from(schema.finalList)
      .leftJoin(schema.user, eq(schema.user.id, schema.finalList.approvedBy))
      .where(eq(schema.finalList.periodId, periodId)),
    statusCounts(db, periodId),
    db
      .select({ total: count() })
      .from(schema.applicationResult)
      .innerJoin(schema.application, eq(schema.application.id, schema.applicationResult.applicationId))
      .where(and(eq(schema.application.periodId, periodId), isNull(schema.applicationResult.notifiedAt))),
  ]);

  const list = approved[0];
  const counts = list
    ? { selected: list.list.selected, waitlisted: list.list.waitlisted, notSelected: list.list.notSelected }
    : { selected: byStatus.selected ?? 0, waitlisted: byStatus.waitlisted ?? 0, notSelected: byStatus.not_selected ?? 0 };
  const inCommitteeReview = byStatus.committee_review ?? 0;
  const decided = counts.selected + counts.waitlisted + counts.notSelected;

  const blockers: string[] = [];
  if (list) blockers.push("The final list is already approved.");
  else {
    if (inCommitteeReview > 0) {
      blockers.push(`${inCommitteeReview} ${inCommitteeReview === 1 ? "application is" : "applications are"} still in committee review. Decide each one first.`);
    }
    if (decided === 0) blockers.push("No application has been decided yet.");
  }
  return {
    period: { id: period.id, name: period.name },
    approved: list !== undefined,
    approvedAt: list?.list.approvedAt.toISOString() ?? null,
    approvedBy: list?.userId && list.userName ? { id: list.userId, name: list.userName } : null,
    note: list?.list.note ?? null,
    counts,
    pending: { inCommitteeReview, beforeCommittee: BEFORE_COMMITTEE.reduce((sum, status) => sum + (byStatus[status] ?? 0), 0) },
    unnotified: unsent?.total ?? 0,
    canApprove: blockers.length === 0,
    blockers,
  };
}

export async function getFinalList(ctx: Ctx, periodId: string): Promise<FinalListViewType> {
  requireView(ctx, "see the final list");
  return finalListView(ctx.db, periodId);
}

/** Where the applicant sees the result, if the Summit app has an address. */
function applicationUrl(applicationId: string): string | undefined {
  const base = process.env.SUMMIT_APP_URL?.trim().replace(/\/+$/, "");
  if (!base) return undefined;
  try {
    return new URL(`/summit/applications/${applicationId}`, base).toString();
  } catch {
    return undefined;
  }
}

/** The person who applied and the owners of the organisation. */
async function recipientsFor(db: Executor, application: { organizationId: string; applicantUserId: string | null }): Promise<string[]> {
  const owners = await db
    .select({ email: schema.user.email })
    .from(schema.member)
    .innerJoin(schema.user, eq(schema.user.id, schema.member.userId))
    .where(and(eq(schema.member.organizationId, application.organizationId), eq(schema.member.role, "owner")));
  const applicant = application.applicantUserId
    ? await db.select({ email: schema.user.email }).from(schema.user).where(eq(schema.user.id, application.applicantUserId))
    : [];
  return [...new Set([...applicant, ...owners].map((r) => r.email))];
}

/**
 * Queues the result email for every applicant of the period who hasn't had one. Each is marked once it is queued, so a
 * queue that is down for some leaves the rest to send again, and nobody gets two. One that can't be queued is logged.
 */
async function sendResults(db: Executor, periodId: string): Promise<void> {
  const waiting = await db
    .select({ row: schema.application, decision: schema.applicationResult.decision, organizationName: schema.organization.name })
    .from(schema.applicationResult)
    .innerJoin(schema.application, eq(schema.application.id, schema.applicationResult.applicationId))
    .innerJoin(schema.organization, eq(schema.organization.id, schema.application.organizationId))
    .where(and(eq(schema.application.periodId, periodId), isNull(schema.applicationResult.notifiedAt)))
    .orderBy(schema.application.number);

  for (const { row, decision, organizationName } of waiting) {
    try {
      const to = await recipientsFor(db, row);
      if (to.length === 0) continue;
      const url = applicationUrl(row.id);
      await enqueue(JOB_NAMES.SEND_EMAIL, {
        to,
        subject: `The result of Summit application ${row.number}`,
        template: "summit-result",
        props: { applicationNumber: row.number, organizationName, message: APPLICANT_RESULTS[decision].message, ...(url ? { url } : {}) },
      });
      await db.update(schema.applicationResult).set({ notifiedAt: new Date() }).where(eq(schema.applicationResult.applicationId, row.id));
    } catch (error) {
      console.error(`[summit] The result email for ${row.number} could not be queued`, error);
    }
  }
}

/**
 * Approves the final list for a period. Every application the committee has decided is published to its applicant,
 * and the applicants are emailed after the approval is saved: if the queue is down the approval stands, and the
 * committee sends the rest again. Only a member of the selection committee approves.
 */
export async function approveFinalList(ctx: Ctx, periodId: string, note?: string): Promise<FinalListViewType> {
  if (!ctx.principal.committee) throw new ServiceError("forbidden", "Only a member of the selection committee can approve the final list.");

  await ctx.db.transaction(async (tx) => {
    // Locking the period keeps two approvals, or a decision made during one, from interleaving.
    const period = await loadPeriod(tx, periodId, true);
    const view = await finalListView(tx, periodId);
    if (view.approved) throw new ServiceError("invalid_transition", "The final list for this period is already approved.");
    if (!view.canApprove) throw new ServiceError("precondition_failed", view.blockers.join(" "));

    const decided = await tx
      .select({ id: schema.application.id, status: schema.application.status })
      .from(schema.application)
      .where(and(eq(schema.application.periodId, periodId), inArray(schema.application.status, [...RESULT_STATUSES])));
    await tx.insert(schema.finalList).values({
      periodId,
      selected: view.counts.selected,
      waitlisted: view.counts.waitlisted,
      notSelected: view.counts.notSelected,
      note: note?.trim() || null,
      approvedBy: ctx.principal.userId,
      approvedAt: sql`clock_timestamp()`,
    });
    await tx.insert(schema.applicationResult).values(decided.map((a) => ({ applicationId: a.id, decision: a.status as ResultStatus })));
    await recordSummitChange(tx, ctx.principal.userId, {
      action: "summit.finalList.approved",
      entityType: "summit_period",
      entityId: period.id,
      organizationId: null,
      after: { selected: view.counts.selected, waitlisted: view.counts.waitlisted, notSelected: view.counts.notSelected, inReview: view.pending.beforeCommittee },
      reason: note?.trim() || null,
    });
  });

  await sendResults(ctx.db, periodId);
  return finalListView(ctx.db, periodId);
}

/** Sends the result email again to the applicants it didn't reach, after the approval. */
export async function resendResults(ctx: Ctx, periodId: string): Promise<FinalListViewType> {
  requireView(ctx, "send the results again");
  const view = await finalListView(ctx.db, periodId);
  if (!view.approved) throw new ServiceError("invalid_transition", "The final list isn't approved yet, so there are no results to send.");
  await sendResults(ctx.db, periodId);
  await recordSummitChange(ctx.db, ctx.principal.userId, {
    action: "summit.finalList.resent",
    entityType: "summit_period",
    entityId: periodId,
    organizationId: null,
    after: { waiting: view.unnotified },
  });
  return finalListView(ctx.db, periodId);
}
