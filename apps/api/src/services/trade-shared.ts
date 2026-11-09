import { and, eq } from "drizzle-orm";
import { schema } from "@entrust/db";
import { hasTradeAccess, type Principal } from "./access";
import type { Executor } from "./db";

// What the TRADE assessment services share: who may read or write an SME's forms, and the audit entry for a change.

export interface Access {
  staff: boolean;
  /** Staff reviewers read; administrators and facilitators can fill a form in for an SME. */
  write: boolean;
}

/** A facilitator or reviewer reaches only the cohorts they're assigned to. An administrator reaches every cohort. */
export const limitedToAssignedCohorts = (principal: Principal): boolean => principal.staffRole !== null && principal.staffRole !== "admin";

export async function assignedCohortIds(db: Executor, userId: string): Promise<string[]> {
  const rows = await db.select({ cohortId: schema.cohortStaff.cohortId }).from(schema.cohortStaff).where(eq(schema.cohortStaff.userId, userId));
  return rows.map((r) => r.cohortId);
}

export async function assignedOrganizationIds(db: Executor, userId: string): Promise<string[]> {
  const rows = await db
    .select({ organizationId: schema.enrollment.organizationId })
    .from(schema.cohortStaff)
    .innerJoin(schema.enrollment, eq(schema.enrollment.cohortId, schema.cohortStaff.cohortId))
    .where(eq(schema.cohortStaff.userId, userId));
  return [...new Set(rows.map((r) => r.organizationId))];
}

export async function canReachCohort(db: Executor, principal: Principal, cohortId: string): Promise<boolean> {
  if (!limitedToAssignedCohorts(principal)) return principal.staffRole !== null;
  const [row] = await db
    .select({ cohortId: schema.cohortStaff.cohortId })
    .from(schema.cohortStaff)
    .where(and(eq(schema.cohortStaff.cohortId, cohortId), eq(schema.cohortStaff.userId, principal.userId)))
    .limit(1);
  return !!row;
}

async function canReachOrganization(db: Executor, principal: Principal, organizationId: string): Promise<boolean> {
  if (!limitedToAssignedCohorts(principal)) return true;
  const [row] = await db
    .select({ cohortId: schema.cohortStaff.cohortId })
    .from(schema.cohortStaff)
    .innerJoin(schema.enrollment, eq(schema.enrollment.cohortId, schema.cohortStaff.cohortId))
    .where(and(eq(schema.cohortStaff.userId, principal.userId), eq(schema.enrollment.organizationId, organizationId)))
    .limit(1);
  return !!row;
}

/** What the caller may do with an SME organisation's assessments, or null if they may not see them at all. */
export async function accessTo(db: Executor, principal: Principal, organizationId: string): Promise<Access | null> {
  if (principal.staffRole) {
    if (!(await canReachOrganization(db, principal, organizationId))) return null;
    return { staff: true, write: principal.staffRole !== "reviewer" };
  }
  if (principal.smeRoles.has(organizationId) && (await hasTradeAccess(db, organizationId))) return { staff: false, write: true };
  return null;
}

/**
 * An answer is stored as { v: answer }. A bare scalar in a jsonb column comes back wrong through Drizzle (the text
 * "0" or "2020" is read as a number), so nothing is stored bare.
 */
export const wrapAnswer = (answer: unknown): { v: unknown } | null => (answer === null || answer === undefined ? null : { v: answer });
export const unwrapAnswer = (stored: unknown): unknown =>
  stored && typeof stored === "object" && !Array.isArray(stored) && "v" in stored ? (stored as { v: unknown }).v : null;

interface TradeChange {
  action: string;
  organizationId: string | null;
  entityId: string;
  entityType?: string;
  before?: unknown;
  after?: unknown;
  reason?: string | null;
}

/** Records a change in the shared audit log. Run it in the transaction that makes the change. */
export async function recordTradeChange(db: Executor, userId: string | null, change: TradeChange): Promise<void> {
  await db.insert(schema.auditLog).values({
    actorUserId: userId,
    organizationId: change.organizationId,
    platform: "trade",
    action: change.action,
    entityType: change.entityType ?? (change.action.startsWith("trade.pathway") ? "enrollment" : "assessment"),
    entityId: change.entityId,
    before: change.before ?? null,
    after: change.after ?? null,
    reason: change.reason ?? null,
  });
}
