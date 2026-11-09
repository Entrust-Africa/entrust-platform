import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { getDb } from "@entrust/db";
import { ORGANIZATION_KINDS } from "@entrust/roles";
import type { AppEnv } from "../app";
import { Problem } from "../schemas/problem";
import { getUserOrganizations, loadPrincipal } from "../services/access";
import { mfaStatus } from "../services/staff-mfa";

const OrgSummary = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  role: z.string(),
  kind: z.enum(ORGANIZATION_KINDS),
  smeId: z.string().nullable(),
  platforms: z.array(z.string()),
});

const Me = z
  .object({
    id: z.string(),
    name: z.string(),
    email: z.email(),
    activeOrganizationId: z.string().nullable(),
    staffRole: z.enum(["admin", "facilitator", "reviewer"]).nullable(),
    /** A member of the Summit's selection committee. Not a staff role: it opens nothing outside the Summit. */
    summitCommittee: z.boolean(),
    /** A member of the Quality role: reads reports and the audit trail, changes nothing. Not a staff role. */
    quality: z.boolean(),
    /** Two-step sign-in, for Entrust staff only: null for everyone else. */
    mfa: z.object({ required: z.boolean(), enrolled: z.boolean(), verified: z.boolean() }).nullable(),
    organizations: z.array(OrgSummary).optional(),
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
  const [principal, userOrgs] = await Promise.all([
    loadPrincipal(db, user.id),
    getUserOrganizations(db, user.id),
  ]);
  return c.json(
    {
      id: user.id,
      name: user.name,
      email: user.email,
      activeOrganizationId: session.activeOrganizationId ?? null,
      staffRole: principal.staffRole ?? null,
      summitCommittee: principal.committee,
      quality: principal.quality,
      mfa: principal.staffRole || principal.committee ? await mfaStatus(db, user.id, session.id) : null,
      organizations: userOrgs,
    },
    200,
  );
});
