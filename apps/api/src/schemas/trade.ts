import { z } from "@hono/zod-openapi";
import { learnerModuleSchema, moduleContentSchema } from "@entrust/trade-content";
import { QUESTION_TYPES } from "@entrust/forms";
import { ASSESSMENT_STATUSES, EVIDENCE_CONFIDENCE, FIELD_KINDS, LEARNING_PLAN_STATUSES, MODULE_STATUSES, SPONSOR_DATA_KINDS } from "@entrust/trade-engine";
import { SPONSOR_ROLES } from "@entrust/roles";
import { MODULE_IDS, PATHWAYS } from "@entrust/trade-rules";
import { CaseIdParam, Facts, Role } from "./clear";

const ModuleSummary = z
  .object({
    id: z.enum(MODULE_IDS).openapi({ example: "M04" }),
    title: z.string(),
    deliverable: z.string(),
    objectives: z.array(z.string()),
    /** ready: an approved version. draft: only drafts, which only Entrust staff see. in_production: no content yet. */
    contentStatus: z.enum(["ready", "draft", "in_production"]),
    /** The newest version the caller can open, or null while the module is in production. */
    latestVersion: z.string().nullable().openapi({ example: "0.1.0" }),
    /** The versions the caller can open, newest first. */
    versions: z.array(z.string()),
  })
  .openapi("TradeModuleSummary");

export const ModuleList = z.object({ items: z.array(ModuleSummary) }).openapi("TradeModuleList");

export const ModuleParam = z.object({ id: z.string().openapi({ example: "M04" }) });
export const ModuleQuery = z.object({
  version: z.string().optional().openapi({ description: "A version to open. Default: the newest the caller can open.", example: "0.1.0" }),
});

export const ModuleDetail = ModuleSummary.extend({
  /**
   * The content of the version, or null while the module is in production. An SME gets the lessons,
   * worksheets, knowledge-check questions without answers, rubric and AI prompts. Entrust staff also
   * get the answer keys and explanations, the auto-check IDs and the staff-only material.
   */
  content: z.union([moduleContentSchema, learnerModuleSchema]).nullable(),
}).openapi("TradeModule");

// ---- Practice cases (M08) ----

export const PracticeScenarioList = z
  .object({
    /** What every screen shows on a practice case. */
    label: z.string().openapi({ example: "Practice. Simulated, not a real export." }),
    scenarios: z.array(
      z.object({
        id: z.string().openapi({ example: "zebu-coffee" }),
        title: z.string(),
        summary: z.string(),
        /** The learner gives the facts, from their own brief, when they start it. */
        ownFacts: z.boolean(),
      }),
    ),
  })
  .openapi("PracticeScenarioList");

export const StartPracticeBody = z
  .object({
    organizationId: z
      .string()
      .optional()
      .openapi({ description: "The SME organisation. Defaults to the caller's active organisation." }),
    scenario: z.string().openapi({ example: "zebu-coffee" }),
    facts: Facts.optional().openapi({
      description: "For a scenario that takes the learner's own deal: at least product and destinationCountry. Leave it out for the others.",
    }),
  })
  .openapi("StartPracticeBody");

export const PracticeListQuery = z.object({
  organizationId: z.string().optional().openapi({ description: "Narrow to one organisation. Default: all the caller's." }),
});

export const PracticeRoleQuery = z.object({
  as: Role.optional().openapi({
    description:
      "The party whose turn the learner takes. A case's steps belong to the SME, to Entrust's reviewers and to banks and authorities, so a learner working alone picks whose they are working. Default: their own role. Entrust staff keep their own.",
    example: "reviewer",
  }),
});

export const PracticeEventParam = CaseIdParam.extend({ eventId: z.string().openapi({ example: "documents-arrive" }) });

export const PracticeEventList = z
  .object({
    items: z.array(
      z.object({
        id: z.string().openapi({ example: "documents-arrive" }),
        title: z.string(),
        /** What the learner is told has happened. */
        story: z.string(),
        /** Whether it has been played on this case. Resetting the case clears it. */
        played: z.boolean(),
      }),
    ),
  })
  .openapi("PracticeEventList");

// ---- Assessments: the onboarding diagnostic and the placement assessment (#57, #78) ----

const FormKind = z.enum(["placement", "diagnostic"]).openapi({ description: "The onboarding diagnostic or the placement assessment." });

export const AssessmentForm = z
  .object({
    kind: FormKind,
    version: z.string().openapi({ example: "1.0.0" }),
    form: z.object({
      id: z.string().openapi({ example: "trade.diagnostic" }),
      version: z.string(),
      title: z.string(),
      /** Names a question's text can hold as {name}. The values are in the assessment's `variables`. */
      variables: z.array(z.string()).optional(),
      sections: z.array(z.object({ id: z.string(), title: z.string(), purpose: z.string().optional(), notes: z.array(z.string()).optional() })),
      questions: z.array(
        z.object({
          id: z.string().openapi({ example: "Q135" }),
          section: z.string(),
          type: z.enum(QUESTION_TYPES),
          text: z.string(),
          help: z.string().optional(),
          group: z.string().optional(),
          options: z.array(z.object({ value: z.string(), label: z.string(), exclusive: z.boolean().optional(), description: z.string().optional() })).optional(),
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
          evidenceBased: z.boolean().optional().openapi({ description: "Ask whether supporting documents are available." }),
          allowNotApplicable: z.boolean().optional().openapi({ description: "Offer \"does not apply to us\", which needs a short reason." }),
        }),
      ),
    }),
  })
  .openapi("TradeAssessmentForm");

export const AssessmentFormQuery = z.object({
  kind: FormKind,
  version: z.string().optional().openapi({ description: "A published version. Default: the newest." }),
});

const ProgressView = z.object({
  total: z.number(),
  answered: z.number(),
  percent: z.number(),
  bySection: z.record(z.string(), z.object({ answered: z.number(), total: z.number() })),
});

const PathwayView = z
  .object({
    pathway: z.enum(PATHWAYS),
    name: z.string().openapi({ example: "Export Entry and Readiness" }),
    status: z.enum(["provisional", "confirmed"]),
    liveOrder: z.boolean(),
    /** Why, in words the SME can read. */
    reasons: z.array(z.string()),
    decidedByStaff: z.boolean(),
    decisionReason: z.string().nullable(),
    rulesVersion: z.string(),
    since: z.iso.datetime(),
  })
  .openapi("TradePathway");

export const AssessmentView = z
  .object({
    id: z.uuid(),
    kind: FormKind,
    status: z.enum(ASSESSMENT_STATUSES),
    templateVersion: z.string(),
    enrollmentId: z.uuid(),
    organizationId: z.string(),
    /** The caller can change the answers: a draft, and a role that may write. */
    canEdit: z.boolean(),
    /** Set when Entrust staff are filling it in for the SME. */
    filledInByStaff: z.object({ userId: z.string(), name: z.string() }).nullable(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
    submittedAt: z.iso.datetime().nullable(),
    /** Fill-ins for {name} in the form's text. */
    variables: z.record(z.string(), z.string()),
    /**
     * The answers by question ID, in the shape a form screen sends them: text for choices (a capability score is
     * "0" to "3"), an array for multiple choice, \{ amount, currency \} for money, \{ notKnown: true \} for "I don't
     * know" and \{ notApplicable: true, reason \} for "does not apply to us".
     */
    answers: z.record(z.string(), z.unknown()),
    /** Questions where the SME says documents are available. */
    documents: z.record(z.string(), z.boolean()),
    /** For each "does not apply" answer, whether staff have approved it. */
    notApplicableApproved: z.record(z.string(), z.boolean()),
    progress: ProgressView,
    /** Answers that aren't valid. */
    errors: z.array(z.string()),
    /** Questions still to answer before the submit. */
    incomplete: z.array(z.string()),
    /** Answers that are valid alone but disagree. They don't stop the submit; they send it to staff review. */
    conflicts: z.array(z.object({ code: z.string(), questions: z.array(z.string()), message: z.string() })),
    reviewReasons: z.array(z.string()),
    /** The diagnostic's result, once it is submitted. */
    pathway: PathwayView.nullable(),
  })
  .openapi("TradeAssessment");
export type AssessmentView = z.infer<typeof AssessmentView>;

export const AssessmentList = z
  .object({
    items: z.array(
      z.object({
        id: z.uuid(),
        kind: FormKind,
        status: z.enum(ASSESSMENT_STATUSES),
        templateVersion: z.string(),
        enrollmentId: z.uuid(),
        organizationId: z.string(),
        organizationName: z.string(),
        cohortName: z.string(),
        updatedAt: z.iso.datetime(),
        submittedAt: z.iso.datetime().nullable(),
        pathway: z.enum(PATHWAYS).nullable(),
        pathwayStatus: z.enum(["provisional", "confirmed"]).nullable(),
      }),
    ),
  })
  .openapi("TradeAssessmentList");

export const AssessmentListQuery = z.object({
  organizationId: z.string().optional().openapi({ description: "Narrow to one organisation. Default: all the caller's." }),
  kind: FormKind.optional(),
});

export const StartAssessmentBody = z
  .object({
    kind: FormKind,
    enrollmentId: z.uuid().optional().openapi({ description: "The enrolment. Default: the organisation's only live enrolment." }),
    organizationId: z.string().optional().openapi({ description: "The SME organisation. Default: the caller's only one." }),
    retake: z.boolean().optional().openapi({ description: "Start again after a submitted assessment. The old one is superseded and keeps its answers." }),
  })
  .openapi("StartTradeAssessmentBody");

export const AssessmentParam = z.object({ id: z.uuid() });
export const AssessmentQuestionParam = z.object({ id: z.uuid(), questionId: z.string().min(1).max(40) });

export const SaveResponsesBody = z
  .object({
    answers: z.record(z.string(), z.unknown().nullable()).optional().openapi({ description: "A value sets an answer and null clears it. Answers not named stay." }),
    documents: z.record(z.string(), z.boolean()).optional().openapi({ description: "For questions that ask: are supporting documents available?" }),
  })
  .openapi("SaveTradeResponsesBody");

export const EnrollmentParam = z.object({ id: z.uuid() });

export const EnrollmentPathway = z.object({ enrollmentId: z.uuid(), pathway: PathwayView.nullable() }).openapi("TradeEnrollmentPathway");

export const SetPathwayBody = z
  .object({
    pathway: z.enum(PATHWAYS),
    reason: z.string().min(1).max(500).openapi({ example: "The shipment record was accepted." }),
  })
  .openapi("SetTradePathwayBody");

// ---- Placement results, learning plan and report (#58) ----

const ReasonView = z.object({ code: z.string(), text: z.string().openapi({ description: "The sentence the SME reads next to the module." }) });
const ContentStatus = z.enum(["ready", "draft", "in_production"]);

const ScoreView = z.object({
  id: z.string().openapi({ example: "financial_records" }),
  title: z.string(),
  /** 0 to 100, or null while too few questions have a valid answer. Missing is never zero. */
  score: z.number().nullable(),
  band: z.string().nullable().openapi({ example: "developing" }),
  bandLabel: z.string().nullable(),
  /** The share of questions with a valid answer, as a whole percent. */
  coverage: z.number(),
  points: z.number(),
  maxPoints: z.number(),
  evidence: z.enum(EVIDENCE_CONFIDENCE),
});

export const PlacementResults = z
  .object({
    assessmentId: z.uuid(),
    /** scored, or review_required while staff have something to look at. */
    status: z.enum(ASSESSMENT_STATUSES),
    rulesVersion: z.string().openapi({ example: "0.2.0" }),
    learningPlanId: z.uuid().nullable(),
    domains: z.array(ScoreView),
    /** The trigger groups the plan is built from, each with the module it points to. */
    groups: z.array(ScoreView.extend({ module: z.enum(MODULE_IDS) })),
  })
  .openapi("TradePlacementResults");
export type PlacementResults = z.infer<typeof PlacementResults>;

export const LearningPlanView = z
  .object({
    id: z.uuid(),
    enrollmentId: z.uuid(),
    organizationId: z.string(),
    assessmentId: z.uuid().nullable(),
    rulesVersion: z.string(),
    pathway: z.enum(PATHWAYS),
    pathwayName: z.string(),
    /** generated or review_required when the engine made it; later states are staff's. */
    status: z.enum(LEARNING_PLAN_STATUSES),
    requiresStaffReview: z.boolean(),
    /** Why staff will look at it, in plain words. */
    reviewNotes: z.array(z.string()),
    createdAt: z.iso.datetime(),
    supersededAt: z.iso.datetime().nullable(),
    modules: z.array(
      z.object({
        sequence: z.number(),
        module: z.enum(MODULE_IDS),
        title: z.string(),
        status: z.enum(MODULE_STATUSES),
        statusLabel: z.string(),
        source: z.enum(["engine", "staff_override"]),
        reasons: z.array(ReasonView),
      }),
    ),
  })
  .openapi("TradeLearningPlan");
export type LearningPlanView = z.infer<typeof LearningPlanView>;

const OptionLabel = z.object({ value: z.string(), label: z.string() });

export const PlacementReportView = z
  .object({
    assessmentId: z.uuid(),
    learningPlanId: z.uuid(),
    report: z.object({
      rulesVersion: z.string(),
      /** superseded once a retake replaces it. It stays readable. */
      status: z.enum(["current", "superseded"]),
      baseline: z.object({
        organisation: z.string(),
        smeId: z.string().openapi({ example: "ET-SME-000001" }),
        assessedOn: z.string().openapi({ example: "2026-11-20" }),
        attempt: z.number(),
      }),
      pathway: z.object({
        id: z.enum(PATHWAYS),
        name: z.string(),
        provisional: z.boolean(),
        liveOrder: z.boolean(),
        reasons: z.array(ReasonView),
      }),
      domains: z.array(
        z.object({
          id: z.string(),
          title: z.string(),
          score: z.number().nullable(),
          band: z.string().nullable(),
          bandLabel: z.string().nullable(),
          guidance: z.string().nullable(),
          coverage: z.number(),
          answered: z.number(),
          total: z.number(),
          evidence: z.enum(EVIDENCE_CONFIDENCE),
          evidenceLabel: z.string(),
        }),
      ),
      plan: z.object({
        modules: z.array(
          z.object({
            sequence: z.number(),
            module: z.enum(MODULE_IDS),
            title: z.string(),
            deliverable: z.string(),
            status: z.enum(MODULE_STATUSES),
            statusLabel: z.string(),
            reasons: z.array(ReasonView),
            contentStatus: ContentStatus,
          }),
        ),
        requiresStaffReview: z.boolean(),
        reviewNotes: z.array(z.string()),
      }),
      objectives: z.object({
        opportunity: OptionLabel.nullable(),
        target: z.object({ status: OptionLabel.nullable(), product: z.string().nullable(), market: z.string().nullable(), buyerType: z.string().nullable() }),
      }),
    }),
  })
  .openapi("TradePlacementReport");
export type PlacementReportView = z.infer<typeof PlacementReportView>;

export const LearningPlanParam = z.object({ id: z.uuid() });

// ---- Worksheets (#64, #65) ----

const WorksheetFieldView = z.object({
  id: z.string(),
  label: z.string(),
  kind: z.enum(FIELD_KINDS),
  required: z.boolean(),
  help: z.string().nullable(),
  options: z.array(z.object({ value: z.string(), label: z.string() })).nullable(),
  /** Shown only while another field holds one of these values. */
  showWhen: z.object({ field: z.string(), in: z.array(z.string()) }).nullable(),
});

const ResultKind = z.enum(["money", "number", "percent", "days", "text"]);

export const WorksheetDefinitionView = z
  .object({
    id: z.string().openapi({ example: "m03-income-statement" }),
    module: z.enum(MODULE_IDS),
    title: z.string(),
    description: z.string(),
    /** Has amounts: opens with a currency and, when it isn't ETB, the rate and its date. */
    money: z.boolean(),
    /** The worksheet that prefills this one when a new draft starts. */
    prefillFrom: z.string().nullable(),
    printable: z.boolean(),
    fields: z.array(WorksheetFieldView),
    tables: z.array(
      z.object({
        id: z.string(),
        label: z.string(),
        columns: z.array(WorksheetFieldView),
        computedColumns: z.array(z.object({ id: z.string(), label: z.string(), kind: ResultKind })),
        minRows: z.number().int().nullable(),
        maxRows: z.number().int().nullable(),
      }),
    ),
    computed: z.array(z.object({ id: z.string(), label: z.string(), kind: ResultKind, etb: z.boolean() })),
    sections: z.array(z.object({ id: z.string(), title: z.string(), description: z.string().nullable(), items: z.array(z.string()) })),
  })
  .openapi("TradeWorksheetDefinition");
export type WorksheetDefinitionView = z.infer<typeof WorksheetDefinitionView>;

export const WorksheetDefinitionList = z.object({ items: z.array(WorksheetDefinitionView) }).openapi("TradeWorksheetDefinitionList");

const ResultValue = z.union([z.number(), z.string(), z.null()]);

const WorksheetResultView = z.object({
  computed: z.record(z.string(), ResultValue),
  /** Per table, one object per row with its computed columns. */
  rows: z.record(z.string(), z.array(z.record(z.string(), ResultValue))),
  /** The ETB equivalents of the money results, when the worksheet isn't in ETB and the rate is entered. */
  etb: z.record(z.string(), z.number().nullable()),
  /** Warnings for the learner, and critical-failure candidates the assessor confirms. Code never decides a failure. */
  flags: z.array(z.object({ code: z.string(), severity: z.enum(["warning", "critical_candidate"]), message: z.string(), fields: z.array(z.string()) })),
  /** Figures that can't be used, against the field. */
  problems: z.array(z.object({ field: z.string(), message: z.string() })),
});

export const WorksheetVersionView = z
  .object({
    id: z.uuid(),
    worksheetId: z.string(),
    module: z.enum(MODULE_IDS),
    title: z.string(),
    /** 1 for the first. A draft has the number its submit will keep. */
    version: z.number().int(),
    status: z.enum(["draft", "submitted"]),
    enrollmentId: z.uuid(),
    organizationId: z.string(),
    /** The caller can change the values: a member of the SME's organisation, on a draft. */
    canEdit: z.boolean(),
    /** Always self-reported until staff review the figures. */
    confidence: z.enum(EVIDENCE_CONFIDENCE),
    confidenceLabel: z.string(),
    /** The values entered: a scalar for each field, a list of rows for each table. */
    values: z.record(z.string(), z.unknown()),
    /** Worked out live for a draft. For a submitted version, what it worked out at submit. */
    result: WorksheetResultView,
    basedOn: z.object({ id: z.uuid(), version: z.number().int() }).nullable().openapi({ description: "The submitted version this draft was started from." }),
    prefilledFrom: z.object({ id: z.uuid(), worksheetId: z.string(), title: z.string(), version: z.number().int() }).nullable(),
    /** The financial worksheets say so: nothing is sent to MIZAN yet, but the figures are kept as structured data it can read. */
    mizan: z.object({ connected: z.boolean(), message: z.string() }).nullable(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
    submittedAt: z.iso.datetime().nullable(),
  })
  .openapi("TradeWorksheetVersion");
export type WorksheetVersionView = z.infer<typeof WorksheetVersionView>;

export const WorksheetVersionList = z
  .object({
    worksheetId: z.string(),
    items: z.array(z.object({ id: z.uuid(), version: z.number().int(), status: z.enum(["draft", "submitted"]), updatedAt: z.iso.datetime(), submittedAt: z.iso.datetime().nullable() })),
  })
  .openapi("TradeWorksheetVersionList");

export const WorksheetSummaryList = z
  .object({
    enrollmentId: z.uuid(),
    items: z.array(
      z.object({
        id: z.string(),
        module: z.enum(MODULE_IDS),
        title: z.string(),
        description: z.string(),
        /** The newest submitted version. */
        latest: z.object({ id: z.uuid(), version: z.number().int(), submittedAt: z.iso.datetime() }).nullable(),
        draft: z.object({ id: z.uuid(), version: z.number().int(), updatedAt: z.iso.datetime() }).nullable(),
      }),
    ),
  })
  .openapi("TradeWorksheetSummaryList");

export const WorksheetParam = z.object({ id: z.string().min(1).max(80) });
export const WorksheetVersionParam = z.object({ id: z.uuid() });
export const WorksheetQuery = z.object({
  enrollmentId: z.uuid().optional().openapi({ description: "The enrolment. Default: the organisation's only live enrolment." }),
  organizationId: z.string().optional().openapi({ description: "The SME organisation. Default: the caller's only one." }),
});

export const SaveWorksheetBody = z
  .object({
    values: z.record(z.string(), z.unknown().nullable()).openapi({
      description: "A value sets a field, null clears it, and fields not named stay. A table's value is its whole list of rows. Amounts are numbers in the worksheet's currency, dates are YYYY-MM-DD, a checkbox is true or false.",
    }),
  })
  .openapi("SaveTradeWorksheetBody");

// ---- Sponsors and consent (#70) ----

const SponsorMember = z.object({ userId: z.string(), name: z.string(), email: z.string(), role: z.string() });

export const SponsorView = z
  .object({ id: z.string(), name: z.string(), slug: z.string(), members: z.array(SponsorMember) })
  .openapi("TradeSponsor");
export const SponsorList = z.object({ items: z.array(SponsorView) }).openapi("TradeSponsorList");

export const CreateSponsorBody = z
  .object({
    name: z.string().trim().min(1).max(160).openapi({ example: "Zemen Bank" }),
    slug: z
      .string()
      .trim()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Lowercase letters, numbers and hyphens only.")
      .max(80)
      .openapi({ example: "zemen-bank" }),
    adminEmail: z.email().optional().openapi({ description: "The first administrator: someone who already has an account." }),
  })
  .openapi("CreateTradeSponsorBody");

export const SponsorParam = z.object({ id: z.string().min(1).max(100) });
export const SponsorMemberParam = z.object({ id: z.string().min(1).max(100), userId: z.string().min(1).max(100) });
export const AddSponsorMemberBody = z
  .object({ email: z.email(), role: z.enum(SPONSOR_ROLES) })
  .openapi("AddTradeSponsorMemberBody");

const DataKind = z.enum(SPONSOR_DATA_KINDS);
const CohortFigures = z.object({
  enrolled: z.number(),
  byStatus: z.record(z.string(), z.number()),
  diagnosticsSubmitted: z.number(),
  pathwayA: z.number(),
  pathwayB: z.number(),
});
const SponsorCohort = z.object({
  id: z.uuid(),
  name: z.string(),
  program: z.string(),
  country: z.string(),
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
  sponsor: z.object({ id: z.string(), name: z.string() }),
  /** Counts with no names. */
  figures: CohortFigures,
});

export const SponsorCohortList = z
  .object({ disclaimer: z.string(), items: z.array(SponsorCohort) })
  .openapi("TradeSponsorCohortList");

export const SponsorCohortDetail = SponsorCohort.extend({
  disclaimer: z.string(),
  /** The SMEs whose owners agreed to share something with this sponsor, and what. */
  consenting: z.array(z.object({ organizationId: z.string(), name: z.string(), smeId: z.string().nullable(), kinds: z.array(DataKind) })),
}).openapi("TradeSponsorCohort");

export const SponsorCohortParam = z.object({ id: z.uuid() });
export const SponsorSmeParam = z.object({ id: z.uuid(), organizationId: z.string().min(1).max(100) });

export const SponsorSmeView = z
  .object({
    sponsor: z.object({ id: z.string(), name: z.string() }),
    cohort: z.object({ id: z.uuid(), name: z.string() }),
    sme: z.object({ organizationId: z.string(), name: z.string(), legalName: z.string().nullable(), smeId: z.string().nullable(), country: z.string().nullable() }),
    sharedKinds: z.array(DataKind),
    /** By kind, only the kinds the owner agreed to. `available: false` means TRADE doesn't record it yet. */
    data: z.record(z.string(), z.unknown()),
    disclaimer: z.string(),
  })
  .openapi("TradeSponsorSme");

export const ConsentQuery = z.object({
  organizationId: z.string().optional().openapi({ description: "The SME organisation. Default: the caller's only one." }),
});

export const ConsentView = z
  .object({
    organizationId: z.string(),
    /** Only the owner of the organisation can grant or withdraw. */
    canChange: z.boolean(),
    wordingVersion: z.string(),
    disclaimer: z.string(),
    sponsors: z.array(
      z.object({
        sponsor: z.object({ id: z.string(), name: z.string() }),
        cohorts: z.array(z.string()),
        kinds: z.array(
          z.object({
            kind: DataKind,
            label: z.string(),
            description: z.string(),
            /** The sentence the owner agrees to. It is stored with the grant. */
            wording: z.string(),
            granted: z.boolean(),
            consentId: z.uuid().nullable(),
            grantedAt: z.iso.datetime().nullable(),
          }),
        ),
      }),
    ),
  })
  .openapi("TradeConsents");

export const GrantConsentBody = z
  .object({
    organizationId: z.string().optional(),
    sponsorOrganizationId: z.string().min(1),
    kinds: z.array(DataKind).min(1),
  })
  .openapi("GrantTradeConsentBody");

export const ConsentParam = z.object({ id: z.uuid() });

// ---- The register of pilot SMEs ----

const LevelOrNull = z.enum(["high", "medium", "low"]).nullable();

export const RegisterItem = z
  .object({
    id: z.uuid(),
    code: z.string().openapi({ example: "TRADE-ETH-LEA-002", description: "The SME ID the diagnostic workbook gives the business." }),
    companyName: z.string(),
    participantName: z.string().nullable(),
    phone: z.string().nullable(),
    email: z.string().nullable(),
    yearEstablished: z.number().int().nullable(),
    location: z.string().nullable(),
    employees: z.number().int().nullable(),
    exportLicence: z.boolean().nullable(),
    currentBank: z.string().nullable(),
    mainProduct: z.string().nullable(),
    monthlyProductionCapacity: z.number().nullable(),
    averageMonthlyRevenue: z.number().nullable(),
    largestOrderCompleted: z.number().nullable(),
    currentMarkets: z.string().nullable(),
    targetExportMarket: z.string().nullable(),
    monthlyOperatingCost: z.number().nullable(),
    estimatedMonthlyProfit: z.number().nullable(),
    existingLoan: z.boolean().nullable(),
    loanAmount: z.number().nullable(),
    cashflowStability: z.string().nullable(),
    workingCapitalGap: z.number().nullable(),
    equipmentInvestmentNeeded: z.number().nullable(),
    exportLogisticsGap: z.number().nullable(),
    costingKnowledge: z.number().int().nullable(),
    productionCapacityStrength: z.number().int().nullable(),
    documentationKnowledge: z.number().int().nullable(),
    financialRecordKeeping: z.number().int().nullable(),
    marketReadiness: z.number().int().nullable(),
    entrustSupportNeeded: z.string().nullable(),
    bankOpportunity: z.string().nullable(),
    serviceNotes: z.string().nullable(),
    totalCapitalGap: z.number().nullable().openapi({ description: "The three gaps added up." }),
    exportReadinessScore: z.number().int().nullable().openapi({ description: "The five scores added up (5 to 25); null until all five are recorded." }),
    financeReadinessLevel: LevelOrNull.openapi({ description: "From the score: 20 or more high, 15 or more medium, otherwise low." }),
    financePriority: LevelOrNull.openapi({ description: "From the capital gap: 500,000 or more high, 200,000 or more medium, otherwise low." }),
    updatedAt: z.iso.datetime(),
  })
  .openapi("TradeRegisterItem");

export const RegisterParam = z.object({ id: z.uuid().openapi({ description: "The register record's id (not the SME ID)." }) });

export const RegisterDetail = RegisterItem.extend({
  alsoApplied: z
    .array(z.object({ id: z.uuid(), program: z.string(), submittedAt: z.iso.datetime(), businessName: z.string() }))
    .openapi({ description: "Responses from Ethiopia to a programme's form that come from the same business, found by its phone number or email address. Newest first." }),
}).openapi("TradeRegisterDetail");
export type RegisterDetailView = z.infer<typeof RegisterDetail>;

export const RegisterList = z
  .object({
    items: z.array(RegisterItem),
    summary: z.object({
      total: z.number().int(),
      assessed: z.number().int().openapi({ description: "How many have all five scores." }),
      averageReadiness: z.number().nullable(),
      totalCapitalGap: z.number(),
      byLevel: z.object({ high: z.number().int(), medium: z.number().int(), low: z.number().int(), notAssessed: z.number().int() }),
      banks: z.array(z.object({ bank: z.string(), count: z.number().int() })),
    }),
  })
  .openapi("TradeRegisterList");

export const ImportRegisterBody = z
  .object({
    fileName: z.string().trim().max(200).optional(),
    contentBase64: z
      .string()
      .min(1)
      .max(14_000_000)
      .openapi({ description: "The .xlsx file's bytes, base64 encoded. At most about 10 MB." }),
  })
  .openapi("ImportTradeRegisterBody");

export const RegisterImported = z
  .object({
    total: z.number().int().openapi({ description: "Businesses read from the workbook." }),
    created: z.number().int(),
    updated: z.number().int(),
    unchanged: z.number().int(),
    warnings: z.array(z.string()).openapi({ description: "Values that were left out and totals that disagreed with their parts, for staff to check in the workbook." }),
  })
  .openapi("TradeRegisterImported");
export type RegisterListView = z.infer<typeof RegisterList>;
export type RegisterImportedView = z.infer<typeof RegisterImported>;

// ---- Applications to a programme ----

export const ApplicationItem = z
  .object({
    id: z.uuid(),
    program: z.string(),
    submittedAt: z.iso.datetime(),
    email: z.string(),
    businessName: z.string(),
    contactName: z.string().nullable(),
    phone: z.string().nullable(),
    location: z.string().nullable(),
    country: z.literal("ET").openapi({ description: "Always ET: a response from anywhere else is kept but never listed." }),
    answers: z.record(z.string(), z.string()).openapi({ description: "The answer to each question that has one, as typed, by key." }),
    timesApplied: z.number().int().openapi({ description: "How many responses came from this business (by email or name); 1 when only one." }),
  })
  .openapi("TradeApplicationItem");

export const ApplicationParam = z.object({ id: z.uuid() });

export const ApplicationDetail = ApplicationItem.extend({
  otherResponses: z
    .array(z.object({ id: z.uuid(), submittedAt: z.iso.datetime() }))
    .openapi({ description: "The business's other responses from Ethiopia, found by its email address or its name. Newest first." }),
  alsoInRegister: z
    .array(z.object({ id: z.uuid(), code: z.string(), companyName: z.string() }))
    .openapi({ description: "Businesses in the SME register that are the same business, found by phone number or email address." }),
}).openapi("TradeApplicationDetail");
export type ApplicationDetailView = z.infer<typeof ApplicationDetail>;

export const ApplicationList = z
  .object({
    items: z.array(ApplicationItem),
    summary: z.object({
      shown: z.number().int(),
      notShown: z.number().int().openapi({ description: "Responses kept but not listed, because they are from outside Ethiopia or don't say where from. Only the number is given." }),
      exportedBefore: z.number().int(),
      interestedInZemen: z.number().int(),
      repeatApplications: z.number().int().openapi({ description: "Listed responses from a business that applied more than once." }),
    }),
  })
  .openapi("TradeApplicationList");

export const ImportApplicationsBody = z
  .object({
    program: z.string().trim().min(1).max(200).openapi({ description: "The programme the form is for. Loading the same programme again updates its responses." }),
    fileName: z.string().trim().max(200).optional(),
    contentBase64: z.string().min(1).max(14_000_000).openapi({ description: "The .xlsx file's bytes, base64 encoded. At most about 10 MB." }),
  })
  .openapi("ImportTradeApplicationsBody");

export const ApplicationsImported = z
  .object({
    total: z.number().int().openapi({ description: "Responses read from the sheet." }),
    created: z.number().int(),
    updated: z.number().int(),
    unchanged: z.number().int(),
    shown: z.number().int().openapi({ description: "How many are from Ethiopia, so can be listed." }),
    notShown: z.number().int().openapi({ description: "How many are kept but won't be listed: from outside Ethiopia, or not saying where from." }),
    warnings: z.array(z.string()).openapi({ description: "Things to check in the sheet. They name businesses in Ethiopia only." }),
  })
  .openapi("TradeApplicationsImported");
export type ApplicationListView = z.infer<typeof ApplicationList>;
export type ApplicationsImportedView = z.infer<typeof ApplicationsImported>;

// ---- The catalogue of pilot SMEs ----

const CatalogueSme = z
  .object({
    key: z.string(),
    id: z.uuid().openapi({ description: "The stored record: the register row (cohort 1) or the latest application (cohort 2). Open its detail page with it." }),
    cohort: z.number().int(),
    name: z.string(),
    contactName: z.string().nullable(),
    phone: z.string().nullable(),
    email: z.string().nullable(),
    location: z.string().nullable(),
    product: z.string().nullable().openapi({ description: "What it makes or sells, on one line." }),
    employees: z.string().nullable().openapi({ description: "As typed: a form's answer isn't always a number." }),
    bank: z.string().nullable(),
    reference: z.string().nullable().openapi({ description: "The diagnostic workbook's SME ID (cohort 1). Cohort 2 has none yet." }),
    readinessLevel: LevelOrNull,
    readinessScore: z.number().int().nullable(),
    exportedBefore: z.boolean().nullable(),
    wantsZemenFinancing: z.boolean().nullable(),
    alsoInCohorts: z.array(z.number().int()).openapi({ description: "The other cohorts the same business is in, found by its phone number or email address." }),
  })
  .openapi("TradeCatalogueSme");

export const Catalogue = z
  .object({
    cohorts: z.array(
      z.object({
        number: z.number().int(),
        name: z.string(),
        description: z.string(),
        status: z.enum(["active", "previous"]).openapi({ description: "Active while the cohort is running or about to, previous once it has finished." }),
        count: z.number().int(),
        smes: z.array(CatalogueSme),
      }),
    ),
  })
  .openapi("TradeCatalogue");
export type CatalogueView = z.infer<typeof Catalogue>;
