import { createRoute, z } from "@hono/zod-openapi";
import {
  AmendCaseBody,
  CaseCreated,
  CaseDetail,
  CaseIdParam,
  CaseList,
  ClockInputBody,
  DocumentFieldsBody,
  DocumentParam,
  EvidenceParam,
  FlagParam,
  RecordContractBody,
  ReviewEvidenceBody,
  StepParam,
  StepTransitionBody,
  SubmitEvidenceBody,
  UpdateFactsBody,
  WaiveFlagBody,
} from "../../schemas/clear";
import { PracticeListQuery, PracticeRoleQuery, PracticeScenarioList, StartPracticeBody } from "../../schemas/trade";
import { amendCase } from "../../services/amendments";
import { getCase, updateFacts } from "../../services/cases";
import { recordClockInput } from "../../services/clocks";
import { recordContract } from "../../services/contracts";
import { recordDocumentFields } from "../../services/documents";
import { reviewEvidence, submitEvidence } from "../../services/evidence";
import { waiveFlag } from "../../services/flags";
import { listPracticeCases, listPracticeScenarios, resetPracticeCase, startPracticeCase } from "../../services/practice";
import { transitionCaseStep } from "../../services/steps";
import { clearRouter, contextFor, json, listErrors, problem, readErrors, writeErrors } from "../clear/shared";

// TRADE's M08 practice cases (#74). The learner works a simulated export on a CLEAR case. These are CLEAR's own
// case endpoints under /v1/trade/practice-cases, running the same services, so the same rules apply. They reach
// practice cases only; CLEAR's endpoints reach real ones only.

const tags = ["TRADE practice"];
const practice = clearRouter();

const noAccess = problem("The caller's organisation doesn't have TRADE access");
const reads = { ...readErrors, 403: noAccess };
const writes = { ...writeErrors, 403: problem("The caller's organisation doesn't have TRADE access, or the role they practise in can't make this change") };
const lists = { ...listErrors, 403: noAccess };

const scenariosRoute = createRoute({
  method: "get",
  path: "/practice-scenarios",
  tags,
  summary: "List the practice scenarios",
  description: "The scenarios a learner can start in M08, and the label every screen shows on a practice case.",
  responses: { 200: { description: "The scenarios", content: json(PracticeScenarioList) }, ...listErrors },
});

const listRoute = createRoute({
  method: "get",
  path: "/practice-cases",
  tags,
  summary: "List practice cases",
  description: "The practice cases of the caller's organisations, newest first. Entrust staff name an organisation.",
  request: { query: PracticeListQuery },
  responses: { 200: { description: "The practice cases", content: json(CaseList) }, ...lists },
});

const startRoute = createRoute({
  method: "post",
  path: "/practice-cases",
  tags,
  summary: "Start a practice case",
  description:
    "Opens a scenario as a CLEAR case marked practice. It needs TRADE access and no CLEAR access. An organisation has one per scenario at a time: starting one that exists is refused, and reset starts it again. A case made from the learner's own deal takes its facts from the request.",
  request: { body: { required: true, content: json(StartPracticeBody) } },
  responses: { 201: { description: "The new case", content: json(CaseCreated) }, ...writes },
});

const getRoute = createRoute({
  method: "get",
  path: "/practice-cases/{id}",
  tags,
  summary: "View a practice case",
  description: "The case with its workflow, evidence, deadline clocks and requirements, as CLEAR shows a case, in the role the learner practises in.",
  request: { params: CaseIdParam, query: PracticeRoleQuery },
  responses: { 200: { description: "The case", content: json(CaseDetail) }, ...reads },
});

const resetRoute = createRoute({
  method: "post",
  path: "/practice-cases/{id}/reset",
  tags,
  summary: "Reset a practice case",
  description: "Puts the scenario back to its start. Everything recorded on the case is deleted and the scenario opens again with the facts it began with. The new case has a new id.",
  request: { params: CaseIdParam },
  responses: { 201: { description: "The scenario, started again", content: json(CaseCreated) }, ...writes },
});

const factsRoute = createRoute({
  method: "patch",
  path: "/practice-cases/{id}/facts",
  tags,
  summary: "Update a practice case's facts",
  description: "As for a CLEAR case.",
  request: { params: CaseIdParam, query: PracticeRoleQuery, body: { required: true, content: json(UpdateFactsBody) } },
  responses: { 200: { description: "The updated case", content: json(CaseDetail) }, ...writes },
});

const stepRoute = createRoute({
  method: "post",
  path: "/practice-cases/{id}/steps/{stepId}/transition",
  tags,
  summary: "Change a step's status",
  description: "As for a CLEAR case. Practise as the party the step belongs to.",
  request: { params: StepParam, query: PracticeRoleQuery, body: { required: true, content: json(StepTransitionBody) } },
  responses: { 200: { description: "The updated case", content: json(CaseDetail) }, ...writes },
});

const submitEvidenceRoute = createRoute({
  method: "post",
  path: "/practice-cases/{id}/evidence",
  tags,
  summary: "Submit evidence",
  description: "As for a CLEAR case. Nothing is uploaded: the learner records that the document exists.",
  request: { params: CaseIdParam, query: PracticeRoleQuery, body: { required: true, content: json(SubmitEvidenceBody) } },
  responses: { 201: { description: "The updated case", content: json(CaseDetail) }, ...writes },
});

const reviewEvidenceRoute = createRoute({
  method: "post",
  path: "/practice-cases/{id}/evidence/{evidenceId}/review",
  tags,
  summary: "Review evidence",
  description: "As for a CLEAR case. Practise as a reviewer to approve or reject.",
  request: { params: EvidenceParam, query: PracticeRoleQuery, body: { required: true, content: json(ReviewEvidenceBody) } },
  responses: { 200: { description: "The updated case", content: json(CaseDetail) }, ...writes },
});

const clockInputRoute = createRoute({
  method: "post",
  path: "/practice-cases/{id}/clock-inputs",
  tags,
  summary: "Record a date for the deadline clocks",
  description: "As for a CLEAR case. A shipment delay is a new planned loading time here, and the clocks move with it.",
  request: { params: CaseIdParam, query: PracticeRoleQuery, body: { required: true, content: json(ClockInputBody) } },
  responses: { 200: { description: "The updated case", content: json(CaseDetail) }, ...writes },
});

const contractRoute = createRoute({
  method: "put",
  path: "/practice-cases/{id}/contract",
  tags,
  summary: "Record the sales contract",
  description: "As for a CLEAR case, including the minimum export price check for coffee.",
  request: { params: CaseIdParam, query: PracticeRoleQuery, body: { required: true, content: json(RecordContractBody) } },
  responses: { 200: { description: "The updated case", content: json(CaseDetail) }, ...writes },
});

const documentFieldsRoute = createRoute({
  method: "put",
  path: "/practice-cases/{id}/documents/{document}/fields",
  tags,
  summary: "Enter what a document says",
  description: "As for a CLEAR case. A field that two documents carry differently raises FL-06.",
  request: { params: DocumentParam, query: PracticeRoleQuery, body: { required: true, content: json(DocumentFieldsBody) } },
  responses: { 200: { description: "The updated case", content: json(CaseDetail) }, ...writes },
});

const amendRoute = createRoute({
  method: "post",
  path: "/practice-cases/{id}/amendments",
  tags,
  summary: "Amend a case after a phase gate is signed",
  description: "As for a CLEAR case. It is Entrust's to make, so practise as an admin or facilitator.",
  request: { params: CaseIdParam, query: PracticeRoleQuery, body: { required: true, content: json(AmendCaseBody) } },
  responses: { 201: { description: "The amended case", content: json(CaseDetail) }, ...writes },
});

const waiveRoute = createRoute({
  method: "post",
  path: "/practice-cases/{id}/flags/{flagId}/waive",
  tags,
  summary: "Waive a flag",
  description: "As for a CLEAR case. Only a reviewer or admin can, so practise as one.",
  request: { params: FlagParam, query: PracticeRoleQuery, body: { required: true, content: json(WaiveFlagBody) } },
  responses: { 200: { description: "The updated case", content: json(CaseDetail) }, ...writes },
});

/** The caller's context for a request about a practice case, practising as the role in `as`. */
const practiceContext = (c: { get(key: "user"): { id: string } | null }, as?: z.infer<typeof PracticeRoleQuery>["as"]) =>
  contextFor(c.get("user"), { actingAs: as });

export const tradePractice = practice
  .openapi(scenariosRoute, async (c) => c.json(listPracticeScenarios(), 200))
  .openapi(listRoute, async (c) => {
    const { organizationId } = c.req.valid("query");
    return c.json(await listPracticeCases(await practiceContext(c), organizationId), 200);
  })
  .openapi(startRoute, async (c) => {
    const body = c.req.valid("json");
    const created = await startPracticeCase(await practiceContext(c), {
      organizationId: body.organizationId ?? c.get("session")?.activeOrganizationId,
      scenario: body.scenario,
      facts: body.facts,
    });
    return c.json(created, 201);
  })
  .openapi(getRoute, async (c) => {
    const { id } = c.req.valid("param");
    return c.json(await getCase(await practiceContext(c, c.req.valid("query").as), id), 200);
  })
  .openapi(resetRoute, async (c) => {
    const { id } = c.req.valid("param");
    return c.json(await resetPracticeCase(await practiceContext(c), id), 201);
  })
  .openapi(factsRoute, async (c) => {
    const { id } = c.req.valid("param");
    const { facts } = c.req.valid("json");
    return c.json(await updateFacts(await practiceContext(c, c.req.valid("query").as), id, facts), 200);
  })
  .openapi(stepRoute, async (c) => {
    const { id, stepId } = c.req.valid("param");
    return c.json(await transitionCaseStep(await practiceContext(c, c.req.valid("query").as), id, stepId, c.req.valid("json")), 200);
  })
  .openapi(submitEvidenceRoute, async (c) => {
    const { id } = c.req.valid("param");
    return c.json(await submitEvidence(await practiceContext(c, c.req.valid("query").as), id, c.req.valid("json")), 201);
  })
  .openapi(reviewEvidenceRoute, async (c) => {
    const { id, evidenceId } = c.req.valid("param");
    return c.json(await reviewEvidence(await practiceContext(c, c.req.valid("query").as), id, evidenceId, c.req.valid("json")), 200);
  })
  .openapi(clockInputRoute, async (c) => {
    const { id } = c.req.valid("param");
    return c.json(await recordClockInput(await practiceContext(c, c.req.valid("query").as), id, c.req.valid("json")), 200);
  })
  .openapi(contractRoute, async (c) => {
    const { id } = c.req.valid("param");
    return c.json(await recordContract(await practiceContext(c, c.req.valid("query").as), id, c.req.valid("json")), 200);
  })
  .openapi(documentFieldsRoute, async (c) => {
    const { id, document } = c.req.valid("param");
    const { fields } = c.req.valid("json");
    return c.json(await recordDocumentFields(await practiceContext(c, c.req.valid("query").as), id, document, fields), 200);
  })
  .openapi(amendRoute, async (c) => {
    const { id } = c.req.valid("param");
    return c.json(await amendCase(await practiceContext(c, c.req.valid("query").as), id, c.req.valid("json")), 201);
  })
  .openapi(waiveRoute, async (c) => {
    const { id, flagId } = c.req.valid("param");
    const { reason } = c.req.valid("json");
    return c.json(await waiveFlag(await practiceContext(c, c.req.valid("query").as), id, flagId, reason), 200);
  });
