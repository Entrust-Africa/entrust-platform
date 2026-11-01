import { and, eq, isNull } from "drizzle-orm";
import { schema } from "@entrust/db";
import type { EntrustRole } from "@entrust/gate-engine";
import type { Principal } from "./access";
import type { Executor } from "./db";
import { ServiceError } from "./errors";

/** How the caller relates to one application. */
export interface SummitAccess {
  /** A member of the applicant's organisation. They see their own application and nothing staff-only. */
  applicant: boolean;
  /** Set for Entrust staff who may open the application. */
  staffRole: EntrustRole | null;
  /** The caller is the officer the application is assigned to now. */
  assigned: boolean;
}

export type ApplicationRow = typeof schema.application.$inferSelect;

/**
 * An application the caller may open, locked for update when `lock` is set. Applicants open their organisation's.
 * Entrust's administrators open all of them. An assessment officer opens only the ones assigned to them now. For
 * anyone else, an application that exists looks the same as one that doesn't.
 */
export async function findApplication(
  db: Executor,
  principal: Principal,
  id: string,
  options: { lock?: boolean } = {},
): Promise<{ row: ApplicationRow; access: SummitAccess }> {
  const query = db.select().from(schema.application).where(eq(schema.application.id, id));
  const [row] = options.lock ? await query.for("update") : await query;
  const access = row ? await accessTo(db, principal, row) : null;
  if (!row || !access) throw new ServiceError("not_found", "Application not found.");
  return { row, access };
}

async function accessTo(db: Executor, principal: Principal, row: ApplicationRow): Promise<SummitAccess | null> {
  if (principal.smeRoles.has(row.organizationId)) return { applicant: true, staffRole: null, assigned: false };
  const { staffRole } = principal;
  if (!staffRole) return null;
  if (staffRole === "admin" || staffRole === "facilitator") return { applicant: false, staffRole, assigned: false };
  const [assignment] = await db
    .select({ id: schema.officerAssignment.id })
    .from(schema.officerAssignment)
    .where(
      and(
        eq(schema.officerAssignment.applicationId, row.id),
        eq(schema.officerAssignment.officerUserId, principal.userId),
        isNull(schema.officerAssignment.endedAt),
      ),
    )
    .limit(1);
  return assignment ? { applicant: false, staffRole, assigned: true } : null;
}

export function requireApplicant(access: SummitAccess, doing: string): void {
  if (!access.applicant) throw new ServiceError("forbidden", `Only the applicant can ${doing}.`);
}

/** Throws unless the caller is Entrust staff in one of the given roles. */
export function requireStaffRole(access: SummitAccess, allowed: readonly EntrustRole[], doing: string): void {
  if (!access.staffRole || !allowed.includes(access.staffRole)) {
    throw new ServiceError("forbidden", `Only Entrust ${allowed.join(" or ")} can ${doing}.`);
  }
}
