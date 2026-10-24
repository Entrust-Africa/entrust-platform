import { createRoute } from "@hono/zod-openapi";
import {
  CaseCreated,
  CaseDetail,
  CaseIdParam,
  CaseList,
  ClockInputBody,
  CreateCaseBody,
  EvidenceParam,
  FlagParam,
  ListCasesQuery,
  RecordContractBody,
  ReviewEvidenceBody,
  StepParam,
  StepTransitionBody,
  SubmitEvidenceBody,
  UpdateFactsBody,
  WaiveFlagBody,
} from "../../schemas/clear";
import { createCase, getCase, listCases, updateFacts } from "../../services/cases";
import { recordClockInput } from "../../services/clocks";
import { recordContract } from "../../services/contracts";
import { reviewEvidence, submitEvidence } from "../../services/evidence";
import { waiveFlag } from "../../services/flags";
import { transitionCaseStep } from "../../services/steps";
import { clearRouter, contextFor, json, listErrors, readErrors, writeErrors } from "./shared";

const tags = ["CLEAR cases"];

const cases = clearRouter();

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

const recordContractRoute = createRoute({
  method: "put",
  path: "/cases/{id}/contract",
  tags,
  summary: "Record the sales contract",
  description:
    "Records the buyer, the contract date and, for the minimum export price check, the unit price and what is sold (coffee type, grade, origin). The terms replace any recorded before, so send them all. For coffee, this runs the check: a price at or above the minimum export price in force on the contract date completes STEP-024, no price on file leaves it open, and a price below the floor raises FL-03.",
  request: { params: CaseIdParam, body: { required: true, content: json(RecordContractBody) } },
  responses: { 200: { description: "The updated case", content: json(CaseDetail) }, ...writeErrors },
});

const waiveFlagRoute = createRoute({
  method: "post",
  path: "/cases/{id}/flags/{flagId}/waive",
  tags,
  summary: "Waive a flag",
  description:
    "Accepts an open flag as it is, with a reason that stays on the flag and in the audit log. The steps it held are released. Only Entrust reviewers and admins can. Flags are raised and resolved by CLEAR itself as the failure rules fire and clear; a person cannot raise or resolve one.",
  request: { params: FlagParam, body: { required: true, content: json(WaiveFlagBody) } },
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
  })
  .openapi(recordContractRoute, async (c) => {
    const { id } = c.req.valid("param");
    return c.json(await recordContract(await contextFor(c.get("user")), id, c.req.valid("json")), 200);
  })
  .openapi(waiveFlagRoute, async (c) => {
    const { id, flagId } = c.req.valid("param");
    const { reason } = c.req.valid("json");
    return c.json(await waiveFlag(await contextFor(c.get("user")), id, flagId, reason), 200);
  });
