import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { getDb } from "@entrust/db";
import type { AppEnv } from "../app";
import {
  AdjustScoreBody,
  ApplicationDetail,
  ApplicationList,
  ApplicationParam,
  AssessmentView,
  AssignOfficerBody,
  AttachDocumentBody,
  CategoryNoteBody,
  CategoryParam,
  ClarificationBody,
  ClarificationParam,
  ClassifyClaimBody,
  ClaimParam,
  CommentBody,
  CommitteeItem,
  CommitteeList,
  CommitteeQuery,
  CompareQuery,
  CompareView,
  CreateApplicationBody,
  DecisionBody,
  CurrentPeriod,
  DocumentDownload,
  DocumentParam,
  ExceptionBody,
  Form,
  FormParam,
  ListQuery,
  OfficerList,
  Period,
  PeriodBody,
  PeriodList,
  PeriodParam,
  PeriodPatch,
  RecommendationBody,
  RecordScoresBody,
  RespondBody,
  ReviewBody,
  SaveAnswersBody,
  StageBody,
  WithdrawBody,
  type FormView,
} from "../schemas/summit";
import { ServiceError } from "../services/errors";
import {
  attachDocument,
  createApplication,
  documentDownloadUrl,
  getApplication,
  listApplications,
  removeDocument,
  saveAnswers,
  submitApplication,
  withdrawApplication,
} from "../services/summit-applications";
import { findApplicationTemplate } from "../services/summit-forms";
import { createPeriod, currentPeriod, listPeriods, updatePeriod } from "../services/summit-periods";
import { adjustScore, addComment, classifyClaim, completeAssessment, getAssessment, recordRecommendation, recordScores, saveCategoryNote, setStage } from "../services/summit-assessment";
import { requestClarification, respondToClarification } from "../services/summit-clarifications";
import { compareForCommittee, listForCommittee, recordDecision } from "../services/summit-committee";
import { assignOfficer, listOfficers, recordException, reviewAssessment } from "../services/summit-review";
import { clearRouter, contextFor, json, listErrors, problem, readErrors, writeErrors } from "./clear/shared";

// The Summit SME application platform (#79): the public period, the applicant's application, and the administrators'
// part of the workflow. Summit is its own platform; its data is in the summit schema.

const tags = ["Summit"];

const notFound = problem("No such application, or the caller can't open it");
const reads = { ...listErrors, 404: notFound };
const writes = {
  ...writeErrors,
  404: notFound,
  403: problem("The caller can open the application but their role can't make this change"),
};
const adminWrites = { ...listErrors, 403: problem("Only Entrust administrators can do this"), 404: notFound, 409: writes[409], 422: writes[422] };

// ---- Public ----

const publicRouter = new OpenAPIHono<AppEnv>();

const currentRoute = createRoute({
  method: "get",
  path: "/period",
  tags,
  summary: "The application period",
  description:
    "For the public Summit page: the period open now, otherwise the next to open, otherwise the latest to close. It needs no sign-in and shows no applicant data.",
  responses: { 200: { description: "The period, or null before any is set", content: json(CurrentPeriod) } },
});

export const summitPublic = publicRouter.openapi(currentRoute, async (c) =>
  c.json({ period: await currentPeriod({ db: getDb(), now: new Date() }) }, 200),
);

// ---- Signed in ----

const router = clearRouter();

const listPeriodsRoute = createRoute({
  method: "get",
  path: "/periods",
  tags,
  summary: "List the application periods",
  description: "Newest first. Entrust staff only.",
  responses: { 200: { description: "The periods", content: json(PeriodList) }, ...listErrors, 403: problem("Not Entrust staff") },
});

const createPeriodRoute = createRoute({
  method: "post",
  path: "/periods",
  tags,
  summary: "Open an application period",
  description:
    "Sets the window, the countries whose SMEs may apply, and the version of the application form and of the rules. It needs a published form and approved rules, so it is refused until Entrust has confirmed the questions. Periods can't overlap. A super administrator only.",
  request: { body: { required: true, content: json(PeriodBody) } },
  responses: { 201: { description: "The period", content: json(Period) }, ...adminWrites },
});

const updatePeriodRoute = createRoute({
  method: "patch",
  path: "/periods/{id}",
  tags,
  summary: "Change an application period",
  description: "The name, the window and the countries. The form and rules versions stay, since applications already use them. A super administrator only.",
  request: { params: PeriodParam, body: { required: true, content: json(PeriodPatch) } },
  responses: { 200: { description: "The period", content: json(Period) }, ...adminWrites },
});

const formRoute = createRoute({
  method: "get",
  path: "/forms/{version}",
  tags,
  summary: "View a version of the application form",
  description: "The sections and questions, with the conditions that show or hide each one. An applicant opens published versions only; Entrust staff also open drafts.",
  request: { params: FormParam },
  responses: { 200: { description: "The form", content: json(Form) }, ...reads },
});

const listRoute = createRoute({
  method: "get",
  path: "/applications",
  tags,
  summary: "List applications",
  description:
    "An applicant sees their organisations' applications, with a status that hides where Entrust's workflow has got to. An administrator or facilitator sees every application with how complete it is and the officer it is assigned to. An assessment officer sees those assigned to them.",
  request: { query: ListQuery },
  responses: { 200: { description: "The applications", content: json(ApplicationList) }, ...listErrors },
});

const startRoute = createRoute({
  method: "post",
  path: "/applications",
  tags,
  summary: "Start an application",
  description:
    "For an SME organisation the caller belongs to, while a period is open and the organisation's country is allowed in it. The registry's answers (name, country) are filled in. The first application gives the organisation Summit access. One application a period, unless the earlier one was withdrawn.",
  request: { body: { required: true, content: json(CreateApplicationBody) } },
  responses: {
    201: { description: "The new application", content: json(ApplicationDetail) },
    ...listErrors,
    403: problem("The Summit isn't taking applications from the organisation's country"),
    404: problem("No such organisation or period"),
    409: problem("The organisation has already applied in this period"),
    422: problem("Applications aren't open, or the organisation has no SME profile"),
  },
});

const getRoute = createRoute({
  method: "get",
  path: "/applications/{id}",
  tags,
  summary: "View an application",
  description:
    "The applicant sees their answers, documents, progress and eligibility result, and never scores or internal notes. Entrust staff also see the status history, the assigned officer and any eligibility exceptions.",
  request: { params: ApplicationParam },
  responses: { 200: { description: "The application", content: json(ApplicationDetail) }, ...reads },
});

const answersRoute = createRoute({
  method: "patch",
  path: "/applications/{id}/answers",
  tags,
  summary: "Save answers",
  description:
    "Adds or changes answers, so the applicant can leave and resume. A null clears one. An answer that isn't valid for its question is refused; an unanswered question is not, since that only blocks submitting. Open while the application is a draft and before the period closes, or while it waits on a clarification about eligibility.",
  request: { params: ApplicationParam, body: { required: true, content: json(SaveAnswersBody) } },
  responses: { 200: { description: "The application", content: json(ApplicationDetail) }, ...writes },
});

const attachRoute = createRoute({
  method: "post",
  path: "/applications/{id}/documents",
  tags,
  summary: "Attach a document",
  description:
    "Attaches a file uploaded through the files API for the applicant's organisation, as one kind of supporting document. Uploading a document never marks a claim as verified. Financial statements are restricted.",
  request: { params: ApplicationParam, body: { required: true, content: json(AttachDocumentBody) } },
  responses: { 201: { description: "The application", content: json(ApplicationDetail) }, ...writes },
});

const removeRoute = createRoute({
  method: "delete",
  path: "/applications/{id}/documents/{documentId}",
  tags,
  summary: "Remove a document",
  description: "Detaches the document from the application. The file stays in the files store.",
  request: { params: DocumentParam },
  responses: { 200: { description: "The application", content: json(ApplicationDetail) }, ...writes },
});

const downloadRoute = createRoute({
  method: "get",
  path: "/applications/{id}/documents/{documentId}/download-url",
  tags,
  summary: "Get a link to a document",
  description:
    "A short-lived link. The applicant opens their own documents. The assigned officer and administrators open any. A facilitator opens any except financial statements.",
  request: { params: DocumentParam },
  responses: { 200: { description: "The link", content: json(DocumentDownload) }, ...reads, 403: problem("A restricted document") },
});

const submitRoute = createRoute({
  method: "post",
  path: "/applications/{id}/submit",
  tags,
  summary: "Submit an application",
  description:
    "Every shown question has to be answered and the declaration accepted. The platform then screens eligibility against the six requirements: eligible, ineligible, or awaiting additional information (the answers and documents don't yet settle a requirement). After the last, the applicant fixes what is missing and submits again. Eligibility is separate from the commercial score.",
  request: { params: ApplicationParam },
  responses: { 200: { description: "The application", content: json(ApplicationDetail) }, ...writes },
});

const withdrawRoute = createRoute({
  method: "post",
  path: "/applications/{id}/withdraw",
  tags,
  summary: "Withdraw an application",
  description: "Final. The organisation may start a new application while the period is open.",
  request: { params: ApplicationParam, body: { required: false, content: json(WithdrawBody) } },
  responses: { 200: { description: "The application", content: json(ApplicationDetail) }, ...writes },
});

const officersRoute = createRoute({
  method: "get",
  path: "/officers",
  tags,
  summary: "List the assessment officers",
  description: "The Entrust reviewers an application can be assigned to, with how many they hold. Administrators and facilitators only.",
  responses: { 200: { description: "The officers", content: json(OfficerList) }, ...listErrors, 403: problem("Not an administrator or facilitator") },
});

const assignRoute = createRoute({
  method: "put",
  path: "/applications/{id}/officer",
  tags,
  summary: "Assign an application to an officer",
  description:
    "An eligible application moves into assessment; one in assessment is handed to another officer, and the earlier assignment is kept with the time it ended. Only the assigned officer opens it from then on. Administrators and facilitators only.",
  request: { params: ApplicationParam, body: { required: true, content: json(AssignOfficerBody) } },
  responses: { 200: { description: "The application", content: json(ApplicationDetail) }, ...writes },
});

const exceptionRoute = createRoute({
  method: "post",
  path: "/applications/{id}/eligibility-exceptions",
  tags,
  summary: "Record an eligibility exception",
  description:
    "Accepts an applicant that falls short of a requirement, with the reason. The application is screened again with the exception counted as satisfied. The applicant sees the requirement as met. Administrators and facilitators only.",
  request: { params: ApplicationParam, body: { required: true, content: json(ExceptionBody) } },
  responses: { 201: { description: "The application", content: json(ApplicationDetail) }, ...writes },
});

// ---- The officer's workspace ----

const staffOnly = problem("The caller is an applicant, or their role can't make this change");
const workspace = {
  ...listErrors,
  403: staffOnly,
  404: notFound,
  409: writes[409],
  422: writes[422],
};

const assessmentRoute = createRoute({
  method: "get",
  path: "/applications/{id}/assessment",
  tags,
  summary: "Open the assessment workspace",
  description:
    "The rubric with the officer's scores, any adjustments, the justification and evidence for each category, the adjusted score, claim classifications, internal comments, requests for more information and the recommendation. The assigned officer, administrators and facilitators only: an applicant never sees any of it.",
  request: { params: ApplicationParam },
  responses: { 200: { description: "The workspace", content: json(AssessmentView) }, ...workspace },
});

const scoresRoute = createRoute({
  method: "post",
  path: "/applications/{id}/assessment/scores",
  tags,
  summary: "Record scores",
  description:
    "Whole points for one or more criteria, from 0 to each criterion's maximum, against the approved rubric the period names. A score is written once and never overwritten: a criterion already scored is refused, and a change is made as an adjustment. Only the assigned officer, while the application is in assessment or verification.",
  request: { params: ApplicationParam, body: { required: true, content: json(RecordScoresBody) } },
  responses: { 201: { description: "The workspace", content: json(AssessmentView) }, ...workspace },
});

const adjustRoute = createRoute({
  method: "post",
  path: "/applications/{id}/assessment/adjustments",
  tags,
  summary: "Adjust a score",
  description:
    "Changes a recorded score by hand and keeps the score before, the score after, the reason, who and when. The original score stays. The assigned officer can adjust until they complete the assessment; an administrator or facilitator until the committee starts.",
  request: { params: ApplicationParam, body: { required: true, content: json(AdjustScoreBody) } },
  responses: { 201: { description: "The workspace", content: json(AssessmentView) }, ...workspace },
});

const noteRoute = createRoute({
  method: "put",
  path: "/applications/{id}/assessment/notes/{category}",
  tags,
  summary: "Write a category's justification and evidence",
  description:
    "The short justification of the points and the evidence they rest on, which the scorecard asks for each category. A category that earned points needs both before the assessment can be completed. Only the assigned officer.",
  request: { params: CategoryParam, body: { required: true, content: json(CategoryNoteBody) } },
  responses: { 200: { description: "The workspace", content: json(AssessmentView) }, ...workspace },
});

const claimRoute = createRoute({
  method: "put",
  path: "/applications/{id}/verification/{claim}",
  tags,
  summary: "Classify a claim",
  description:
    "Self-reported, document-supported, independently verified, not verified or not applicable. A claim is never independently verified because a document was uploaded: that class needs a note of what was checked outside the application. Classifying again replaces the earlier classification. Only the assigned officer.",
  request: { params: ClaimParam, body: { required: true, content: json(ClassifyClaimBody) } },
  responses: { 200: { description: "The workspace", content: json(AssessmentView) }, ...workspace },
});

const commentRoute = createRoute({
  method: "post",
  path: "/applications/{id}/comments",
  tags,
  summary: "Add an internal comment",
  description: "A note between staff. The applicant can't see it.",
  request: { params: ApplicationParam, body: { required: true, content: json(CommentBody) } },
  responses: { 201: { description: "The workspace", content: json(AssessmentView) }, ...workspace },
});

const stageRoute = createRoute({
  method: "post",
  path: "/applications/{id}/stage",
  tags,
  summary: "Move between assessment and verification",
  description: "Only the assigned officer.",
  request: { params: ApplicationParam, body: { required: true, content: json(StageBody) } },
  responses: { 200: { description: "The workspace", content: json(AssessmentView) }, ...workspace },
});

const clarificationRoute = createRoute({
  method: "post",
  path: "/applications/{id}/clarifications",
  tags,
  summary: "Ask the applicant for more information",
  description:
    "The application waits in \"awaiting additional information\" and the applicant is emailed. `notifiedAt` on the request says whether the email was queued. The assigned officer, administrators and facilitators, while the application is in assessment or verification.",
  request: { params: ApplicationParam, body: { required: true, content: json(ClarificationBody) } },
  responses: { 201: { description: "The workspace", content: json(AssessmentView) }, ...workspace },
});

const respondRoute = createRoute({
  method: "post",
  path: "/applications/{id}/clarifications/{clarificationId}/respond",
  tags,
  summary: "Answer a request for more information",
  description:
    "The applicant's reply. They can attach documents while the request is open. The application returns to the stage it was in.",
  request: { params: ClarificationParam, body: { required: true, content: json(RespondBody) } },
  responses: { 200: { description: "The application", content: json(ApplicationDetail) }, ...writes },
});

const completeRoute = createRoute({
  method: "post",
  path: "/applications/{id}/assessment/complete",
  tags,
  summary: "Complete the assessment",
  description:
    "Every applicable criterion has to be scored, every scored category needs its justification, and one that earned points needs its evidence. Only the assigned officer.",
  request: { params: ApplicationParam },
  responses: { 200: { description: "The workspace", content: json(AssessmentView) }, ...workspace },
});

const recommendRoute = createRoute({
  method: "post",
  path: "/applications/{id}/recommendation",
  tags,
  summary: "Make the recommendation",
  description:
    "Recommend for selection, subject to verification, for development or waitlist, or not at all, with the opportunity that suits the applicant and the reason. The application becomes recommended. Only the assigned officer, once the assessment is complete.",
  request: { params: ApplicationParam, body: { required: true, content: json(RecommendationBody) } },
  responses: { 201: { description: "The workspace", content: json(AssessmentView) }, ...workspace },
});

// ---- Quality review and the selection committee ----

const reviewRoute = createRoute({
  method: "post",
  path: "/applications/{id}/review",
  tags,
  summary: "Review a completed assessment",
  description:
    "An administrator's quality check of the officer's scores and recommendation, once the officer has recommended. Approving sends the application to the selection committee. Returning it, with what to fix, gives the assessment back to the officer, who can adjust scores, complete it and recommend again. Administrators and facilitators only.",
  request: { params: ApplicationParam, body: { required: true, content: json(ReviewBody) } },
  responses: { 200: { description: "The workspace", content: json(AssessmentView) }, ...workspace },
});

const committeeListRoute = createRoute({
  method: "get",
  path: "/committee/applications",
  tags,
  summary: "Compare and filter the applicants in committee review",
  description:
    "The applications from the start of committee review on, with each one's score, place by score, readiness, category points, recommendation and the committee's latest decision. Filter by country, sector, opportunity type, score, readiness, recommendation, decision, and women-owned or youth-owned. Scores include manual adjustments, and places are over the whole period, so a filter doesn't move them. The selection committee, administrators and facilitators.",
  request: { query: CommitteeQuery },
  responses: { 200: { description: "The applications", content: json(CommitteeList) }, ...listErrors, 403: problem("Not the committee, an administrator or a facilitator"), 404: problem("No such period") },
});

const compareRoute = createRoute({
  method: "get",
  path: "/committee/compare",
  tags,
  summary: "Compare two to five applicants side by side",
  description:
    "Each applicant's score and points in every category, the recommendation and the reason for it, what was verified and how, the manual adjustments, and the figures the committee weighs (revenue, employees, the commercial ask).",
  request: { query: CompareQuery },
  responses: { 200: { description: "The applicants", content: json(CompareView) }, ...listErrors, 403: problem("Not the committee, an administrator or a facilitator"), 404: problem("One of the applications isn't in committee review") },
});

const decisionRoute = createRoute({
  method: "post",
  path: "/applications/{id}/decision",
  tags,
  summary: "Record the committee's decision",
  description:
    "Selected, waitlisted, not selected, or further review required, with the reason. A decision can be replaced by another and each is kept. The applicant is told nothing yet. Members of the selection committee only: they change nothing of the assessment, and add comments through the comments endpoint.",
  request: { params: ApplicationParam, body: { required: true, content: json(DecisionBody) } },
  responses: { 201: { description: "The application as the committee sees it", content: json(CommitteeItem) }, ...workspace },
});

export const summit = router
  .openapi(listPeriodsRoute, async (c) => c.json({ items: await listPeriods(await contextFor(c.get("user"))) }, 200))
  .openapi(createPeriodRoute, async (c) => c.json(await createPeriod(await contextFor(c.get("user")), c.req.valid("json")), 201))
  .openapi(updatePeriodRoute, async (c) =>
    c.json(await updatePeriod(await contextFor(c.get("user")), c.req.valid("param").id, c.req.valid("json")), 200),
  )
  .openapi(formRoute, async (c) => {
    const ctx = await contextFor(c.get("user"));
    const form = findApplicationTemplate(c.req.valid("param").version);
    // A draft looks the same as a version that doesn't exist to anyone but Entrust staff.
    if (!form || (form.status !== "published" && !ctx.principal.staffRole)) throw new ServiceError("not_found", "That version of the form doesn't exist.");
    const { id, version, title, status, sections, questions, registry } = form;
    return c.json({ id, version, title, status, sections, questions, registry } as FormView, 200);
  })
  .openapi(listRoute, async (c) => c.json(await listApplications(await contextFor(c.get("user")), c.req.valid("query")), 200))
  .openapi(startRoute, async (c) => c.json(await createApplication(await contextFor(c.get("user")), c.req.valid("json")), 201))
  .openapi(getRoute, async (c) => c.json(await getApplication(await contextFor(c.get("user")), c.req.valid("param").id), 200))
  .openapi(answersRoute, async (c) =>
    c.json(await saveAnswers(await contextFor(c.get("user")), c.req.valid("param").id, c.req.valid("json").answers), 200),
  )
  .openapi(attachRoute, async (c) =>
    c.json(await attachDocument(await contextFor(c.get("user")), c.req.valid("param").id, c.req.valid("json")), 201),
  )
  .openapi(removeRoute, async (c) => {
    const { id, documentId } = c.req.valid("param");
    return c.json(await removeDocument(await contextFor(c.get("user")), id, documentId), 200);
  })
  .openapi(downloadRoute, async (c) => {
    const { id, documentId } = c.req.valid("param");
    return c.json(await documentDownloadUrl(await contextFor(c.get("user")), id, documentId), 200);
  })
  .openapi(submitRoute, async (c) => c.json(await submitApplication(await contextFor(c.get("user")), c.req.valid("param").id), 200))
  .openapi(withdrawRoute, async (c) =>
    c.json(await withdrawApplication(await contextFor(c.get("user")), c.req.valid("param").id, c.req.valid("json")?.reason), 200),
  )
  .openapi(officersRoute, async (c) => c.json(await listOfficers(await contextFor(c.get("user"))), 200))
  .openapi(assignRoute, async (c) =>
    c.json(await assignOfficer(await contextFor(c.get("user")), c.req.valid("param").id, c.req.valid("json").officerUserId), 200),
  )
  .openapi(exceptionRoute, async (c) =>
    c.json(await recordException(await contextFor(c.get("user")), c.req.valid("param").id, c.req.valid("json")), 201),
  )
  .openapi(assessmentRoute, async (c) => c.json(await getAssessment(await contextFor(c.get("user")), c.req.valid("param").id), 200))
  .openapi(scoresRoute, async (c) =>
    c.json(await recordScores(await contextFor(c.get("user")), c.req.valid("param").id, c.req.valid("json").scores), 201),
  )
  .openapi(adjustRoute, async (c) =>
    c.json(await adjustScore(await contextFor(c.get("user")), c.req.valid("param").id, c.req.valid("json")), 201),
  )
  .openapi(noteRoute, async (c) => {
    const { id, category } = c.req.valid("param");
    return c.json(await saveCategoryNote(await contextFor(c.get("user")), id, category, c.req.valid("json")), 200);
  })
  .openapi(claimRoute, async (c) => {
    const { id, claim } = c.req.valid("param");
    return c.json(await classifyClaim(await contextFor(c.get("user")), id, claim, c.req.valid("json")), 200);
  })
  .openapi(commentRoute, async (c) =>
    c.json(await addComment(await contextFor(c.get("user")), c.req.valid("param").id, c.req.valid("json").body), 201),
  )
  .openapi(stageRoute, async (c) =>
    c.json(await setStage(await contextFor(c.get("user")), c.req.valid("param").id, c.req.valid("json").to), 200),
  )
  .openapi(clarificationRoute, async (c) =>
    c.json(await requestClarification(await contextFor(c.get("user")), c.req.valid("param").id, c.req.valid("json").message), 201),
  )
  .openapi(respondRoute, async (c) => {
    const { id, clarificationId } = c.req.valid("param");
    return c.json(await respondToClarification(await contextFor(c.get("user")), id, clarificationId, c.req.valid("json").response), 200);
  })
  .openapi(completeRoute, async (c) => c.json(await completeAssessment(await contextFor(c.get("user")), c.req.valid("param").id), 200))
  .openapi(recommendRoute, async (c) =>
    c.json(await recordRecommendation(await contextFor(c.get("user")), c.req.valid("param").id, c.req.valid("json")), 201),
  )
  .openapi(reviewRoute, async (c) =>
    c.json(await reviewAssessment(await contextFor(c.get("user")), c.req.valid("param").id, c.req.valid("json")), 200),
  )
  .openapi(committeeListRoute, async (c) => c.json(await listForCommittee(await contextFor(c.get("user")), c.req.valid("query")), 200))
  .openapi(compareRoute, async (c) => c.json(await compareForCommittee(await contextFor(c.get("user")), c.req.valid("query").ids), 200))
  .openapi(decisionRoute, async (c) =>
    c.json(await recordDecision(await contextFor(c.get("user")), c.req.valid("param").id, c.req.valid("json")), 201),
  );
