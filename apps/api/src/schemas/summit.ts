import { z } from "@hono/zod-openapi";
import { QUESTION_TYPES } from "@entrust/forms";
import {
  CATEGORY_IDS,
  COMMITTEE_DECISIONS,
  COMMITTEE_STATUSES,
  DOCUMENT_KINDS,
  ELIGIBILITY_CRITERIA,
  ELIGIBILITY_OUTCOMES,
  OPPORTUNITY_PATHWAYS,
  RECOMMENDATIONS,
  SUITABLE_OPPORTUNITIES,
  VERIFICATION_CLASSES,
} from "@entrust/summit-engine";
import { DownloadUrlResponse } from "./files";

// What the Summit endpoints take and give. The services build these shapes, so the OpenAPI document,
// the typed client and the code can't drift apart.

const Timestamp = z.string().openapi({ description: "ISO 8601 timestamp", example: "2026-12-01T09:00:00.000Z" });
const CriterionId = z.enum(ELIGIBILITY_CRITERIA.map((c) => c.id) as [string, ...string[]]);

// ---- Application periods ----

export const Period = z
  .object({
    id: z.uuid(),
    name: z.string().openapi({ example: "Africa Diaspora Trade and Investment Summit 2026" }),
    opensAt: Timestamp,
    closesAt: Timestamp,
    /** ISO 3166-1 alpha-2 codes of the countries whose SMEs may apply. */
    countries: z.array(z.string()),
    /** The application form applicants answer. */
    templateVersion: z.string().openapi({ example: "1.0.0" }),
    /** The version of the rules (eligibility documents and the scorecard) used to screen and score. */
    rulesVersion: z.string().openapi({ example: "1.0.0" }),
    state: z.enum(["upcoming", "open", "closed"]),
  })
  .openapi("SummitPeriod");

export const PeriodList = z.object({ items: z.array(Period) }).openapi("SummitPeriodList");

export const CurrentPeriod = z
  .object({
    period: Period.nullable().openapi({
      description: "The period open now; otherwise the next one to open; otherwise the latest to close. Null before any is set.",
    }),
  })
  .openapi("SummitCurrentPeriod");

export const PeriodBody = z
  .object({
    name: z.string().trim().min(1).max(160),
    opensAt: z.iso.datetime({ offset: true }),
    closesAt: z.iso.datetime({ offset: true }),
    countries: z.array(z.string().trim().length(2)).min(1).max(60).openapi({ example: ["ET", "KE", "GH"] }),
    templateVersion: z
      .string()
      .optional()
      .openapi({ description: "A published version of the application form. Default: the newest published." }),
    rulesVersion: z.string().optional().openapi({ description: "An approved version of the rules. Default: the newest approved." }),
  })
  .openapi("SummitPeriodBody");

export const PeriodPatch = z
  .object({
    name: PeriodBody.shape.name.optional(),
    opensAt: PeriodBody.shape.opensAt.optional(),
    closesAt: PeriodBody.shape.closesAt.optional(),
    countries: PeriodBody.shape.countries.optional(),
  })
  .openapi("SummitPeriodPatch");

export const PeriodParam = z.object({ id: z.uuid() });

// ---- The application form ----

export const Form = z
  .object({
    id: z.string().openapi({ example: "summit.application" }),
    version: z.string(),
    title: z.string(),
    status: z.enum(["draft", "published"]),
    sections: z.array(
      z.object({ id: z.string(), title: z.string(), purpose: z.string().optional(), notes: z.array(z.string()).optional() }),
    ),
    questions: z.array(
      z.object({
        id: z.string().openapi({ example: "S2.12" }),
        section: z.string(),
        type: z.enum(QUESTION_TYPES),
        text: z.string(),
        help: z.string().optional(),
        group: z.string().optional(),
        options: z.array(z.object({ value: z.string(), label: z.string(), exclusive: z.boolean().optional() })).optional(),
        showIf: z.unknown().optional().openapi({ description: "A condition on earlier answers, evaluated with @entrust/forms." }),
        optional: z.boolean().optional(),
        mustBe: z.enum(["yes", "no"]).optional(),
        maxLength: z.number().optional(),
        integer: z.boolean().optional(),
        min: z.number().optional(),
        max: z.number().optional(),
        currencies: z.array(z.string()).optional(),
        maxItems: z.number().optional(),
        notFuture: z.boolean().optional(),
      }),
    ),
    /** The questions the SME registry fills in ahead of time. */
    registry: z.array(z.string()),
  })
  .openapi("SummitForm");

export const FormParam = z.object({ version: z.string().openapi({ example: "1.0.0" }) });

// ---- Applications ----

export const Answer = z
  .union([z.string(), z.number(), z.array(z.string()), z.object({ amount: z.number(), currency: z.string() }), z.object({ notKnown: z.literal(true) })])
  .openapi("SummitAnswer", {
    description:
      "A choice, yes/no, text or date (YYYY-MM-DD) is a string; a number is a number; a multiple choice or a list is an array of strings; money is { amount, currency }; \"not known\" is { notKnown: true }.",
  });

const Pathway = z.enum(OPPORTUNITY_PATHWAYS);
const DocumentKind = z.enum(DOCUMENT_KINDS);

const QuestionProblem = z.object({ question: z.string(), code: z.string(), message: z.string() });

const Progress = z
  .object({
    total: z.number().int().openapi({ description: "Shown questions that have to be answered." }),
    answered: z.number().int(),
    percent: z.number().int().openapi({ description: "100 means the form can be submitted." }),
    bySection: z.record(z.string(), z.object({ answered: z.number().int(), total: z.number().int() })),
  })
  .openapi("SummitProgress");

const Person = z.object({ id: z.string(), name: z.string() });

const DocumentView = z
  .object({
    id: z.uuid(),
    fileId: z.uuid(),
    kind: DocumentKind,
    /** Financial documents are restricted: only the applicant, the assigned officer and a super administrator open them. */
    restricted: z.boolean(),
    fileName: z.string(),
    contentType: z.string(),
    sizeBytes: z.number().int(),
    addedAt: Timestamp,
  })
  .openapi("SummitDocument");

const EligibilityView = z
  .object({
    outcome: z.enum(ELIGIBILITY_OUTCOMES),
    /** The six requirements. The applicant sees an excepted requirement as met. */
    criteria: z.array(
      z.object({ id: CriterionId, text: z.string(), result: z.enum(["met", "not_met", "unclear", "excepted"]), reason: z.string() }),
    ),
    missingDocuments: z.array(DocumentKind),
    screenedAt: Timestamp,
  })
  .openapi("SummitEligibility");

export const Clarification = z
  .object({
    id: z.uuid(),
    /** What Entrust asked the applicant. */
    message: z.string(),
    requestedAt: Timestamp,
    /** Who asked. Entrust staff only. */
    requestedBy: Person.nullable(),
    /** When the email was queued. Entrust staff only: null for an applicant, and for staff when it could not be. */
    notifiedAt: Timestamp.nullable(),
    response: z.string().nullable(),
    respondedAt: Timestamp.nullable(),
    open: z.boolean().openapi({ description: "The application is waiting on this one." }),
  })
  .openapi("SummitClarification");

export const ApplicationDetail = z
  .object({
    id: z.uuid(),
    /** The unique application ID, such as SUM-000123. */
    number: z.string().openapi({ example: "SUM-000123" }),
    organizationId: z.string(),
    organizationName: z.string(),
    smeId: z.string().nullable(),
    country: z.string().nullable(),
    periodId: z.uuid(),
    view: z.enum(["applicant", "staff"]).openapi({ description: "Who is looking. The applicant never sees staff-only fields." }),
    status: z.string().openapi({
      description:
        "Staff see the status of the workflow. The applicant sees one of draft, in_review, action_required, not_eligible or withdrawn.",
      example: "under_assessment",
    }),
    templateVersion: z.string(),
    pathway: Pathway.nullable(),
    answers: z.record(z.string(), Answer),
    progress: Progress,
    /** Shown questions still to answer, and answers that aren't valid. */
    incomplete: z.array(QuestionProblem),
    errors: z.array(QuestionProblem),
    /** The documents the chosen pathway needs at least. */
    requiredDocuments: z.array(DocumentKind),
    documents: z.array(DocumentView),
    eligibility: EligibilityView.nullable(),
    /** Whether the applicant can change answers and documents now. */
    editable: z.boolean(),
    /** Whether the applicant can submit now: editable, and the form is complete. */
    canSubmit: z.boolean(),
    /** Whether the applicant can attach documents now: when they can edit, and while a request for more information is open. */
    canEditDocuments: z.boolean(),
    /** Requests for more information, newest last. The applicant sees these and nothing else of the assessment. */
    clarifications: z.array(Clarification),
    closesAt: Timestamp,
    submittedAt: Timestamp.nullable(),
    createdAt: Timestamp,
    updatedAt: Timestamp,
    staff: z
      .object({
        history: z.array(
          z.object({ from: z.string().nullable(), to: z.string(), by: Person.nullable(), at: Timestamp, reason: z.string().nullable() }),
        ),
        officer: z.object({ userId: z.string(), name: z.string(), email: z.string(), assignedAt: Timestamp }).nullable(),
        exceptions: z.array(z.object({ criterion: CriterionId, reason: z.string(), by: Person.nullable(), at: Timestamp })),
      })
      .optional()
      .openapi({ description: "Present for Entrust staff only." }),
  })
  .openapi("SummitApplication");

export const ApplicationSummary = z
  .object({
    id: z.uuid(),
    number: z.string(),
    organizationId: z.string(),
    organizationName: z.string(),
    smeId: z.string().nullable(),
    country: z.string().nullable(),
    periodId: z.uuid(),
    status: z.string(),
    pathway: Pathway.nullable(),
    progressPercent: z.number().int(),
    eligibility: z.enum(ELIGIBILITY_OUTCOMES).nullable(),
    missingDocuments: z.number().int().openapi({ description: "Required documents not yet provided." }),
    officer: Person.nullable().openapi({ description: "Entrust staff only." }),
    submittedAt: Timestamp.nullable(),
    updatedAt: Timestamp,
  })
  .openapi("SummitApplicationSummary");

export const ApplicationList = z.object({ items: z.array(ApplicationSummary), total: z.number().int() }).openapi("SummitApplicationList");

export const ApplicationParam = z.object({ id: z.uuid() });
export const DocumentParam = ApplicationParam.extend({ documentId: z.uuid() });

export const ListQuery = z.object({
  organizationId: z.string().optional().openapi({ description: "Narrow to one organisation." }),
  periodId: z.uuid().optional(),
  status: z.string().optional().openapi({ description: "Entrust staff: a status of the workflow." }),
  pathway: Pathway.optional(),
  officerUserId: z.string().optional().openapi({ description: "Entrust administrators: the officer an application is assigned to." }),
  limit: z.coerce.number().int().min(1).max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

export const CreateApplicationBody = z
  .object({
    organizationId: z.string().min(1),
    periodId: z.uuid().optional().openapi({ description: "Default: the period open now." }),
  })
  .openapi("SummitCreateApplicationBody");

export const SaveAnswersBody = z
  .object({
    answers: z.record(z.string(), Answer.nullable()).openapi({
      description: "Answers to add or change, by question ID. A null clears the answer. Answers not named stay as they were.",
      example: { "S1.4": "registered", "S2.12": "trade_and_market_access" },
    }),
  })
  .openapi("SummitSaveAnswersBody");

export const AttachDocumentBody = z
  .object({
    fileId: z.uuid().openapi({ description: "A file uploaded through the files API for the applicant's organisation." }),
    kind: DocumentKind,
  })
  .openapi("SummitAttachDocumentBody");

export const WithdrawBody = z.object({ reason: z.string().trim().max(1000).optional() }).openapi("SummitWithdrawBody");

export const DocumentDownload = DownloadUrlResponse;

// ---- Administrators ----

export const OfficerList = z
  .object({
    items: z.array(
      z.object({ userId: z.string(), name: z.string(), email: z.string(), assigned: z.number().int().openapi({ description: "Applications currently assigned." }) }),
    ),
  })
  .openapi("SummitOfficerList");

export const AssignOfficerBody = z.object({ officerUserId: z.string().min(1) }).openapi("SummitAssignOfficerBody");

export const ExceptionBody = z
  .object({
    criterion: CriterionId,
    reason: z.string().trim().min(1).max(1000),
  })
  .openapi("SummitExceptionBody");

// ---- The officer's workspace ----

const Points = z.number().int().min(0);

const Criterion = z
  .object({
    id: z.string().openapi({ example: "A1" }),
    text: z.string(),
    maxPoints: z.number().int(),
    guidance: z.array(z.object({ from: z.number().int(), to: z.number().int(), text: z.string() })),
    evidence: z.array(z.string()),
    /** The points that count: the original score, or the latest adjustment of it. Null until scored. */
    points: Points.nullable(),
    /** The officer's original score, which is never overwritten. */
    original: z.object({ points: Points, by: Person.nullable(), at: Timestamp }).nullable(),
    adjusted: z.boolean(),
  })
  .openapi("SummitCriterionScore");

const CategoryView = z
  .object({
    id: z.enum(CATEGORY_IDS),
    title: z.string(),
    maxPoints: z.number().int(),
    assess: z.array(z.string()),
    /** The evidence the scorecard lists for the category. */
    evidence: z.array(z.string()),
    /** False for the investment category when the applicant isn't seeking investment: it is left out and the rest scaled. */
    applicable: z.boolean(),
    criteria: z.array(Criterion),
    /** Points for the category, once all its criteria are scored. */
    points: Points.nullable(),
    note: z.object({ justification: z.string(), evidence: z.array(z.string()), by: Person.nullable(), updatedAt: Timestamp }).nullable(),
  })
  .openapi("SummitCategoryScore");

const Verification = z
  .object({
    claim: z.string(),
    label: z.string().nullable().openapi({ description: "The name of a claim the specification lists; null for any other claim." }),
    class: z.enum(VERIFICATION_CLASSES),
    documents: z.array(z.object({ id: z.uuid(), kind: z.enum(DOCUMENT_KINDS), fileName: z.string() })),
    independentCheck: z.string().nullable(),
    by: Person.nullable(),
    at: Timestamp,
  })
  .openapi("SummitVerification");

const AssessmentReviewEntry = z
  .object({ decision: z.enum(["approved", "returned"]), reason: z.string().nullable(), by: Person.nullable(), at: Timestamp })
  .openapi("SummitAssessmentReview");

export const AssessmentView = z
  .object({
    applicationId: z.uuid(),
    number: z.string(),
    status: z.string(),
    rulesVersion: z.string(),
    /** Officers can't record scores against rules that aren't approved. */
    approved: z.boolean(),
    state: z.enum(["not_started", "in_progress", "completed"]),
    pathway: z.enum(OPPORTUNITY_PATHWAYS),
    seekingInvestment: z.boolean(),
    categories: z.array(CategoryView),
    score: z.object({
      /** Every applicable criterion has a score. */
      complete: z.boolean(),
      /** Points earned, once complete. */
      points: z.number().nullable(),
      /** What they are out of: 100, less a category that doesn't apply. */
      possible: z.number(),
      /** The adjusted score out of 100, once complete. With a category left out it is the points earned scaled up from `possible`. */
      total: z.number().nullable(),
      normalized: z.boolean(),
      notApplicable: z.array(z.enum(CATEGORY_IDS)),
    }),
    /** What the officer still owes before completing: a justification, or the evidence the points rest on. */
    noteProblems: z.array(z.object({ category: z.enum(CATEGORY_IDS), message: z.string() })),
    adjustments: z.array(
      z.object({
        criterion: z.string(),
        previousPoints: Points,
        newPoints: Points,
        reason: z.string(),
        by: Person.nullable(),
        at: Timestamp,
      }),
    ),
    /** The claims the specification gives as examples, for the officer to classify. */
    claims: z.array(z.object({ id: z.string(), label: z.string(), evidence: z.string() })),
    verification: z.array(Verification),
    comments: z.array(z.object({ id: z.uuid(), body: z.string(), by: Person.nullable(), at: Timestamp })),
    clarifications: z.array(Clarification),
    recommendation: z
      .object({
        recommendation: z.enum(RECOMMENDATIONS.map((r) => r.id) as [string, ...string[]]),
        label: z.string(),
        suitableOpportunity: z.string().nullable(),
        rationale: z.string(),
        by: Person.nullable(),
        at: Timestamp,
      })
      .nullable(),
    /** Administrators' quality review of the assessment, oldest first. A returned one says what to fix. */
    reviews: z.array(AssessmentReviewEntry),
    completedAt: Timestamp.nullable(),
    completedBy: Person.nullable(),
  })
  .openapi("SummitAssessment");

export const CategoryParam = ApplicationParam.extend({ category: z.enum(CATEGORY_IDS) });
export const ClaimParam = ApplicationParam.extend({ claim: z.string().trim().min(1).max(100).openapi({ example: "annual_revenue" }) });
export const ClarificationParam = ApplicationParam.extend({ clarificationId: z.uuid() });

export const RecordScoresBody = z
  .object({
    scores: z.record(z.string(), z.number()).refine((s) => Object.keys(s).length > 0, "Score at least one criterion").openapi({
      description: "Whole points by criterion ID. A recorded score is written once: changing it later is an adjustment.",
      example: { A1: 4, A2: 5 },
    }),
  })
  .openapi("SummitRecordScoresBody");

export const AdjustScoreBody = z
  .object({
    criterion: z.string().min(1),
    points: z.number(),
    reason: z.string().trim().min(1).max(1000),
  })
  .openapi("SummitAdjustScoreBody");

export const CategoryNoteBody = z
  .object({
    justification: z.string().trim().max(2000),
    evidence: z.array(z.string().trim().min(1).max(500)).max(20),
  })
  .openapi("SummitCategoryNoteBody");

export const ClassifyClaimBody = z
  .object({
    class: z.enum(VERIFICATION_CLASSES),
    documents: z.array(z.uuid()).max(20).default([]).openapi({ description: "Application documents that support the claim." }),
    independentCheck: z.string().trim().max(1000).optional().openapi({
      description: "What was checked outside the application. Independent verification needs it; an uploaded document alone is never enough.",
    }),
  })
  .openapi("SummitClassifyClaimBody");

export const CommentBody = z.object({ body: z.string().trim().min(1).max(4000) }).openapi("SummitCommentBody");

export const StageBody = z.object({ to: z.enum(["under_assessment", "under_verification"]) }).openapi("SummitStageBody");

export const ClarificationBody = z.object({ message: z.string().trim().min(1).max(4000) }).openapi("SummitClarificationBody");

export const RespondBody = z.object({ response: z.string().trim().min(1).max(4000) }).openapi("SummitRespondBody");

export const RecommendationBody = z
  .object({
    recommendation: z.enum(RECOMMENDATIONS.map((r) => r.id) as [string, ...string[]]),
    suitableOpportunity: z.enum(SUITABLE_OPPORTUNITIES.map((o) => o.id) as [string, ...string[]]).optional(),
    rationale: z.string().trim().min(1).max(4000),
  })
  .openapi("SummitRecommendationBody");

// ---- Quality review and the committee ----

const DECISION_IDS = COMMITTEE_DECISIONS.map((d) => d.id) as [string, ...string[]];

export const ReviewBody = z
  .object({
    decision: z.enum(["approve", "return"]),
    reason: z.string().trim().max(2000).optional().openapi({
      description: "Required when returning the assessment: what the officer should fix. Optional when approving.",
    }),
  })
  .openapi("SummitReviewBody");

export const DecisionBody = z
  .object({
    decision: z.enum(DECISION_IDS),
    reason: z.string().trim().min(1).max(4000).openapi({ description: "Why the committee decided this. Recorded with the decision." }),
  })
  .openapi("SummitDecisionBody");

const Decision = z
  .object({
    decision: z.enum(DECISION_IDS),
    label: z.string(),
    reason: z.string(),
    by: Person.nullable(),
    at: Timestamp,
  })
  .openapi("SummitCommitteeDecision");

const CommitteeStatus = z.enum(COMMITTEE_STATUSES);

const boolean = z.enum(["true", "false"]).transform((v) => v === "true");

export const CommitteeQuery = z.object({
  periodId: z.uuid().optional().openapi({ description: "Default: the newest period." }),
  country: z.string().trim().length(2).optional().openapi({ description: "ISO 3166-1 alpha-2 code of the applicant's country." }),
  sector: z.string().trim().min(1).optional().openapi({ description: "Part of the industry or sector the applicant gave, ignoring case." }),
  pathway: Pathway.optional().openapi({ description: "The opportunity type the applicant chose." }),
  recommendation: z.enum(RECOMMENDATIONS.map((r) => r.id) as [string, ...string[]]).optional().openapi({ description: "The officer's recommendation." }),
  status: CommitteeStatus.optional().openapi({ description: "Where the application is: still in committee review, or decided." }),
  minScore: z.coerce.number().min(0).max(100).optional().openapi({ description: "The lowest score out of 100." }),
  maxScore: z.coerce.number().min(0).max(100).optional(),
  minReadiness: z.coerce.number().min(0).max(100).optional().openapi({
    description: "The lowest readiness: the share of the points available in categories E and G that the applicant earned.",
  }),
  womanOwned: boolean.optional(),
  youthOwned: boolean.optional(),
  q: z.string().trim().min(1).optional().openapi({ description: "Part of the business name, application number or SME ID." }),
  sort: z.enum(["rank", "score", "readiness", "name", "country"]).default("rank"),
  limit: z.coerce.number().int().min(1).max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

const CategoryPoints = z.object({
  id: z.enum(CATEGORY_IDS),
  title: z.string(),
  maxPoints: z.number().int(),
  applicable: z.boolean(),
  /** Null until the category is fully scored. */
  points: z.number().int().nullable(),
});

export const CommitteeItem = z
  .object({
    id: z.uuid(),
    number: z.string(),
    organizationName: z.string(),
    smeId: z.string().nullable(),
    country: z.string().nullable(),
    sector: z.string().nullable(),
    pathway: Pathway.nullable(),
    status: CommitteeStatus,
    womanOwned: z.boolean().nullable(),
    youthOwned: z.boolean().nullable(),
    /** The adjusted score out of 100, with any manual adjustments counted. */
    score: z.number().nullable(),
    /** Points earned, and what they were out of (100, less a category that doesn't apply). */
    points: z.number().nullable(),
    possible: z.number(),
    /** Place by score among the period's applications in committee stages. Equal scores share a place. Null without a score. */
    rank: z.number().int().nullable(),
    readiness: z.number().nullable(),
    categories: z.array(CategoryPoints),
    recommendation: z
      .object({ recommendation: z.string(), label: z.string(), suitableOpportunity: z.string().nullable() })
      .nullable(),
    decision: Decision.nullable().openapi({ description: "The committee's latest decision on the application." }),
  })
  .openapi("SummitCommitteeItem");

export const CommitteeList = z
  .object({
    period: z.object({ id: z.uuid(), name: z.string() }).nullable(),
    items: z.array(CommitteeItem),
    /** Applications matching the filters. */
    total: z.number().int(),
    /** Every application in the period by status, whatever the filters. */
    counts: z.record(z.string(), z.number().int()),
  })
  .openapi("SummitCommitteeList");

export const CompareQuery = z.object({
  ids: z
    .string()
    .transform((value) => value.split(",").map((id) => id.trim()).filter(Boolean))
    .pipe(z.array(z.uuid()).min(2).max(5))
    .openapi({ description: "Two to five application IDs, separated by commas.", example: "6f0c…,9a41…" }),
});

export const CompareView = z
  .object({
    items: z.array(
      CommitteeItem.extend({
        profile: z.object({
          annualRevenue: z.object({ amount: z.number(), currency: z.string() }).nullable(),
          employees: z.number().nullable(),
          commercialAsk: z.string().nullable(),
        }),
        rationale: z.string().nullable().openapi({ description: "Why the officer made the recommendation." }),
        verification: z.array(z.object({ claim: z.string(), label: z.string().nullable(), class: z.enum(VERIFICATION_CLASSES) })),
        adjustments: z.number().int().openapi({ description: "Manual score adjustments." }),
      }),
    ),
  })
  .openapi("SummitCompare");

export type CommitteeListView = z.infer<typeof CommitteeList>;
export type CommitteeItemView = z.infer<typeof CommitteeItem>;
export type CompareViewType = z.infer<typeof CompareView>;

export type PeriodView = z.infer<typeof Period>;
export type FormView = z.infer<typeof Form>;
export type ApplicationDetailView = z.infer<typeof ApplicationDetail>;
export type ApplicationSummaryView = z.infer<typeof ApplicationSummary>;
export type ApplicationListView = z.infer<typeof ApplicationList>;
export type OfficerListView = z.infer<typeof OfficerList>;
export type AssessmentViewType = z.infer<typeof AssessmentView>;
export type ClarificationView = z.infer<typeof Clarification>;
