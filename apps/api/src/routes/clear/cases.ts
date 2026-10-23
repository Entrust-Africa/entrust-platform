import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { getDb } from "@entrust/db";
import type { AppEnv } from "../../app";
import { Problem } from "../../schemas/problem";
import {
  CaseCreated,
  CaseDetail,
  CaseIdParam,
  CaseList,
  ClockInputBody,
  CreateCaseBody,
  EvidenceParam,
  ListCasesQuery,
  ReviewEvidenceBody,
  StepParam,
  StepTransitionBody,
  SubmitEvidenceBody,
  UpdateFactsBody,
} from "../../schemas/clear";
import { loadPrincipal, type Ctx } from "../../services/access";
import { createCase, getCase, listCases, updateFacts } from "../../services/cases";
import { recordClockInput } from "../../services/clocks";
import { ServiceError } from "../../services/errors";
import { reviewEvidence, submitEvidence } from "../../services/evidence";
import { transitionCaseStep } from "../../services/steps";

const problem = (description: string) => ({ description, content: { "application/json": { schema: Problem } } });
const json = <T extends object>(schema: T) => ({ "application/json": { schema } });

const listErrors = { 400: problem("The request is malformed"), 401: problem("Not signed in") };
const readErrors = { ...listErrors, 404: problem("No such case, or it belongs to another organisation") };
const writeErrors = {
  ...readErrors,
  403: problem("The caller can see the case but their role can't make this change"),
  409: problem("The status can't go there from where it is"),
  422: problem("The values aren't allowed, or the change isn't possible yet"),
};

const tags = ["CLEAR cases"];

const cases = new OpenAPIHono<AppEnv>({
  defaultHook: (result, c) => {
    if (result.success) return;
    const error = result.error.issues.map((i) => `${i.path.join(".") || "request"}: ${i.message}`).join("; ");
    return c.json({ error, code: "invalid" as const }, 400);
  },
});

// Signed in before anything else, so a stranger learns nothing from validation errors.
cases.use("*", async (c, next) => {
  if (!c.get("user")) throw new ServiceError("unauthenticated", "Not signed in.");
  await next();
});

async function contextFor(user: { id: string } | null): Promise<Ctx> {
  if (!user) throw new ServiceError("unauthenticated", "Not signed in.");
  const db = getDb();
  return { db, principal: await loadPrincipal(db, user.id), now: new Date() };
}

const createCaseRoute = createRoute({
  method: "post",
  path: "/cases",
  tags,
  summary: "Open a case",
  description:
    "SME owners and members open cases for their own organisation, Entrust admins and facilitators for any. Needs at least the product and destination country.",
  request: { body: { required: true, content: json(CreateCaseBody) } },
  responses: { 201: { description: "The new case", content: json(CaseCreated) }, ...writeErrors },
});

const listCasesRoute = createRoute({
  method: "get",
  path: "/cases",
  tags,
  summary: "List cases",
  description:
    "The caller's organisations' cases, newest first, or every case for Entrust staff. Filter by status and phase.",
  request: { query: ListCasesQuery },
  responses: { 200: { description: "A page of cases", content: json(CaseList) }, ...listErrors },
});

const getCaseRoute = createRoute({
  method: "get",
  path: "/cases/{id}",
  tags,
  summary: "View a case",
  description:
    "The case with its workflow state worked out by the GATE engine (each step's status, what blocks it, the phase gates and the next action), its evidence and its deadline clocks.",
  request: { params: CaseIdParam },
  responses: { 200: { description: "The case", content: json(CaseDetail) }, ...readErrors },
});

const updateFactsRoute = createRoute({
  method: "patch",
  path: "/cases/{id}/facts",
  tags,
  summary: "Update a case's facts",
  description:
    "Sets or clears facts and re-works which steps apply. After a phase gate is signed off, a fact that is already recorded can't be changed here (an amendment).",
  request: { params: CaseIdParam, body: { required: true, content: json(UpdateFactsBody) } },
  responses: { 200: { description: "The updated case", content: json(CaseDetail) }, ...writeErrors },
});

const transitionStepRoute = createRoute({
  method: "post",
  path: "/cases/{id}/steps/{stepId}/transition",
  tags,
  summary: "Change a step's status",
  description:
    "Updates, completes, marks not applicable, reopens, signs off or unlocks a step, as the caller's role allows. Completing a step needs its prerequisites done and its evidence approved and in date. Completing the steps that start a deadline clock needs occurredAt.",
  request: { params: StepParam, body: { required: true, content: json(StepTransitionBody) } },
  responses: { 200: { description: "The updated case", content: json(CaseDetail) }, ...writeErrors },
});

const submitEvidenceRoute = createRoute({
  method: "post",
  path: "/cases/{id}/evidence",
  tags,
  summary: "Submit evidence",
  description:
    "Adds a submission of a document or record. The status is \"submitted\" until a reviewer approves it; a type can be submitted again after changes were requested, a rejection or expiry.",
  request: { params: CaseIdParam, body: { required: true, content: json(SubmitEvidenceBody) } },
  responses: { 201: { description: "The updated case", content: json(CaseDetail) }, ...writeErrors },
});

const reviewEvidenceRoute = createRoute({
  method: "post",
  path: "/cases/{id}/evidence/{evidenceId}/review",
  tags,
  summary: "Review evidence",
  description:
    "Starts a review, approves, requests changes or rejects the latest submission of a type. Changes and rejections need a note. Approval needs the issue date where the type has a validity period.",
  request: { params: EvidenceParam, body: { required: true, content: json(ReviewEvidenceBody) } },
  responses: { 200: { description: "The updated case", content: json(CaseDetail) }, ...writeErrors },
});

const clockInputRoute = createRoute({
  method: "post",
  path: "/cases/{id}/clock-inputs",
  tags,
  summary: "Record a date for the deadline clocks",
  description:
    "Planned loading time (ISF), estimated arrival and filing system (Prior Notice) and LC expiry. The latest value for a key wins, and the clocks move with it.",
  request: { params: CaseIdParam, body: { required: true, content: json(ClockInputBody) } },
  responses: { 200: { description: "The updated case", content: json(CaseDetail) }, ...writeErrors },
});

export const clearCases = cases
  .openapi(createCaseRoute, async (c) => {
    const body = c.req.valid("json");
    const created = await createCase(await contextFor(c.get("user")), {
      organizationId: body.organizationId ?? c.get("session")?.activeOrganizationId,
      facts: body.facts,
      cadAmountUsd: body.cadAmountUsd,
    });
    return c.json(created, 201);
  })
  .openapi(listCasesRoute, async (c) => {
    return c.json(await listCases(await contextFor(c.get("user")), c.req.valid("query")), 200);
  })
  .openapi(getCaseRoute, async (c) => {
    const { id } = c.req.valid("param");
    return c.json(await getCase(await contextFor(c.get("user")), id), 200);
  })
  .openapi(updateFactsRoute, async (c) => {
    const { id } = c.req.valid("param");
    const { facts } = c.req.valid("json");
    return c.json(await updateFacts(await contextFor(c.get("user")), id, facts), 200);
  })
  .openapi(transitionStepRoute, async (c) => {
    const { id, stepId } = c.req.valid("param");
    return c.json(await transitionCaseStep(await contextFor(c.get("user")), id, stepId, c.req.valid("json")), 200);
  })
  .openapi(submitEvidenceRoute, async (c) => {
    const { id } = c.req.valid("param");
    return c.json(await submitEvidence(await contextFor(c.get("user")), id, c.req.valid("json")), 201);
  })
  .openapi(reviewEvidenceRoute, async (c) => {
    const { id, evidenceId } = c.req.valid("param");
    return c.json(await reviewEvidence(await contextFor(c.get("user")), id, evidenceId, c.req.valid("json")), 200);
  })
  .openapi(clockInputRoute, async (c) => {
    const { id } = c.req.valid("param");
    return c.json(await recordClockInput(await contextFor(c.get("user")), id, c.req.valid("json")), 200);
  });
