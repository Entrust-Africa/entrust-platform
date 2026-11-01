import { z } from "@hono/zod-openapi";
import { schema } from "@entrust/db";
import { DOCUMENT_FIELD_KEYS } from "@entrust/rules";
import {
  CLOCK_INPUT_KEYS,
  COFFEE_TYPES,
  EVIDENCE_STATUSES,
  MAX_PRICE_ROWS,
  PRICE_UNITS,
  RECORDED_STATUSES,
} from "@entrust/gate-engine";

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
      "Case facts by key: product, destinationCountry, transportMode, coldChain, paymentTerms (a list), incoterm, sourcingChannel, phytoCertificateRequired, healthCertificateRequired, customsChannel, inlandTransport.",
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

const StepStatus = z.enum([...RECORDED_STATUSES, "undetermined"]);

const StepState = z
  .object({
    id: z.string(),
    phase: Phase,
    name: z.string(),
    class: z.enum(["mandatory", "conditional", "exception"]),
    milestone: z.boolean(),
    owner: Owner,
    applicability: z.enum(["applicable", "not_applicable", "undetermined"]),
    status: StepStatus,
    reason: z.string().nullable(),
    derived: z.boolean(),
    blockedBy: z.array(z.string()),
    /** Failure rules whose open flags hold this step. */
    heldBy: z.array(z.string()),
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

const Flag = z
  .object({
    id: z.uuid(),
    rule: z.string().openapi({ example: "FL-02" }),
    name: z.string(),
    severity: z.enum(["critical", "high", "medium"]),
    /** Open flags hold the steps they list; waived ones are accepted by Entrust and hold nothing. */
    status: z.enum(schema.FLAG_STATUSES),
    message: z.string(),
    blocks: z.array(z.string()),
    /** Exception steps raised on the case with this flag. */
    raises: z.array(z.string()),
    raisedAt: Timestamp,
    waivedAt: Timestamp.nullable(),
    waivedByUserId: z.string().nullable(),
    waiveReason: z.string().nullable(),
    resolvedAt: Timestamp.nullable(),
  })
  .openapi("Flag");

// ---- Contract and minimum export prices ----

const CoffeeType = z.enum(COFFEE_TYPES);
const PriceUnit = z.enum(PRICE_UNITS);

const Contract = z
  .object({
    number: z.string(),
    buyerName: z.string(),
    contractDate: z.string().openapi({ example: "2026-10-22" }),
    unitPrice: z
      .object({ amount: z.number(), currency: z.string().openapi({ example: "USD" }), per: PriceUnit })
      .nullable(),
    coffeeType: CoffeeType.nullable(),
    grade: z.string().nullable(),
    origin: z.string().nullable(),
  })
  .openapi("Contract");

const MinimumPrice = z
  .object({
    id: z.uuid(),
    tableId: z.uuid(),
    effectiveFrom: z.string().openapi({ example: "2026-10-20" }),
    effectiveTo: z.string().openapi({ example: "2026-10-26" }),
    coffeeType: CoffeeType,
    grade: z.string().openapi({ example: "1" }),
    /** Null applies to every origin. */
    origin: z.string().nullable(),
    currency: z.string().openapi({ example: "USD" }),
    unit: PriceUnit,
    minPrice: z.number().openapi({ example: 6.61 }),
  })
  .openapi("MinimumPrice");

const MinimumPriceCheck = z
  .object({
    /**
     * waiting: the contract's price, coffee type or grade isn't recorded yet. no_price: no table has
     * a price for the contract date, so STEP-024 stays open. not_comparable: different currencies.
     * met: at or above the minimum. below: under the minimum, which raises FL-03.
     */
    status: z.enum(["waiting", "no_price", "not_comparable", "met", "below"]),
    message: z.string(),
    /** The minimum export price in force on the contract date, when a table gives one. */
    minimum: MinimumPrice.nullable(),
    /** The contract price in the minimum's unit, when the two could be compared. */
    contractPrice: z.number().nullable(),
  })
  .openapi("MinimumPriceCheck");

const PriceTableSummary = z
  .object({
    id: z.uuid(),
    source: z.enum(schema.PRICE_TABLE_SOURCES),
    label: z.string().nullable(),
    createdAt: Timestamp,
    createdByUserId: z.string().nullable(),
    priceCount: z.number().int(),
    effectiveFrom: z.string().nullable(),
    effectiveTo: z.string().nullable(),
  })
  .openapi("PriceTableSummary");

const PriceTableDetail = PriceTableSummary.extend({ prices: z.array(MinimumPrice) }).openapi("PriceTable");

export const PriceTableCreated = PriceTableDetail.extend({
  /** Open cases whose contract the new prices cover, which were checked again. */
  casesRechecked: z.number().int(),
}).openapi("PriceTableCreated");

export const PriceTableList = z.object({ items: z.array(PriceTableSummary) }).openapi("PriceTableList");
export { PriceTableDetail };

// ---- Shipping documents ----

const DocumentFieldKey = z.enum(DOCUMENT_FIELD_KEYS);
const DocumentRole = z.enum(["shipping", "reference"]);

const ReconciliationMismatch = z
  .object({
    field: DocumentFieldKey,
    label: z.string(),
    /** differs: the documents give different values. outside_tolerance: quantities too far apart. rule: a bank-side rule is broken. */
    kind: z.enum(["differs", "outside_tolerance", "rule"]),
    documents: z.array(z.object({ document: z.string(), name: z.string(), value: z.string() })),
    message: z.string(),
  })
  .openapi("ReconciliationMismatch");

const Reconciliation = z
  .object({
    /**
     * waiting: documents or fields are still to be entered. mismatch: at least one difference,
     * which raises FL-06. clear: all entered and in agreement, which completes STEP-099.
     */
    status: z.enum(["waiting", "mismatch", "clear"]),
    message: z.string(),
    mismatches: z.array(ReconciliationMismatch),
    /** Documents the case needs that aren't complete. */
    missing: z.array(
      z.object({
        document: z.string(),
        name: z.string(),
        /** True when nothing has been entered from it. */
        empty: z.boolean(),
        fields: z.array(DocumentFieldKey),
      }),
    ),
    /** How many fields were compared, because two or more documents carry them. */
    compared: z.number().int(),
    /** The quantity tolerance in use (UCP 600 Art. 30) and where it comes from. */
    tolerance: z.object({ percent: z.number(), basis: z.string() }),
    /** Things left out of the comparison, such as quantities in different units. */
    notes: z.array(z.string()),
  })
  .openapi("Reconciliation");

const CaseDocument = z
  .object({
    /** The evidence type id of the document. */
    document: z.string().openapi({ example: "final_commercial_invoice" }),
    name: z.string(),
    role: DocumentRole,
    /** Whether this case needs the document in the comparison. */
    required: z.boolean(),
    /** What has been entered from it, by field key. */
    fields: z.record(z.string(), z.string()),
  })
  .openapi("CaseDocument");

export const DocumentCatalogue = z
  .object({
    fields: z.array(
      z.object({
        key: DocumentFieldKey,
        /** Its place in the 24 points, or null for the quantity tolerance the letter of credit states. */
        number: z.number().int().nullable(),
        label: z.string(),
        help: z.string(),
        kind: z.string(),
        /** The quantity tolerance applies when the field is compared. */
        tolerance: z.boolean(),
      }),
    ),
    documents: z.array(
      z.object({
        document: z.string(),
        name: z.string(),
        role: DocumentRole,
        requiredWhen: z.string().nullable(),
        /** The fields the document may carry. A field it doesn't show is left blank. */
        fields: z.array(DocumentFieldKey),
        requires: z.array(z.object({ fields: z.array(DocumentFieldKey), when: z.string().nullable() })),
      }),
    ),
  })
  .openapi("DocumentCatalogue");

// ---- Amendments ----

const Amendment = z
  .object({
    /** The case's version after this amendment. Version 1 is the case as it was first recorded. */
    version: z.number().int().openapi({ example: 2 }),
    reason: z.string(),
    /** The fields it changed. */
    changes: z.array(
      z.object({
        field: z.string().openapi({ example: "contract.unitPrice" }),
        label: z.string(),
        before: z.unknown(),
        after: z.unknown(),
      }),
    ),
    /** Steps that depend on what changed and still apply. */
    affectedSteps: z.array(z.string()),
    /** Completed steps that were reopened. */
    reopenedSteps: z.array(z.string()),
    /** Everything to be done again for the amendment to be complete: reopened steps, steps it made applicable, reopened gates. */
    reverifySteps: z.array(z.string()),
    /** Evidence types that were approved and went back for review. Other evidence stayed approved. */
    evidenceSentBack: z.array(z.string()),
    /** Milestone sign-offs that were reopened. */
    reopenedGates: z.array(z.string()),
    madeByUserId: z.string().nullable(),
    madeAt: Timestamp,
    resolvedAt: Timestamp.nullable(),
    status: z.enum(["pending", "complete"]),
  })
  .openapi("Amendment");

// ---- Rule packs ----

const PackRequirement = z
  .object({
    code: z.string().openapi({ example: "USP-04" }),
    name: z.string(),
    description: z.string(),
    /** What has to be done. */
    action: z.string(),
    whyItMatters: z.string(),
    responsible: z.string(),
    /** When it comes due. */
    trigger: z.string(),
    /** What shows it is done, in words. */
    evidence: z.string(),
    /** ISO country code of the country whose rule it is (EU for EU law, GCC for Gulf Cooperation Council law); null for a transaction term. */
    jurisdiction: z.string().nullable(),
    authority: z.string(),
    /**
     * confirmed and conditional requirements are requirements of law and cite an official source.
     * awaiting_verification: not established yet, never presented as law. transaction: from the
     * deal's terms or the way it is carried out.
     */
    basis: z.enum(["confirmed", "conditional", "awaiting_verification", "transaction"]),
    /** When it applies, if not always. */
    appliesWhen: z.string().nullable(),
    verification: z
      .object({
        /** verified: approved by Entrust. source_checked: the sources were read. awaiting_verification: the note says what is open. */
        status: z.enum(["verified", "source_checked", "awaiting_verification"]),
        /** The day its sources were last read. */
        checkedOn: z.string().openapi({ example: "2026-10-24" }),
        note: z.string(),
      })
      .openapi("RequirementVerification"),
    sources: z.array(Source),
    /** The canonical steps where the work is done. */
    steps: z.array(z.string()),
  })
  .openapi("PackRequirement");

const RulePackSummary = z
  .object({
    id: z.string().openapi({ example: "et-us-green-coffee" }),
    version: z.string().openapi({ example: "0.4.0" }),
    name: z.string(),
    /** The cases it covers: Ethiopian exports of these products to these countries. */
    corridor: z.object({ products: z.array(z.string()), destinations: z.array(z.string()) }),
    route: z.string(),
    /** draft until Entrust approves it. */
    status: z.enum(["draft", "approved"]),
    /** The day the sources were last checked for this version. */
    checkedOn: z.string(),
    /** What this version changed from the one before. */
    changes: z.string(),
    notes: z.array(z.string()),
    /** True for the newest version of its pack, which new cases get. */
    latest: z.boolean(),
  })
  .openapi("RulePackSummary");

export const RulePackDetail = RulePackSummary.extend({ requirements: z.array(PackRequirement) }).openapi("RulePack");
export const RulePackList = z.object({ items: z.array(RulePackSummary) }).openapi("RulePackList");

const CaseRequirement = PackRequirement.extend({
  /**
   * not_applicable: its condition doesn't hold or none of its steps apply. undetermined: it depends
   * on a fact not recorded yet. blocked: its remaining steps wait on others. open: some of its work
   * can be done now. met: every step of it that applies is completed.
   */
  status: z.enum(["not_applicable", "undetermined", "blocked", "open", "met"]),
  reason: z.string().nullable(),
  steps: z.array(z.object({ id: z.string(), status: StepStatus })),
}).openapi("CaseRequirement");

const CaseRulePack = RulePackSummary.extend({
  /** False once the case's product or destination has changed so that the pack no longer covers it. */
  coversCase: z.boolean(),
  requirements: z.array(CaseRequirement),
}).openapi("CaseRulePack");

const RulePackUpdate = z
  .object({
    /** The pack the case would move to. Null when no pack covers the case any more. */
    id: z.string().nullable(),
    version: z.string().nullable(),
    /** Requirement codes the move adds, removes or changes. */
    added: z.array(z.string()),
    removed: z.array(z.string()),
    changed: z.array(z.string()),
  })
  .openapi("RulePackUpdate");

// ---- Cases ----

export const CaseSummary = z
  .object({
    id: z.uuid(),
    reference: z.string().openapi({ example: "CLR-ET-2026-000145" }),
    /** Set on a practice case (TRADE's M08), which is simulated: the scenario it was started from. Null on a real case. */
    practiceScenario: z.string().nullable().openapi({ example: null }),
    organizationId: z.string(),
    organizationName: z.string(),
    product: z.string(),
    destinationCountry: z.string(),
    status: CaseStatus,
    currentPhase: Phase,
    nextAction: NextAction.nullable(),
    /** Flags holding steps right now. */
    openFlags: z.number().int(),
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
  /** Every flag the case has had, newest first. */
  flags: z.array(Flag),
  /** The sales contract, once recorded. */
  contract: Contract.nullable(),
  /** The contract price against ECTA's minimum export price. Null where STEP-024 doesn't apply (not coffee). */
  minimumPrice: MinimumPriceCheck.nullable(),
  /** The documents in the shipping document comparison, with what has been entered from each. */
  documents: z.array(CaseDocument),
  /** The documents compared (STEP-099). Null when a person marked that step not applicable. */
  reconciliation: Reconciliation.nullable(),
  /** 1 until the case is amended; each amendment after a gate is signed is the next version. */
  version: z.number().int(),
  /** Every amendment, newest first. */
  amendments: z.array(Amendment),
  /**
   * The rule pack version the case was opened with, or moved to on purpose, with each requirement's
   * status on the case. Null when no pack covered its product and destination.
   */
  rulePack: CaseRulePack.nullable(),
  /** What re-evaluating the case's rule pack would move it to. Null when it is on the newest pack for its corridor. */
  rulePackUpdate: RulePackUpdate.nullable(),
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
export const FlagParam = CaseIdParam.extend({ flagId: z.uuid() });

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

export const WaiveFlagBody = z
  .object({ reason: z.string().min(1).openapi({ description: "Why the situation is accepted. Kept with the flag and in the audit log." }) })
  .openapi("WaiveFlagBody");

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

const PriceRowInput = z.object({
  effectiveFrom: z.string().openapi({ example: "2026-10-20" }),
  effectiveTo: z.string().openapi({ example: "2026-10-26" }),
  coffeeType: z.string().openapi({ description: "washed or unwashed", example: "washed" }),
  grade: z.string().openapi({ example: "1" }),
  origin: z.string().nullable().optional().openapi({ description: "Leave out to apply to every origin.", example: "Yirgacheffe" }),
  unit: z.string().openapi({ description: "Currency and unit: USD/kg or USD/lb (USD/mt also works).", example: "USD/kg" }),
  minPrice: z.union([z.number(), z.string()]).openapi({ description: "At most 4 decimals.", example: 6.61 }),
});

export const RecordPriceTableBody = z
  .object({
    label: z.string().optional().openapi({ description: "A note kept with the table, such as the week it is for." }),
    prices: z.array(PriceRowInput).max(MAX_PRICE_ROWS),
  })
  .openapi("RecordPriceTableBody");

export const UploadPriceCsvBody = z
  .object({
    csv: z.string().openapi({
      description:
        "The text of a CSV file with the header effective_from,effective_to,coffee_type,grade,origin,unit,min_price (origin is optional, columns can be in any order) and one row per price.",
      example: "effective_from,effective_to,coffee_type,grade,origin,unit,min_price\n2026-10-20,2026-10-26,washed,1,Yirgacheffe,USD/kg,6.61",
    }),
    label: z.string().optional().openapi({ description: "A note kept with the table, such as the file name." }),
  })
  .openapi("UploadPriceCsvBody");

export const AmendCaseBody = z
  .object({
    reason: z.string().openapi({ description: "Why the case is amended. Kept with the amendment and in the audit log.", example: "The buyer raised the price in writing" }),
    facts: z
      .record(z.string(), z.union([FactValue, z.null()]))
      .optional()
      .openapi({ description: "Facts to set; a null value clears one." }),
    contract: z
      .object({
        number: z.string().optional(),
        buyerName: z.string().optional(),
        contractDate: z.iso.date().optional(),
        unitPrice: z
          .object({ amount: z.number().positive(), currency: z.string().regex(/^[A-Za-z]{3}$/), per: PriceUnit })
          .nullable()
          .optional(),
        coffeeType: CoffeeType.nullable().optional(),
        grade: z.string().max(20).nullable().optional(),
        origin: z.string().nullable().optional(),
      })
      .optional()
      .openapi({ description: "Contract terms to change. Anything left out keeps its value." }),
    lc: z
      .object({
        expiry: z.string().optional().openapi({ description: "A date, or a timestamp with an offset.", example: "2026-12-31" }),
        quantityTolerance: z.string().nullable().optional(),
        reference: z.string().nullable().optional(),
      })
      .optional()
      .openapi({ description: "Letter of credit terms to change. Anything left out keeps its value." }),
  })
  .openapi("AmendCaseBody");

export const PriceTableParam = z.object({ id: z.uuid() });
export const RulePackParam = z.object({ id: z.string(), version: z.string() });

export const ReevaluateRulePackBody = z
  .object({
    reason: z.string().openapi({ description: "Why the case moves to another version. Kept in the audit log.", example: "Sources re-checked after the US tariff change" }),
  })
  .openapi("ReevaluateRulePackBody");
export const DocumentParam = CaseIdParam.extend({
  document: z.string().openapi({ description: "The document's evidence type id.", example: "final_commercial_invoice" }),
});

export const DocumentFieldsBody = z
  .object({
    fields: z.record(z.string(), z.union([z.string(), z.null()])).openapi({
      description:
        "Field keys and what the document says. A null or blank value clears the field. Fields not listed are left alone. Leave blank what the document doesn't show.",
      example: { quantity: "19200 kg", totalValue: "130560.00", currency: "USD" },
    }),
  })
  .openapi("DocumentFieldsBody");

export const RecordContractBody = z
  .object({
    number: z.string().openapi({ description: "The contract or purchase order number.", example: "PO-2026-114" }),
    buyerName: z.string(),
    contractDate: z.iso.date().openapi({ description: "The minimum export price in force on this day applies." }),
    unitPrice: z
      .object({
        amount: z.number().positive().openapi({ example: 6.8 }),
        currency: z.string().regex(/^[A-Za-z]{3}$/).openapi({ example: "USD" }),
        per: PriceUnit,
      })
      .nullable()
      .optional(),
    coffeeType: CoffeeType.nullable().optional(),
    grade: z.string().max(20).nullable().optional().openapi({ example: "1" }),
    origin: z.string().nullable().optional().openapi({ example: "Yirgacheffe" }),
  })
  .openapi("RecordContractBody", {
    description:
      "Replaces the case's contract terms: anything left out is cleared. The minimum export price check needs the unit price, coffee type and grade.",
  });

export type CaseSummaryView = z.infer<typeof CaseSummary>;
export type CaseDetailView = z.infer<typeof CaseDetail>;
export type CaseCreatedView = z.infer<typeof CaseCreated>;
export type CaseListView = z.infer<typeof CaseList>;
export type ContractView = z.infer<typeof Contract>;
export type MinimumPriceCheckView = z.infer<typeof MinimumPriceCheck>;
export type PriceTableSummaryView = z.infer<typeof PriceTableSummary>;
export type PriceTableDetailView = z.infer<typeof PriceTableDetail>;
export type PriceTableCreatedView = z.infer<typeof PriceTableCreated>;
export type ReconciliationView = z.infer<typeof Reconciliation>;
export type CaseDocumentView = z.infer<typeof CaseDocument>;
export type DocumentCatalogueView = z.infer<typeof DocumentCatalogue>;
export type AmendmentView = z.infer<typeof Amendment>;
export type RulePackSummaryView = z.infer<typeof RulePackSummary>;
export type RulePackDetailView = z.infer<typeof RulePackDetail>;
export type CaseRulePackView = z.infer<typeof CaseRulePack>;
export type RulePackUpdateView = z.infer<typeof RulePackUpdate>;
