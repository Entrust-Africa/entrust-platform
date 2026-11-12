import { AsyncLocalStorage } from "node:async_hooks";
import { OpenAPIHono } from "@hono/zod-openapi";
import { getDb, type Database } from "@entrust/db";
import type { AppEnv } from "../../app";
import { Problem } from "../../schemas/problem";
import { hasClearAccess, hasPlatformAccess, hasTradeAccess, loadPrincipal, type Ctx, type PracticeScope, type Principal } from "../../services/access";
import { ServiceError } from "../../services/errors";

// What the CLEAR route files share: the error responses every endpoint documents, the router that
// turns validation failures into the shared error body, and the caller's context.

export const problem = (description: string) => ({ description, content: { "application/json": { schema: Problem } } });
export const json = <T extends object>(schema: T) => ({ "application/json": { schema } });

export const listErrors = {
  400: problem("The request is malformed"),
  401: problem("Not signed in"),
  404: problem("Organisation not found or platform not available"),
};
export const readErrors = { ...listErrors, 404: problem("No such case, or it belongs to another organisation") };
export const writeErrors = {
  ...readErrors,
  403: problem("The caller can see the case but their role can't make this change"),
  409: problem("The status can't go there from where it is"),
  422: problem("The values aren't allowed, or the change isn't possible yet"),
};

/** The principal the router's access check loaded for the request being handled. */
const requestPrincipal = new AsyncLocalStorage<Principal>();

/** The caller's memberships: the ones the access check already loaded for this request, or a fresh load. */
async function principalFor(db: Database, userId: string): Promise<Principal> {
  const loaded = requestPrincipal.getStore();
  return loaded?.userId === userId ? loaded : loadPrincipal(db, userId);
}

/** A router whose endpoints all need a signed-in user, and checks platform access (#50). */
export function clearRouter(platform?: "clear" | "trade" | "mizan") {
  const router = new OpenAPIHono<AppEnv>({
    defaultHook: (result, c) => {
      if (result.success) return;
      const error = result.error.issues.map((i) => `${i.path.join(".") || "request"}: ${i.message}`).join("; ");
      return c.json({ error, code: "invalid" as const }, 400);
    },
  });
  // Signed in before anything else, so a stranger learns nothing from validation errors.
  router.use("*", async (c, next) => {
    const user = c.get("user");
    if (!user) throw new ServiceError("unauthenticated", "Not signed in.");

    if (platform) {
      const db = getDb();
      const principal = await principalFor(db, user.id);
      // Quality reads MIZAN from the Entrust organisation, which holds no grant of its own; MIZAN's services limit it to reading.
      if (!principal.staffRole && !(platform === "mizan" && principal.quality)) {
        const session = c.get("session");
        const queryOrg = c.req.query("organizationId");
        const targetOrgId = queryOrg ?? session?.activeOrganizationId;
        if (targetOrgId) {
          const hasAccess =
            platform === "trade"
              ? await hasTradeAccess(db, targetOrgId)
              : platform === "clear"
                ? await hasClearAccess(db, targetOrgId)
                : await hasPlatformAccess(db, targetOrgId, platform);
          if (!hasAccess) {
            throw new ServiceError("not_found", `This organisation does not have access to ${platform.toUpperCase()}.`);
          }
        }
      }
      // The handler's contextFor uses this principal rather than loading the same memberships again.
      return requestPrincipal.run(principal, next);
    }

    await next();
  });
  return router;
}

/** The caller's context. Pass `practice` for a request about practice cases (TRADE's M08). */
export async function contextFor(user: { id: string } | null, practice?: PracticeScope): Promise<Ctx> {
  if (!user) throw new ServiceError("unauthenticated", "Not signed in.");
  const db = getDb();
  return { db, principal: await principalFor(db, user.id), now: new Date(), ...(practice ? { practice } : {}) };
}
