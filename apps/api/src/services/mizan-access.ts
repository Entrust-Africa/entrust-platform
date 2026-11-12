import { and, eq, inArray } from "drizzle-orm";
import { schema } from "@entrust/db";
import { mizanActionsFor, mizanCan, type MizanAction } from "@entrust/roles";
import { hasPlatformAccess, type Ctx, type Principal } from "./access";
import type { Executor } from "./db";
import { ServiceError } from "./errors";

// Who may do what in MIZAN (#223). The matrix is in @entrust/roles; this adds what needs the database: support relationships
// (control C-1), the SME's own access to its reports, and the per-assessment rule that an approver is a second person.

/** Throws unless the caller may do this in MIZAN. */
export function requireMizan(principal: Principal, action: MizanAction, doing: string): void {
  if (!mizanCan(principal, action)) throw new ServiceError("forbidden", `Your role can't ${doing} in MIZAN.`);
}

/**
 * Whether the person ever trained, advised, verified or onboarded the SME. Ended relationships count too: having supported an
 * SME in the past is exactly what control C-1 is about.
 */
export async function hasSupportRelationship(db: Executor, userId: string, organizationId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: schema.mizanSupportLink.id })
    .from(schema.mizanSupportLink)
    .where(and(eq(schema.mizanSupportLink.userId, userId), eq(schema.mizanSupportLink.organizationId, organizationId)))
    .limit(1);
  return row !== undefined;
}

/** Why the caller can't assess this SME, or an empty list when they can. */
export async function assessBlockers(db: Executor, principal: Principal, organizationId: string): Promise<string[]> {
  if (!mizanCan(principal, "assess")) return ["Only an Assessor or Super Admin can assess an SME."];
  if (await hasSupportRelationship(db, principal.userId, organizationId)) {
    return ["You are recorded as having supported this SME, so someone else must assess it (control C-1)."];
  }
  return [];
}

/**
 * Why the caller can't approve or return this assessment, or an empty list when they can. A second person: an Assessor or
 * Super Admin who is not the assessor and has never supported the SME. The approval itself also needs their declaration.
 */
export async function reviewBlockers(
  db: Executor,
  principal: Principal,
  assessment: { organizationId: string; assessorUserId: string },
): Promise<string[]> {
  const blockers: string[] = [];
  if (!mizanCan(principal, "review")) blockers.push("Only an Assessor or Super Admin can review an assessment.");
  if (principal.userId === assessment.assessorUserId) blockers.push("You assessed this SME, so someone else must review it.");
  if (await hasSupportRelationship(db, principal.userId, assessment.organizationId)) {
    blockers.push("You are recorded as having supported this SME, so someone else must review it (control C-1).");
  }
  return blockers;
}

/**
 * Whether the caller may read this SME's approved reports: staff who read reports, or a member of the SME itself while its
 * organisation has MIZAN access. Never a sponsor, never anyone else: the report goes to the SME (M-11).
 */
export async function canReadReports(db: Executor, principal: Principal, organizationId: string): Promise<boolean> {
  if (mizanCan(principal, "read_reports")) return true;
  return principal.smeRoles.has(organizationId) && (await hasPlatformAccess(db, organizationId, "mizan"));
}

/** What the caller can do in MIZAN, for the app to decide what to show. */
export async function mizanAccess(ctx: Ctx) {
  const { db, principal } = ctx;
  const memberOf = [...principal.smeRoles.keys()];
  const reportOrganizations = memberOf.length
    ? await db
        .select({ id: schema.organization.id, name: schema.organization.name })
        .from(schema.platformAccess)
        .innerJoin(schema.organization, eq(schema.organization.id, schema.platformAccess.organizationId))
        .where(and(eq(schema.platformAccess.platform, "mizan"), inArray(schema.platformAccess.organizationId, memberOf)))
        .orderBy(schema.organization.name)
    : [];
  const actions = mizanActionsFor(principal);
  return {
    staff: actions.length > 0,
    staffRole: principal.staffRole,
    quality: principal.quality,
    actions,
    // The SME organisations whose own reports the caller can open.
    reportOrganizations,
  };
}
