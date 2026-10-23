import { eq } from "drizzle-orm";
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
}

export interface Ctx {
  db: Database;
  principal: Principal;
  now: Date;
}

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
  const smeRoles = new Map<string, SmeRole>();
  for (const { organizationId, role } of memberships) {
    if (entrustOrganizationId && organizationId === entrustOrganizationId) {
      if (isEntrustRole(role)) staffRole = role;
    } else if (isSmeRole(role)) {
      smeRoles.set(organizationId, role);
    }
  }
  return { userId, staffRole, smeRoles };
}

/** The role the caller acts in on an organisation's cases, or null if they can't see them. */
export function actorFor(principal: Principal, organizationId: string): Actor | null {
  return principal.staffRole ?? principal.smeRoles.get(organizationId) ?? null;
}

/**
 * A case the caller may see, locked for update when `lock` is set. A case that doesn't exist and
 * one in another organisation look the same: not found.
 */
export async function findCase(
  db: Executor,
  principal: Principal,
  caseId: string,
  options: { lock?: boolean } = {},
) {
  const query = db.select().from(schema.exportCase).where(eq(schema.exportCase.id, caseId));
  const [row] = options.lock ? await query.for("update") : await query;
  const actor = row ? actorFor(principal, row.organizationId) : null;
  if (!row || !actor) throw new ServiceError("not_found", "Case not found.");
  return { row, actor };
}

/** Throws unless the caller's role is one of `allowed`. */
export function requireRole(actor: Actor, allowed: readonly Actor[], doing: string): void {
  if (!allowed.includes(actor)) {
    throw new ServiceError("forbidden", `Your role (${actor}) can't ${doing}.`);
  }
}
