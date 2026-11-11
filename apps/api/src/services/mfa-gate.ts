import { and, eq } from "drizzle-orm";
import type { MiddlewareHandler } from "hono";
import { getDb, schema } from "@entrust/db";
import type { AppEnv } from "../app";
import { mfaRequired } from "./staff-mfa";

// The second step guards everything a staff session reaches, not only /v1/trade and /v1/summit: files, the audit trail, the
// SME registry and organisations hold TRADE's data too. The exceptions are what a session needs to take the second step
// (/v1/mfa, and /v1/me to learn that it has to) and CLEAR's own routes, which have their own sign-in rules and must not lock
// staff out. Sign-in itself (/api/auth) isn't under /v1.
const EXEMPT = ["/v1/mfa", "/v1/me", "/v1/clear", "/v1/health"];
const isExempt = (path: string): boolean => EXEMPT.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));

const STAFF_TTL_MS = 60_000;
const staffCache = new Map<string, { staff: boolean; at: number }>();
const VERIFIED_TTL_MS = 5 * 60_000;
const verifiedSessions = new Map<string, { userId: string; at: number }>();

/** Whether the person is in the Entrust organisation in any role. Remembered for a minute, so a signed-in learner doesn't cost a query on every request. */
async function isEntrustMember(userId: string): Promise<boolean> {
  const hit = staffCache.get(userId);
  if (hit && Date.now() - hit.at < STAFF_TTL_MS) return hit.staff;
  const organizationId = process.env.ENTRUST_ORG_ID;
  let staff = false;
  if (organizationId) {
    const [row] = await getDb()
      .select({ id: schema.member.id })
      .from(schema.member)
      .where(and(eq(schema.member.userId, userId), eq(schema.member.organizationId, organizationId)))
      .limit(1);
    staff = Boolean(row);
  }
  staffCache.set(userId, { staff, at: Date.now() });
  return staff;
}

/** Clears what's remembered, for tests and after a reset. */
export function forgetMfaCaches(userId?: string): void {
  if (!userId) {
    staffCache.clear();
    verifiedSessions.clear();
    return;
  }
  for (const [sessionId, hit] of verifiedSessions) if (hit.userId === userId) verifiedSessions.delete(sessionId);
}

export const mfaGate: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (!mfaRequired()) return next();
  const user = c.get("user");
  const session = c.get("session");
  if (!user || !session || isExempt(c.req.path)) return next();
  if (!(await isEntrustMember(user.id))) return next();
  const remembered = verifiedSessions.get(session.id);
  if (!remembered || Date.now() - remembered.at > VERIFIED_TTL_MS) {
    const [row] = await getDb()
      .select({ sessionId: schema.staffMfaSession.sessionId })
      .from(schema.staffMfaSession)
      .where(eq(schema.staffMfaSession.sessionId, session.id));
    if (!row) return c.json({ error: "Enter the code from your authenticator app to continue.", code: "mfa_required" }, 403);
    verifiedSessions.set(session.id, { userId: user.id, at: Date.now() });
  }
  return next();
};
