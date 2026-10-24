import { OpenAPIHono } from "@hono/zod-openapi";
import { getDb } from "@entrust/db";
import type { AppEnv } from "../../app";
import { Problem } from "../../schemas/problem";
import { loadPrincipal, type Ctx } from "../../services/access";
import { ServiceError } from "../../services/errors";

// What the CLEAR route files share: the error responses every endpoint documents, the router that
// turns validation failures into the shared error body, and the caller's context.

export const problem = (description: string) => ({ description, content: { "application/json": { schema: Problem } } });
export const json = <T extends object>(schema: T) => ({ "application/json": { schema } });

export const listErrors = { 400: problem("The request is malformed"), 401: problem("Not signed in") };
export const readErrors = { ...listErrors, 404: problem("No such case, or it belongs to another organisation") };
export const writeErrors = {
  ...readErrors,
  403: problem("The caller can see the case but their role can't make this change"),
  409: problem("The status can't go there from where it is"),
  422: problem("The values aren't allowed, or the change isn't possible yet"),
};

/** A router whose endpoints all need a signed-in user. */
export function clearRouter() {
  const router = new OpenAPIHono<AppEnv>({
    defaultHook: (result, c) => {
      if (result.success) return;
      const error = result.error.issues.map((i) => `${i.path.join(".") || "request"}: ${i.message}`).join("; ");
      return c.json({ error, code: "invalid" as const }, 400);
    },
  });
  // Signed in before anything else, so a stranger learns nothing from validation errors.
  router.use("*", async (c, next) => {
    if (!c.get("user")) throw new ServiceError("unauthenticated", "Not signed in.");
    await next();
  });
  return router;
}

export async function contextFor(user: { id: string } | null): Promise<Ctx> {
  if (!user) throw new ServiceError("unauthenticated", "Not signed in.");
  const db = getDb();
  return { db, principal: await loadPrincipal(db, user.id), now: new Date() };
}
