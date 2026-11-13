import { createRoute, z } from "@hono/zod-openapi";
import { ASSESSMENT_KINDS, ASSESSMENT_STATUSES } from "@entrust/mizan-engine";
import { createAssessment, getAssessment, listAssessments, submitAssessment, updateAssessment } from "../../services/mizan-assessments";
import { clearRouter, contextFor, json, problem } from "../clear/shared";

// MIZAN assessments (#229): start one, list them, read one with its live computation, change its context, submit it for review.
// Financials (#231), ratings (#232), gates (#233) and documents (#234) have their own routes, all locked the same way.

const tags = ["MIZAN assessments"];
const router = clearRouter("mizan");

const Status = z.enum(ASSESSMENT_STATUSES);
const Person = z.object({ id: z.string(), name: z.string().nullable() });
const currency = z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, "Use a three-letter currency code, such as ETB.");

const Assessment = z
  .object({
    id: z.string(),
    assessmentNo: z.string().openapi({ example: "ET-SME-000001-A1" }),
    organizationId: z.string(),
    smeId: z.string().nullable(),
    legalName: z.string().nullable(),
    kind: z.enum(ASSESSMENT_KINDS),
    status: Status,
    previousAssessmentId: z.string().nullable(),
    supersededById: z.string().nullable(),
    reason: z.string().nullable(),
    methodology: z.string(),
    configVersion: z.string().openapi({ description: "The configuration the assessment is scored under, pinned when it was created" }),
    configFingerprint: z.string(),
    engineVersion: z.string(),
    countryModule: z.string(),
    industry: z.string().nullable(),
    currency: z.string(),
    topCustomerShare: z.number().nullable(),
    monthsOperating: z.number().nullable(),
    assessor: Person,
    reviewer: Person.nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
    submittedAt: z.string().nullable(),
    approvedAt: z.string().nullable(),
    canEdit: z.boolean().openapi({ description: "The caller may change its inputs now" }),
    canSubmit: z.boolean(),
    submissionBlockers: z.array(z.string()).openapi({ description: "What stops submission, each naming what is missing" }),
    departures: z.array(z.object({ criterionId: z.string(), rating: z.number(), suggested: z.number(), explained: z.boolean() })),
    computation: z
      .object({
        frozen: z.boolean().openapi({ description: "True for an approved assessment: the record stored at approval, never recomputed" }),
        analyses: z.any().openapi({ description: "Ratios, derived figures and quality checks per fiscal year, oldest first" }),
        result: z.any().openapi({ description: "The score, level, coverage, gates and overrides (ScoreResult)" }),
        diagnostics: z.any().openapi({ description: "Strengths, weaknesses and the improvement plan" }),
      })
      .openapi({ description: "Computed live from the current inputs while open" }),
  })
  .openapi("MizanAssessment");

const ListItem = z.object({
  id: z.string(),
  assessmentNo: z.string(),
  organizationId: z.string(),
  legalName: z.string().nullable(),
  kind: z.enum(ASSESSMENT_KINDS),
  status: Status,
  configVersion: z.string(),
  assessorName: z.string().nullable(),
  createdAt: z.string(),
  submittedAt: z.string().nullable(),
  approvedAt: z.string().nullable(),
});

const errors = { 400: problem("The request is malformed"), 401: problem("Not signed in"), 404: problem("No such assessment, or the caller can't see it") };
const writeErrors = {
  ...errors,
  403: problem("The caller can't assess this SME or change this assessment"),
  409: problem("It is locked, or the SME already has an open assessment"),
  422: problem("Something it needs is missing: the notice, a rating, an evidence level, a gate or a reason"),
};
const idParam = z.object({ id: z.uuid() });

const listRoute = createRoute({
  method: "get",
  path: "/assessments",
  tags,
  summary: "Assessments",
  description: "Newest first, up to 500. MIZAN staff (Quality too).",
  request: {
    query: z.object({
      organizationId: z.string().optional(),
      status: Status.optional(),
      mine: z.enum(["true", "false"]).optional().transform((v) => v === "true"),
    }),
  },
  responses: { 200: { description: "The assessments", content: json(z.object({ items: z.array(ListItem) })) }, ...errors, 403: problem("Not MIZAN staff") },
});

const createRoute_ = createRoute({
  method: "post",
  path: "/assessments",
  tags,
  summary: "Start an assessment",
  description:
    "Needs the SME's accepted assessment notice (in MIZAN or in TRADE), and an Assessor or Super Admin who never supported the SME. Pins the configuration in use, its fingerprint, the engine release and the country module. One open assessment per SME.",
  request: {
    body: { content: json(z.strictObject({ organizationId: z.string().min(1), currency: currency.optional(), industry: z.string().trim().max(200).optional() })) },
  },
  responses: { 201: { description: "The new assessment", content: json(Assessment) }, ...writeErrors },
});

const getRoute = createRoute({
  method: "get",
  path: "/assessments/{id}",
  tags,
  summary: "An assessment",
  description: "With its live computation and what stops submission while it is open; with the frozen record once approved.",
  request: { params: idParam },
  responses: { 200: { description: "The assessment", content: json(Assessment) }, ...errors },
});

const updateRoute = createRoute({
  method: "patch",
  path: "/assessments/{id}",
  tags,
  summary: "Change an assessment's context",
  description:
    "Currency, industry, the largest customer's share of revenue (0 to 1) and months operating. Its assessor or a Super Admin, while it is a draft or returned. The configuration it pinned can never be changed.",
  request: {
    params: idParam,
    body: {
      content: json(
        z.strictObject({
          currency: currency.optional(),
          industry: z.string().trim().max(200).nullable().optional(),
          topCustomerShare: z.number().min(0).max(1).nullable().optional(),
          monthsOperating: z.number().int().min(0).max(2400).nullable().optional(),
        }),
      ),
    },
  },
  responses: { 200: { description: "The assessment", content: json(Assessment) }, ...writeErrors },
});

const submitRoute = createRoute({
  method: "post",
  path: "/assessments/{id}/submit",
  tags,
  summary: "Submit for review",
  description:
    "Locks the assessment for a second person to review. Refused while the notice is withdrawn, while the assessor is recorded as having supported the SME, or while a mandatory criterion is unrated, a rating has no evidence level, a gate is pending, or a rating differs from the interim ratio suggestion without a reason.",
  request: { params: idParam },
  responses: { 200: { description: "The assessment, in review", content: json(Assessment) }, ...writeErrors },
});

export const mizanAssessmentRoutes = router
  .openapi(listRoute, async (c) => c.json(await listAssessments(await contextFor(c.get("user")), c.req.valid("query")), 200))
  .openapi(createRoute_, async (c) => c.json(await createAssessment(await contextFor(c.get("user")), c.req.valid("json")), 201))
  .openapi(getRoute, async (c) => c.json(await getAssessment(await contextFor(c.get("user")), c.req.valid("param").id), 200))
  .openapi(updateRoute, async (c) => c.json(await updateAssessment(await contextFor(c.get("user")), c.req.valid("param").id, c.req.valid("json")), 200))
  .openapi(submitRoute, async (c) => c.json(await submitAssessment(await contextFor(c.get("user")), c.req.valid("param").id), 200));
