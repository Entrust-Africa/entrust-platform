import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { getDb } from "@entrust/db";
import type { AppEnv } from "../app";
import {
  ApplicationDetail,
  ApplicationList,
  ApplicationParam,
  AssignOfficerBody,
  AttachDocumentBody,
  CreateApplicationBody,
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
  SaveAnswersBody,
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
import { assignOfficer, listOfficers, recordException } from "../services/summit-review";
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
  );
