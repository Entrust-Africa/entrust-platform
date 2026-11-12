import { createRoute, z } from "@hono/zod-openapi";
import { MIZAN_ACTIONS } from "@entrust/roles";
import { mizanAccess } from "../../services/mizan-access";
import { clearRouter, contextFor, json, problem } from "../clear/shared";

// What the caller can do in MIZAN (#223). Open to anyone signed in, so the app can show a clear "no access" page instead of an
// error: the answer for someone with no MIZAN access is simply nothing.

const tags = ["MIZAN"];
const router = clearRouter();

const MizanAccess = z
  .object({
    staff: z.boolean().openapi({ description: "Entrust staff with any MIZAN permission, including the read-only Quality role" }),
    staffRole: z.enum(["admin", "facilitator", "reviewer"]).nullable(),
    quality: z.boolean(),
    actions: z.array(z.enum(MIZAN_ACTIONS)),
    reportOrganizations: z
      .array(z.object({ id: z.string(), name: z.string() }))
      .openapi({ description: "The caller's own SME organisations with MIZAN access, whose approved reports they can open" }),
  })
  .openapi("MizanAccess");

const accessRoute = createRoute({
  method: "get",
  path: "/access",
  tags,
  summary: "What the caller can do in MIZAN",
  description:
    "Entrust staff get the actions their role allows (Super Admin everything; Assessor everything but support relationships and the audit trail; Quality reading only; Cohort Manager nothing). An SME member gets the SME organisations whose approved reports they can open. Everyone else gets nothing.",
  responses: { 200: { description: "The caller's MIZAN access", content: json(MizanAccess) }, 401: problem("Not signed in") },
});

export const mizanAccessRoutes = router.openapi(accessRoute, async (c) => c.json(await mizanAccess(await contextFor(c.get("user"))), 200));
