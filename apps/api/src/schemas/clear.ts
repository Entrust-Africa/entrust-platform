import { z } from "@hono/zod-openapi";
import { schema } from "@entrust/db";
import { CLOCK_INPUT_KEYS, EVIDENCE_STATUSES, RECORDED_STATUSES } from "@entrust/gate-engine";

// What the CLEAR case endpoints take and give. The services build these shapes, so the OpenAPI
// document, the typed client and the code can't drift apart.

const Phase = z.number().int().min(1).max(7);
const Owner = z.enum(["sme", "entrust", "system", "buyer", "bank", "authority"]);
const Role = z.enum(["owner", "member", "admin", "facilitator", "reviewer"]);
const StepIdPattern = /^STEP-\d{3}$/;

export const CaseStatus = z.enum(schema.CASE_STATUSES);
export const StepId = z.string().regex(StepIdPattern).openapi({ example: "STEP-048" });
const Timestamp = z.string().openapi({ description: "ISO 8601 timestamp", example: "2026-10-23T09:30:00.000Z" });

export const Source = z
  .object({ title: z.string(), url: z.string().optional(), note: z.string().optional() })
  .openapi("Source");

// ---- Facts ----

const FactValue = z.union([z.string(), z.array(z.string())]);

export const Facts = z
  .record(z.string(), FactValue)
  .openapi("Facts", {
    description:
      "Case facts by key: product, destinationCountry, transportMode, coldChain, paymentTerms (a list), incoterm, sourcingChannel, phytoCertificateRequired, healthCertificateRequired, customsChannel.",
    example: { product: "green_coffee", destinationCountry: "US", paymentTerms: ["advance_tt", "cad"] },
  });

// ---- Workflow state, as the GATE engine evaluates it ----

const NextAction = z
  .object({
    stepId: z.string(),
    kind: z.enum(["resolve_exception", "determine", "provide_evidence", "review_evidence", "complete", "sign_off"]),
    owner: Owner,
    detail: z.string(),
  })
  .openapi("NextAction");

const EvidenceCheck = z
  .object({
    type: z.string(),
    status: z.enum(EVIDENCE_STATUSES),
    satisfied: z.boolean(),
    requiredIf: z.string().nullable(),
  })
  .openapi("EvidenceCheck");

const StepState = z
  .object({
    id: z.string(),
    phase: Phase,
    name: z.string(),
    class: z.enum(["mandatory", "conditional", "exception"]),
    milestone: z.boolean(),
    owner: Owner,
    applicability: z.enum(["applicable", "not_applicable", "undetermined"]),
    status: z.enum([...RECORDED_STATUSES, "undetermined"]),
    reason: z.string().nullable(),
    derived: z.boolean(),
    blockedBy: z.array(z.string()),
    evidence: z.array(EvidenceCheck),
    missingEvidence: z.array(z.string()),
    canComplete: z.boolean(),
    warnings: z.array(z.string()),
  })
  .openapi("StepState");

const PhaseGate = z
  .object({
    phase: Phase,
    milestoneStep: z.string(),
    status: z.enum(["locked", "ready", "open"]),
    outstanding: z.array(z.object({ stepId: z.string(), reason: z.string() })),
  })
  .openapi("PhaseGate");

const Workflow = z
  .object({
    steps: z.array(StepState),
    phases: z.array(PhaseGate),
    nextAction: NextAction.nullable(),
    warnings: z.array(z.string()),
  })
  .openapi("Workflow");

const DueDate = z.union([z.object({ day: z.string() }), z.object({ at: z.string() })]);

const DeadlineClock = z
  .object({
    id: z.enum(["permit_validity", "fx_repatriation", "lc_presentation", "isf_filing", "prior_notice"]),
    label: z.string(),
    stepId: z.string(),
    state: z.enum(["not_applicable", "undetermined", "waiting", "running", "overdue", "met", "met_late"]),
    startedAt: Timestamp.nullable(),
    due: DueDate.nullable(),
    opensAt: Timestamp.nullable(),
    closedAt: Timestamp.nullable(),
    alerts: z.array(z.object({ key: z.string(), kind: z.enum(["warning", "overdue"]), at: Timestamp })),
    notes: z.array(z.string()),
    clause: z.string(),
    source: Source,
  })
  .openapi("DeadlineClock");

const EvidenceItem = z
  .object({
    id: z.uuid(),
    type: z.string(),
    typeName: z.string(),
    /** Approved evidence past its valid-until day is reported as expired. */
    status: z.enum(EVIDENCE_STATUSES),
    issuedOn: z.string().nullable(),
    validUntil: z.string().nullable(),
    /** True for the submission that currently decides its type's status. */
    latest: z.boolean(),
    submittedAt: Timestamp,
    submittedByUserId: z.string().nullable(),
    reviewerUserId: z.string().nullable(),
    reviewedAt: Timestamp.nullable(),
    reviewNote: z.string().nullable(),
  })
  .openapi("EvidenceItem");

// ---- Cases ----

export const CaseSummary = z
  .object({
    id: z.uuid(),
    reference: z.string().openapi({ example: "CLR-ET-2026-000145" }),
    organizationId: z.string(),
    organizationName: z.string(),
    product: z.string(),
    destinationCountry: z.string(),
    status: CaseStatus,
    currentPhase: Phase,
    nextAction: NextAction.nullable(),
    createdAt: Timestamp,
    updatedAt: Timestamp,
  })
  .openapi("CaseSummary");

export const CaseDetail = CaseSummary.extend({
  facts: Facts,
  /** The caller's role on this case, which decides what they can change. */
  yourRole: Role,
  workflow: Workflow,
  evidence: z.array(EvidenceItem),
  deadlines: z.array(DeadlineClock),
}).openapi("CaseDetail");

const CadCap = z
  .object({
    withinCap: z.boolean(),
    capUsd: z.number(),
    excessUsd: z.number(),
    message: z.string(),
    clause: z.string(),
    source: Source,
  })
  .openapi("CadCapCheck");

export const CaseCreated = CaseDetail.extend({
  /** Set when the request gave the amount to be paid by cash against documents. */
  cadCap: CadCap.nullable(),
}).openapi("CaseCreated");

export const CaseList = z
  .object({ items: z.array(CaseSummary), total: z.number().int() })
  .openapi("CaseList");

// ---- Requests ----

export const CaseIdParam = z.object({ id: z.uuid() });
export const StepParam = CaseIdParam.extend({ stepId: StepId });
export const EvidenceParam = CaseIdParam.extend({ evidenceId: z.uuid() });

export const CreateCaseBody = z
  .object({
    organizationId: z
      .string()
      .optional()
      .openapi({ description: "The SME organisation. Defaults to the caller's active organisation." }),
    facts: Facts.openapi({ description: "At least product and destinationCountry." }),
    cadAmountUsd: z
      .number()
      .min(0)
      .optional()
      .openapi({
        description:
          "The part of the permit value to be paid by cash against documents, in USD. Checked against the NBE cap of USD 500,000 per permit.",
      }),
  })
  .openapi("CreateCaseBody");

export const ListCasesQuery = z.object({
  status: CaseStatus.optional(),
  phase: z.coerce.number().int().min(1).max(7).optional(),
  organizationId: z.string().optional().openapi({ description: "Entrust staff only: narrow to one organisation." }),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const UpdateFactsBody = z
  .object({
    facts: z
      .record(z.string(), z.union([FactValue, z.null()]))
      .openapi({ description: "Facts to set. A null value clears the fact. Facts not listed are left alone." }),
  })
  .openapi("UpdateFactsBody");

export const StepTransitionBody = z
  .object({
    to: z.enum(RECORDED_STATUSES),
    reason: z
      .string()
      .optional()
      .openapi({ description: "Required to mark a step not applicable, reopen it or unlock a gate." }),
    occurredAt: z.string().optional().openapi({
      description:
        "When completing: the date the thing happened (an ISO date, or a timestamp with an offset). Required for the steps that start a deadline clock. Defaults to now.",
      example: "2026-10-01",
    }),
  })
  .openapi("StepTransitionBody");

export const SubmitEvidenceBody = z
  .object({
    type: z.string().openapi({ example: "bank_export_permit" }),
    issuedOn: z.iso.date().optional().openapi({ description: "The issue date on the document." }),
  })
  .openapi("SubmitEvidenceBody");

export const ReviewEvidenceBody = z
  .object({
    to: z.enum(EVIDENCE_STATUSES),
    note: z.string().optional().openapi({ description: "Required to request changes or reject: what is wrong." }),
    issuedOn: z.iso.date().optional().openapi({ description: "Records or corrects the document's issue date." }),
  })
  .openapi("ReviewEvidenceBody");

export const ClockInputBody = z
  .object({
    key: z.enum(CLOCK_INPUT_KEYS),
    value: z.string().openapi({
      description:
        "A date, or a timestamp with an offset, for the dates; \"ace\" or \"pnsi\" for priorNoticeSystem.",
      example: "2026-11-10T09:00:00+03:00",
    }),
  })
  .openapi("ClockInputBody");

export type CaseSummaryView = z.infer<typeof CaseSummary>;
export type CaseDetailView = z.infer<typeof CaseDetail>;
export type CaseCreatedView = z.infer<typeof CaseCreated>;
export type CaseListView = z.infer<typeof CaseList>;
