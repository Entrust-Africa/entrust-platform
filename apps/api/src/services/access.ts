import { and, eq } from "drizzle-orm";
import { schema, type Database } from "@entrust/db";
import { ENTRUST_ROLES, SME_ROLES, type Actor, type EntrustRole, type SmeRole } from "@entrust/gate-engine";
import type { Executor } from "./db";
import { ServiceError } from "./errors";

/** Who is calling, from their memberships. */
export interface Principal {
  userId: string;
  /** Set for members of the Entrust organisation, who see every case. */
  staffRole: EntrustRole | null;
  /** Roles in SME organisations, by organisation id. */
  smeRoles: ReadonlyMap<string, SmeRole>;
  /**
   * A member of the Summit's selection committee (#80): the Entrust organisation's `committee` role. It is not a staff
   * role, so it grants nothing in CLEAR or TRADE and only the Summit's committee endpoints know it.
   */
  committee: boolean;
}

/**
 * A request about practice cases, which TRADE's M08 runs on CLEAR's own services. Without it a request
 * sees real cases only; with it, practice cases only. Nothing crosses over in either direction.
 */
export interface PracticeScope {
  /** The role the learner practises in. A learner works every party's steps, so they pick whose turn it is. Default: their own. */
  actingAs?: Actor | undefined;
}

export interface Ctx {
  db: Database;
  principal: Principal;
  now: Date;
  practice?: PracticeScope;
}

/** The role of the Summit's selection committee in the Entrust organisation. Summit only, so it isn't in ENTRUST_ROLES. */
export const COMMITTEE_ROLE = "committee";

const isEntrustRole = (role: string): role is EntrustRole => (ENTRUST_ROLES as readonly string[]).includes(role);
const isSmeRole = (role: string): role is SmeRole => (SME_ROLES as readonly string[]).includes(role);

/**
 * Entrust staff are the members of the organisation in ENTRUST_ORG_ID (#18) whose role is one of
 * the Entrust roles. The id, not the slug, so nobody becomes staff by registering an organisation
 * with a familiar name; unset, nobody is staff. A role the permission checks don't know gives no
 * access, so a stray "admin" in an SME organisation grants nothing.
 */
export async function loadPrincipal(db: Executor, userId: string): Promise<Principal> {
  const entrustOrganizationId = process.env.ENTRUST_ORG_ID;
  const memberships = await db
    .select({ organizationId: schema.member.organizationId, role: schema.member.role })
    .from(schema.member)
    .where(eq(schema.member.userId, userId));

  let staffRole: EntrustRole | null = null;
  let committee = false;
  const smeRoles = new Map<string, SmeRole>();
  for (const { organizationId, role } of memberships) {
    if (entrustOrganizationId && organizationId === entrustOrganizationId) {
      if (isEntrustRole(role)) staffRole = role;
      else if (role === COMMITTEE_ROLE) committee = true;
    } else if (isSmeRole(role)) {
      smeRoles.set(organizationId, role);
    }
  }
  return { userId, staffRole, smeRoles, committee };
}

/** The role the caller acts in on an organisation's cases, or null if they can't see them. */
export function actorFor(principal: Principal, organizationId: string): Actor | null {
  return principal.staffRole ?? principal.smeRoles.get(organizationId) ?? null;
}

/** Whether the organisation has been given TRADE access, which practice cases need. */
export async function hasTradeAccess(db: Executor, organizationId: string): Promise<boolean> {
  const [grant] = await db
    .select({ id: schema.platformAccess.id })
    .from(schema.platformAccess)
    .where(and(eq(schema.platformAccess.organizationId, organizationId), eq(schema.platformAccess.platform, "trade")))
    .limit(1);
  return grant !== undefined;
}

/**
 * A case the caller may see, locked for update when `lock` is set. A case that doesn't exist, one in
 * another organisation, and a practice case asked for outside the practice scope (or a real case inside
 * it) look the same: not found. In the practice scope an SME member needs their organisation to have
 * TRADE access and acts in the role they chose; Entrust staff keep their own role and need no access.
 */
export async function findCase(
  db: Executor,
  principal: Principal,
  caseId: string,
  options: { lock?: boolean; practice?: PracticeScope | undefined } = {},
) {
  const query = db.select().from(schema.exportCase).where(eq(schema.exportCase.id, caseId));
  const [row] = options.lock ? await query.for("update") : await query;
  const own = row ? actorFor(principal, row.organizationId) : null;
  const inScope = row && (row.practiceScenario !== null) === (options.practice !== undefined);
  const actor = options.practice && own && !principal.staffRole ? (options.practice.actingAs ?? own) : own;
  if (!row || !inScope || !actor) throw new ServiceError("not_found", "Case not found.");
  if (options.practice && !principal.staffRole && !(await hasTradeAccess(db, row.organizationId))) {
    throw new ServiceError("forbidden", "Your organisation doesn't have access to TRADE.");
  }
  return { row, actor };
}

/** Throws unless the caller's role is one of `allowed`. */
export function requireRole(actor: Actor, allowed: readonly Actor[], doing: string): void {
  if (!allowed.includes(actor)) {
    throw new ServiceError("forbidden", `Your role (${actor}) can't ${doing}.`);
  }
}

/** Throws unless the caller is Entrust staff in one of the given roles. */
export function requireStaff(principal: Principal, allowed: readonly EntrustRole[], doing: string): void {
  if (!principal.staffRole || !allowed.includes(principal.staffRole)) {
    throw new ServiceError("forbidden", `Only Entrust ${allowed.join(" or ")} can ${doing}.`);
  }
}
