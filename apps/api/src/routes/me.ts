import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { getDb } from "@entrust/db";
import type { AppEnv } from "../app";
import { Problem } from "../schemas/problem";
import { loadPrincipal } from "../services/access";

const Me = z
  .object({
    id: z.string(),
    name: z.string(),
    email: z.email(),
    activeOrganizationId: z.string().nullable(),
    staffRole: z.enum(["admin", "facilitator", "reviewer"]).nullable(),
    /** A member of the Summit's selection committee. Not a staff role: it opens nothing outside the Summit. */
    summitCommittee: z.boolean(),
  })
  .openapi("Me");

const route = createRoute({
  method: "get",
  path: "/me",
  tags: ["Account"],
  summary: "The signed-in user",
  responses: {
    200: { description: "Signed in", content: { "application/json": { schema: Me } } },
    401: { description: "Not signed in", content: { "application/json": { schema: Problem } } },
  },
});

export const me = new OpenAPIHono<AppEnv>().openapi(route, async (c) => {
  const user = c.get("user");
  const session = c.get("session");
  if (!user || !session) return c.json({ error: "Not signed in" }, 401);
  const db = getDb();
  const principal = await loadPrincipal(db, user.id);
  return c.json(
    {
      id: user.id,
      name: user.name,
      email: user.email,
      activeOrganizationId: session.activeOrganizationId ?? null,
      staffRole: principal.staffRole ?? null,
      summitCommittee: principal.committee,
    },
    200,
  );
});
