import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { getDb } from "@entrust/db";
import type { AppEnv } from "../app";
import { Problem } from "../schemas/problem";
import { loadPrincipal } from "../services/access";
import { ServiceError } from "../services/errors";
import { forgetMfaCaches } from "../services/mfa-gate";
import { beginEnrolment, confirmEnrolment, mfaStatus, resetMfa, verifySession } from "../services/staff-mfa";

const tags = ["Account"];
const json = <T extends z.ZodType>(schema: T) => ({ "application/json": { schema } });
const problem = (description: string) => ({ description, content: json(Problem) });

const Status = z.object({ required: z.boolean(), enrolled: z.boolean(), verified: z.boolean() }).openapi("MfaStatus");
const Code = z.object({ code: z.string().trim().min(1).max(32) });

const status = createRoute({
  method: "get",
  path: "/mfa",
  tags,
  summary: "Where the signed-in person stands on two-step sign-in",
  description: "For Entrust staff. `required` says the deployment asks for it; `verified` says this session has passed it.",
  responses: { 200: { description: "Status", content: json(Status) }, 401: problem("Not signed in"), 403: problem("Not Entrust staff") },
});
const enrol = createRoute({
  method: "post",
  path: "/mfa/enrol",
  tags,
  summary: "Start setting up an authenticator app",
  description: "Returns the secret and the otpauth link to put in an authenticator app. Nothing counts until a code from it is confirmed.",
  responses: {
    200: { description: "The secret", content: json(z.object({ secret: z.string(), otpauthUrl: z.string() })) },
    401: problem("Not signed in"),
    403: problem("Not Entrust staff"),
    409: problem("Already set up"),
  },
});
const confirm = createRoute({
  method: "post",
  path: "/mfa/confirm",
  tags,
  summary: "Confirm the authenticator app with its first code",
  description: "Verifies this session too, and returns eight one-time recovery codes. They are shown once.",
  request: { body: { content: json(Code), required: true } },
  responses: { 200: { description: "Recovery codes", content: json(z.object({ recoveryCodes: z.array(z.string()) })) }, 401: problem("Not signed in"), 403: problem("Not Entrust staff"), 422: problem("Wrong code") },
});
const verify = createRoute({
  method: "post",
  path: "/mfa/verify",
  tags,
  summary: "Pass the second step on this session",
  description: "Send an authenticator `code`, or a one-time `recoveryCode`. Five wrong codes lock the account for ten minutes.",
  request: { body: { content: json(z.object({ code: z.string().trim().max(16).optional(), recoveryCode: z.string().trim().max(32).optional() })), required: true } },
  responses: { 200: { description: "Verified", content: json(Status) }, 401: problem("Not signed in"), 403: problem("Not Entrust staff"), 422: problem("Wrong code") },
});
const reset = createRoute({
  method: "delete",
  path: "/mfa/{userId}",
  tags,
  summary: "Reset someone's two-step sign-in",
  description: "Administrators only. For a lost phone with no recovery codes. They set it up again at their next sign-in.",
  request: { params: z.object({ userId: z.string() }) },
  responses: { 200: { description: "Reset", content: json(z.object({ ok: z.literal(true) })) }, 401: problem("Not signed in"), 403: problem("Administrators only") },
});

/** Staff and the Summit committee are the people the second step is for. */
async function staffCaller(c: { get: (key: "user" | "session") => unknown }) {
  const user = c.get("user") as { id: string; email: string } | null;
  const session = c.get("session") as { id: string } | null;
  if (!user || !session) throw new ServiceError("unauthenticated", "Not signed in.");
  const principal = await loadPrincipal(getDb(), user.id);
  if (!principal.staffRole && !principal.committee) throw new ServiceError("forbidden", "Two-step sign-in is for Entrust staff.");
  return { user, session, principal };
}

export const mfa = new OpenAPIHono<AppEnv>()
  .openapi(status, async (c) => {
    const { user, session } = await staffCaller(c);
    return c.json(await mfaStatus(getDb(), user.id, session.id), 200);
  })
  .openapi(enrol, async (c) => {
    const { user } = await staffCaller(c);
    return c.json(await beginEnrolment(getDb(), user.id, user.email), 200);
  })
  .openapi(confirm, async (c) => {
    const { user, session } = await staffCaller(c);
    return c.json(await confirmEnrolment(getDb(), user.id, session.id, c.req.valid("json").code), 200);
  })
  .openapi(verify, async (c) => {
    const { user, session } = await staffCaller(c);
    const { code, recoveryCode } = c.req.valid("json");
    if (!code && !recoveryCode) throw new ServiceError("invalid", "Enter the code from your authenticator app.");
    await verifySession(getDb(), user.id, session.id, { code, recoveryCode });
    return c.json(await mfaStatus(getDb(), user.id, session.id), 200);
  })
  .openapi(reset, async (c) => {
    const { user, session, principal } = await staffCaller(c);
    if (principal.staffRole !== "admin") throw new ServiceError("forbidden", "Only an administrator can reset two-step sign-in.");
    // A reset removes the second step, so it can't be done from a session that hasn't passed it: otherwise a password alone
    // would be enough to reset an administrator's own step and enrol a new authenticator. (The gate checks this too.)
    const step = await mfaStatus(getDb(), user.id, session.id);
    if (step.required && !step.verified) {
      throw new ServiceError("forbidden", "Enter the code from your authenticator app before resetting two-step sign-in.");
    }
    const { userId } = c.req.valid("param");
    await resetMfa(getDb(), userId);
    forgetMfaCaches(userId);
    return c.json({ ok: true as const }, 200);
  });
