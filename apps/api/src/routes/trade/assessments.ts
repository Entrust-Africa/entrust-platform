import { createRoute } from "@hono/zod-openapi";
import {
  AssessmentForm,
  AssessmentFormQuery,
  AssessmentList,
  AssessmentListQuery,
  AssessmentParam,
  AssessmentQuestionParam,
  AssessmentView,
  EnrollmentParam,
  EnrollmentPathway,
  SaveResponsesBody,
  SetPathwayBody,
  StartAssessmentBody,
} from "../../schemas/trade";
import {
  approveNotApplicable,
  getAssessment,
  getEnrollmentPathway,
  getTemplate,
  listAssessments,
  saveResponses,
  setEnrollmentPathway,
  startAssessment,
  submitAssessment,
} from "../../services/trade-assessments";
import { clearRouter, contextFor, json, listErrors, problem, writeErrors } from "../clear/shared";

// The onboarding diagnostic (#78) and the placement assessment (#57): one set of routes for both, chosen by `kind`.

const tags = ["TRADE assessments"];
const assessments = clearRouter("trade");

const templateRoute = createRoute({
  method: "get",
  path: "/assessments/template",
  tags,
  summary: "View a form",
  description:
    "The questions of the diagnostic or the placement assessment, in the shape every form screen reads: sections, questions, options and the conditions that show or hide a question. The newest version unless `version` names one.",
  request: { query: AssessmentFormQuery },
  responses: { 200: { description: "The form", content: json(AssessmentForm) }, ...listErrors },
});

const listRoute = createRoute({
  method: "get",
  path: "/assessments",
  tags,
  summary: "List assessments",
  description: "The caller's organisations' diagnostics and placement assessments, newest first. Entrust staff see every organisation's. Superseded assessments are included.",
  request: { query: AssessmentListQuery },
  responses: { 200: { description: "The assessments", content: json(AssessmentList) }, ...listErrors },
});

const startRoute = createRoute({
  method: "post",
  path: "/assessments",
  tags,
  summary: "Start an assessment",
  description:
    "Starts the assessment of a kind for an enrolment, or returns the draft to resume, or the submitted one. `retake: true` starts again after a submitted one and supersedes it; the old answers are kept. When Entrust staff start it, they are recorded as the assessor.",
  request: { body: { content: json(StartAssessmentBody), required: true } },
  responses: {
    201: { description: "The assessment", content: json(AssessmentView) },
    ...writeErrors,
  },
});

const getRoute = createRoute({
  method: "get",
  path: "/assessments/{id}",
  tags,
  summary: "View an assessment",
  description: "The answers so far, progress over the visible questions, what is invalid or missing, and, for a submitted diagnostic, the avenue the SME is on.",
  request: { params: AssessmentParam },
  responses: { 200: { description: "The assessment", content: json(AssessmentView) }, ...listErrors },
});

const saveRoute = createRoute({
  method: "put",
  path: "/assessments/{id}/responses",
  tags,
  summary: "Save answers",
  description:
    "A partial save: a value sets an answer, null clears it, and answers not named stay. An answer that isn't valid for its question is refused; a question left unanswered is not. Only a draft can be changed.",
  request: { params: AssessmentParam, body: { content: json(SaveResponsesBody), required: true } },
  responses: { 200: { description: "The assessment", content: json(AssessmentView) }, ...writeErrors },
});

const submitRoute = createRoute({
  method: "post",
  path: "/assessments/{id}/submit",
  tags,
  summary: "Submit an assessment",
  description:
    "Locks the answers. Every visible question needs an answer and none can be invalid. A conflict between answers doesn't stop the submit but sends the placement assessment to staff review. Submitting the diagnostic assigns Pathway A or B with the rules and records the declaration's consents.",
  request: { params: AssessmentParam },
  responses: { 200: { description: "The submitted assessment", content: json(AssessmentView) }, ...writeErrors },
});

const approveRoute = createRoute({
  method: "post",
  path: "/assessments/{id}/responses/{questionId}/approve",
  tags,
  summary: "Approve a \"does not apply\" answer",
  description: "Entrust staff accept the reason an SME gave for a question not applying to them. Once nothing waits and nothing conflicts, the review ends.",
  request: { params: AssessmentQuestionParam },
  responses: { 200: { description: "The assessment", content: json(AssessmentView) }, ...writeErrors },
});

const getPathwayRoute = createRoute({
  method: "get",
  path: "/enrollments/{id}/pathway",
  tags,
  summary: "The avenue an enrolment is on",
  description: "Pathway A or B from the diagnostic, with the reasons in plain words and whether it is provisional. Null before the diagnostic is submitted.",
  request: { params: EnrollmentParam },
  responses: { 200: { description: "The avenue", content: json(EnrollmentPathway) }, ...listErrors },
});

const setPathwayRoute = createRoute({
  method: "post",
  path: "/enrollments/{id}/pathway",
  tags,
  summary: "Confirm or change the avenue",
  description:
    "An Entrust administrator or facilitator confirms the avenue the rules gave (for example after accepting a shipment record) or changes it, with a reason. It adds a row and supersedes the old one; a change is recorded as an override.",
  request: { params: EnrollmentParam, body: { content: json(SetPathwayBody), required: true } },
  responses: {
    200: { description: "The avenue", content: json(EnrollmentPathway) },
    ...writeErrors,
    403: problem("Only an Entrust administrator or facilitator can do this"),
  },
});

export const tradeAssessments = assessments
  .openapi(templateRoute, async (c) => {
    await contextFor(c.get("user"));
    const { kind, version } = c.req.valid("query");
    return c.json(getTemplate(kind, version) as never, 200);
  })
  .openapi(listRoute, async (c) => c.json({ items: await listAssessments(await contextFor(c.get("user")), c.req.valid("query")) }, 200))
  .openapi(startRoute, async (c) => c.json(await startAssessment(await contextFor(c.get("user")), c.req.valid("json")), 201))
  .openapi(getRoute, async (c) => c.json(await getAssessment(await contextFor(c.get("user")), c.req.valid("param").id), 200))
  .openapi(saveRoute, async (c) => c.json(await saveResponses(await contextFor(c.get("user")), c.req.valid("param").id, c.req.valid("json")), 200))
  .openapi(submitRoute, async (c) => c.json(await submitAssessment(await contextFor(c.get("user")), c.req.valid("param").id), 200))
  .openapi(approveRoute, async (c) => {
    const { id, questionId } = c.req.valid("param");
    return c.json(await approveNotApplicable(await contextFor(c.get("user")), id, questionId), 200);
  })
  .openapi(getPathwayRoute, async (c) => c.json(await getEnrollmentPathway(await contextFor(c.get("user")), c.req.valid("param").id), 200))
  .openapi(setPathwayRoute, async (c) => c.json(await setEnrollmentPathway(await contextFor(c.get("user")), c.req.valid("param").id, c.req.valid("json")), 200));
