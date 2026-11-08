import { z } from "@hono/zod-openapi";
import { learnerModuleSchema, moduleContentSchema } from "@entrust/trade-content";
import { QUESTION_TYPES } from "@entrust/forms";
import { MODULE_SUBMISSION_STATUSES, RUBRIC_SCORE_OUTCOMES } from "@entrust/db";
import {
  ASSESSMENT_STATUSES,
  COMMERCIAL_ACTIVITY_TYPES,
  EVIDENCE_CONFIDENCE,
  EVIDENCE_REVIEW_STATUSES,
  EVIDENCE_TARGET_TYPES,
  EXPORT_OUTCOME_STATUSES,
  FIELD_KINDS,
  FINANCING_OUTCOME_STATUSES,
  FINANCING_TYPES,
  LEARNING_PLAN_STATUSES,
  MODULE_ASSIGNMENT_SOURCES,
  MODULE_EXEMPTION_STATUSES,
  MODULE_PROGRESS_STATUSES,
  MODULE_STATUSES,
  OUTCOME_EVIDENCE_TIERS,
  PIPELINE_STAGES,
  QUALIFICATION_BANDS,
  SPONSOR_DATA_KINDS,
  VERIFICATION_LADDER_STATUSES,
} from "@entrust/trade-engine";
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
    /** The questions a case can ask, and the step that normally settles each. */
    facts: z.array(
      z.object({
        key: z.string(),
        label: z.string(),
        help: z.string(),
        options: z.array(z.object({ value: z.string(), label: z.string() })).nullable(),
        determinedAt: z.string().nullable(),
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

const FormKind = z.enum(["placement", "diagnostic", "exit"]).openapi({ description: "The onboarding diagnostic, placement assessment, or exit assessment." });

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
  // Null: the figure covers fewer than five SMEs that haven't all agreed to share it (#72).
  enrolled: z.number().nullable(),
  byStatus: z.record(z.string(), z.number().nullable()),
  diagnosticsSubmitted: z.number().nullable(),
  pathwayA: z.number().nullable(),
  pathwayB: z.number().nullable(),
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

// A programme report (#72). A null figure is one the caller may not see: it covers fewer than five SMEs.
const ReportCount = z.number().nullable();
const ReportMoney = z.object({ count: ReportCount, amount: z.number().nullable() });
const ReportScoreDistribution = z.object({
  smes: ReportCount,
  average: z.number().nullable(),
  buckets: z.array(z.object({ bucket: z.string(), count: ReportCount })),
});
const ReportCurrencyAmount = z.array(z.object({ currency: z.string(), amount: z.number() })).nullable();

export const ProgrammeReportParam = z.object({ id: z.uuid() });
export const ProgrammeReport = z
  .object({
    scope: z.object({
      kind: z.enum(["program", "cohort"]),
      id: z.uuid(),
      name: z.string(),
      program: z.string(),
      cohorts: z.array(z.object({ id: z.uuid(), name: z.string() })),
    }),
    audience: z.enum(["staff", "sponsor"]),
    generatedAt: z.iso.datetime(),
    minimumSmes: z.number().int(),
    disclaimer: z.string(),
    reach: z.object({
      enrolled: ReportCount,
      byStatus: z.array(z.object({ status: z.string(), count: ReportCount })),
      pathwayA: ReportCount,
      pathwayB: ReportCount,
    }),
    engagement: z.object({
      activeWithinDays: z.number().int(),
      activeLearners: ReportCount,
      modules: z.array(z.object({ moduleId: z.string(), started: ReportCount, passed: ReportCount })),
      knowledgeChecks: z.array(z.object({ moduleId: z.string(), attempted: ReportCount, passed: ReportCount, passRate: z.number().nullable() })),
      submissionsWaiting: ReportCount,
    }),
    capability: z.array(z.object({ domain: z.string(), title: z.string(), placement: ReportScoreDistribution, exit: ReportScoreDistribution })),
    pipeline: z.object({ leads: ReportCount, verifiedLeads: ReportCount, qualifiedProspects: ReportCount, rfqs: ReportCount, firmOrders: ReportCount }),
    finance: z.object({
      byCurrency: z.array(z.object({ currency: z.string(), requests: ReportMoney, approvals: ReportMoney, disbursements: ReportMoney })),
      fundingGap: z.array(ReportMoney.extend({ currency: z.string() })),
    }),
    exportExecution: z.object({
      byCurrency: z.array(z.object({ currency: z.string(), shipments: ReportMoney, payments: ReportMoney })),
      paymentMethods: z.array(z.object({ method: z.string(), count: ReportCount })),
    }),
    smes: z.array(
      z.object({
        organizationId: z.string(),
        name: z.string(),
        smeId: z.string().nullable(),
        cohortId: z.uuid(),
        cohort: z.string(),
        status: z.string(),
        sharedKinds: z.array(DataKind),
        pathway: z.string().nullable(),
        placementAverage: z.number().nullable(),
        exitAverage: z.number().nullable(),
        modulesStarted: ReportCount,
        modulesPassed: ReportCount,
        submissionsWaiting: ReportCount,
        leads: ReportCount,
        firmOrders: ReportCount,
        financingRequested: ReportCurrencyAmount,
        financingApproved: ReportCurrencyAmount,
        financingDisbursed: ReportCurrencyAmount,
        valueShipped: ReportCurrencyAmount,
        valuePaid: ReportCurrencyAmount,
      }),
    ),
  })
  .openapi("TradeProgrammeReport");

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
    program: z.string().trim().min(1).max(200).openapi({
      description:
        "The programme the form is for; its name decides which catalogue cohort the businesses are in. Loading the same file again updates its responses, and a response already stored under another programme is moved to this one.",
    }),
    fileName: z.string().trim().max(200).optional(),
    contentBase64: z.string().min(1).max(14_000_000).openapi({ description: "The .xlsx file's bytes, base64 encoded. At most about 10 MB." }),
  })
  .openapi("ImportTradeApplicationsBody");

export const ApplicationsImported = z
  .object({
    total: z.number().int().openapi({ description: "Responses read from the sheet." }),
    created: z.number().int(),
    updated: z.number().int(),
    moved: z.number().int().openapi({ description: "Of the updated, how many were stored under another programme and now belong to this one." }),
    unchanged: z.number().int(),
    cohort: z
      .object({ number: z.number().int(), name: z.string() })
      .nullable()
      .openapi({ description: "The catalogue cohort this programme's name puts the businesses in; null when its name is in none, so they are not in the catalogue." }),
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

// ---- Evidence Records & Reviews (#59) ----

export const EvidenceFileSchema = z
  .object({
    id: z.uuid(),
    filename: z.string(),
    contentType: z.string(),
    size: z.number().int(),
    url: z.string().optional(),
  })
  .openapi("EvidenceFile");

export const EvidenceRecordSchema = z
  .object({
    id: z.uuid(),
    organizationId: z.string(),
    organizationName: z.string().optional(),
    enrollmentId: z.uuid().nullable(),
    fileId: z.uuid().nullable(),
    file: EvidenceFileSchema.nullable().optional(),
    title: z.string(),
    targetType: z.enum(EVIDENCE_TARGET_TYPES),
    targetId: z.string().nullable(),
    confidence: z.enum(EVIDENCE_CONFIDENCE),
    status: z.enum(EVIDENCE_REVIEW_STATUSES),
    reviewedByUserId: z.string().nullable(),
    reviewedByUserName: z.string().nullable().optional(),
    reviewedAt: z.iso.datetime().nullable(),
    reviewComment: z.string().nullable(),
    requestedByUserId: z.string().nullable(),
    requestedByUserName: z.string().nullable().optional(),
    requestedAt: z.iso.datetime().nullable(),
    requestPrompt: z.string().nullable(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .openapi("TradeEvidenceRecord");

export const EvidenceRecordList = z
  .object({
    items: z.array(EvidenceRecordSchema),
  })
  .openapi("TradeEvidenceRecordList");

export const CreateEvidenceBody = z
  .object({
    organizationId: z.string().optional(),
    title: z.string().trim().min(1, "Title is required"),
    fileId: z.uuid().optional(),
    enrollmentId: z.uuid().optional(),
    targetType: z.enum(EVIDENCE_TARGET_TYPES).default("assessment_question"),
    targetId: z.string().trim().optional(),
    confidence: z.enum(EVIDENCE_CONFIDENCE).optional(),
  })
  .openapi("CreateEvidenceBody");

export const ReviewEvidenceBody = z
  .object({
    status: z.enum(["under_review", "accepted", "rejected", "resubmission_required"]),
    comment: z.string().trim().optional(),
    confidence: z.enum(EVIDENCE_CONFIDENCE).optional(),
  })
  .openapi("ReviewEvidenceBody");

export const RequestEvidenceBody = z
  .object({
    organizationId: z.string().min(1),
    enrollmentId: z.uuid().optional(),
    title: z.string().trim().min(1, "Title is required"),
    targetType: z.enum(EVIDENCE_TARGET_TYPES).default("assessment_question"),
    targetId: z.string().trim().optional(),
    prompt: z.string().trim().min(1, "Instructions/prompt are required"),
  })
  .openapi("RequestEvidenceBody");

export const EvidenceListQuery = z
  .object({
    organizationId: z.string().optional(),
    enrollmentId: z.uuid().optional(),
    targetType: z.enum(EVIDENCE_TARGET_TYPES).optional(),
    targetId: z.string().optional(),
    status: z.enum(EVIDENCE_REVIEW_STATUSES).optional(),
  })
  .openapi("EvidenceListQuery");

export const EvidenceParam = z
  .object({
    id: z.uuid(),
  })
  .openapi("EvidenceParam");

export type EvidenceRecordView = z.infer<typeof EvidenceRecordSchema>;
export type CreateEvidenceInput = z.infer<typeof CreateEvidenceBody>;
export type ReviewEvidenceInput = z.infer<typeof ReviewEvidenceBody>;
export type RequestEvidenceInput = z.infer<typeof RequestEvidenceBody>;
export type EvidenceListQueryInput = z.infer<typeof EvidenceListQuery>;

// ---- Plan Review, Overrides & Exemptions (#60) ----

export const ModuleAssignmentSchema = z
  .object({
    id: z.uuid(),
    planId: z.uuid(),
    moduleId: z.enum(MODULE_IDS),
    status: z.enum(MODULE_STATUSES),
    sequence: z.number().int(),
    reasonCodes: z.array(z.string()),
    source: z.enum(MODULE_ASSIGNMENT_SOURCES),
    createdAt: z.iso.datetime(),
  })
  .openapi("TradeModuleAssignment");

export const LearningPlanSchema = z
  .object({
    id: z.uuid(),
    enrollmentId: z.uuid(),
    organizationId: z.string().optional(),
    organizationName: z.string().optional(),
    assessmentId: z.uuid().nullable(),
    rulesVersion: z.string(),
    pathway: z.enum(PATHWAYS),
    status: z.enum(LEARNING_PLAN_STATUSES),
    requiresHumanReview: z.boolean(),
    reviewReasons: z.array(z.string()),
    reviewedByUserId: z.string().nullable(),
    reviewedByUserName: z.string().nullable().optional(),
    reviewedAt: z.iso.datetime().nullable(),
    reviewNotes: z.string().nullable(),
    acknowledgedAt: z.iso.datetime().nullable(),
    supersededById: z.uuid().nullable(),
    supersededAt: z.iso.datetime().nullable(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
    modules: z.array(ModuleAssignmentSchema),
  })
  .openapi("TradeLearningPlanRecord");

export const LearningPlanList = z
  .object({
    items: z.array(LearningPlanSchema),
  })
  .openapi("TradeLearningPlanList");

export const LearningPlanListQuery = z
  .object({
    enrollmentId: z.uuid().optional(),
    cohortId: z.uuid().optional(),
    organizationId: z.string().optional(),
    status: z.enum(LEARNING_PLAN_STATUSES).optional(),
    requiresHumanReview: z.coerce.boolean().optional(),
  })
  .openapi("LearningPlanListQuery");

export const PlanParam = z
  .object({
    id: z.uuid(),
  })
  .openapi("PlanParam");

export const ApprovePlanBody = z
  .object({
    notes: z.string().trim().optional(),
  })
  .openapi("ApprovePlanBody");

export const OverridePlanItemInput = z
  .object({
    moduleId: z.enum(MODULE_IDS),
    status: z.enum(MODULE_STATUSES).default("required"),
    sequence: z.number().int().optional(),
  })
  .openapi("OverridePlanItemInput");

export const OverridePlanBody = z
  .object({
    reason: z.string().trim().min(1, "Override reason is mandatory and required."),
    additions: z.array(OverridePlanItemInput).optional(),
    removals: z.array(z.enum(MODULE_IDS)).optional(),
    status: z.enum(["approved", "active"]).default("approved"),
  })
  .openapi("OverridePlanBody");

export const ModuleExemptionSchema = z
  .object({
    id: z.uuid(),
    enrollmentId: z.uuid(),
    organizationId: z.string().optional(),
    organizationName: z.string().optional(),
    moduleId: z.enum(MODULE_IDS),
    evidenceRecordId: z.uuid(),
    evidenceTitle: z.string().optional(),
    status: z.enum(MODULE_EXEMPTION_STATUSES),
    reason: z.string(),
    requestedByUserId: z.string().nullable(),
    requestedByUserName: z.string().nullable().optional(),
    reviewedByUserId: z.string().nullable(),
    reviewedByUserName: z.string().nullable().optional(),
    reviewedAt: z.iso.datetime().nullable(),
    reviewComment: z.string().nullable(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .openapi("TradeModuleExemption");

export const ModuleExemptionList = z
  .object({
    items: z.array(ModuleExemptionSchema),
  })
  .openapi("TradeModuleExemptionList");

export const CreateExemptionBody = z
  .object({
    enrollmentId: z.uuid(),
    moduleId: z.enum(MODULE_IDS),
    evidenceRecordId: z.uuid(),
    reason: z.string().trim().min(1, "Reason for exemption is required"),
  })
  .openapi("CreateExemptionBody");

export const ReviewExemptionBody = z
  .object({
    status: z.enum(["approved", "rejected"]),
    comment: z.string().trim().optional(),
  })
  .openapi("ReviewExemptionBody");

export const ExemptionListQuery = z
  .object({
    enrollmentId: z.uuid().optional(),
    organizationId: z.string().optional(),
    moduleId: z.enum(MODULE_IDS).optional(),
    status: z.enum(MODULE_EXEMPTION_STATUSES).optional(),
  })
  .openapi("ExemptionListQuery");

export const ExemptionParam = z
  .object({
    id: z.uuid(),
  })
  .openapi("ExemptionParam");

export type LearningPlanRecord = z.infer<typeof LearningPlanSchema>;
export type ModuleAssignmentView = z.infer<typeof ModuleAssignmentSchema>;
export type ApprovePlanInput = z.infer<typeof ApprovePlanBody>;
export type OverridePlanInput = z.infer<typeof OverridePlanBody>;
export type LearningPlanListQueryInput = z.infer<typeof LearningPlanListQuery>;
export type ModuleExemptionView = z.infer<typeof ModuleExemptionSchema>;
export type CreateExemptionInput = z.infer<typeof CreateExemptionBody>;
export type ReviewExemptionInput = z.infer<typeof ReviewExemptionBody>;
export type ExemptionListQueryInput = z.infer<typeof ExemptionListQuery>;

// ---- Module Progress & Learner Tracking ----
export const ModuleProgressSchema = z
  .object({
    id: z.uuid(),
    enrollmentId: z.uuid(),
    moduleId: z.enum(MODULE_IDS),
    contentVersion: z.string(),
    status: z.enum(MODULE_PROGRESS_STATUSES),
    lessonProgress: z.record(z.string(), z.unknown()),
    startedAt: z.string().nullable(),
    theoryCompletedAt: z.string().nullable().optional(),
    knowledgeCheckScore: z.number().nullable().optional(),
    completedAt: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi("TradeModuleProgress");

export const ModuleProgressList = z
  .object({
    items: z.array(ModuleProgressSchema),
  })
  .openapi("TradeModuleProgressList");

export const ModuleProgressQuery = z
  .object({
    enrollmentId: z.uuid(),
    moduleId: z.enum(MODULE_IDS).optional(),
  })
  .openapi("TradeModuleProgressQuery");

export const RecordModuleProgressBody = z
  .object({
    enrollmentId: z.uuid(),
    moduleId: z.enum(MODULE_IDS),
    lessonId: z.string().trim().optional(),
    completed: z.boolean().optional(),
    status: z.enum(MODULE_PROGRESS_STATUSES).optional(),
    contentVersion: z.string().trim().optional(),
  })
  .openapi("RecordTradeModuleProgressBody");

export type ModuleProgressView = z.infer<typeof ModuleProgressSchema>;
export type ModuleProgressQueryInput = z.infer<typeof ModuleProgressQuery>;
export type RecordModuleProgressInput = z.infer<typeof RecordModuleProgressBody>;

// ---- Knowledge Checks (#63) ----
export const KnowledgeCheckAttemptInput = z
  .object({
    enrollmentId: z.uuid(),
    contentVersion: z.string().trim().optional(),
    answers: z.record(z.string(), z.union([z.string(), z.array(z.string())])),
  })
  .openapi("TradeKnowledgeCheckAttemptInput");

export const QuestionGradingResultSchema = z
  .object({
    questionId: z.string(),
    questionText: z.string(),
    submittedAnswers: z.array(z.string()),
    correctAnswers: z.array(z.string()),
    isCorrect: z.boolean(),
    explanation: z.string().optional(),
    lessonId: z.string().optional(),
  })
  .openapi("TradeQuestionGradingResult");

export const KnowledgeCheckAttemptResult = z
  .object({
    id: z.uuid(),
    enrollmentId: z.uuid(),
    moduleId: z.enum(MODULE_IDS),
    contentVersion: z.string(),
    attemptNumber: z.number().int(),
    score: z.number(),
    passed: z.boolean(),
    totalQuestions: z.number().int(),
    correctCount: z.number().int(),
    results: z.array(QuestionGradingResultSchema),
    theoryCompletedAt: z.string().nullable().optional(),
    createdAt: z.string(),
  })
  .openapi("TradeKnowledgeCheckAttemptResult");

export const KnowledgeCheckHistoryItem = z
  .object({
    id: z.uuid(),
    attemptNumber: z.number().int(),
    score: z.number(),
    passed: z.boolean(),
    totalQuestions: z.number().int(),
    correctCount: z.number().int(),
    contentVersion: z.string(),
    createdAt: z.string(),
  })
  .openapi("TradeKnowledgeCheckHistoryItem");

export const KnowledgeCheckHistoryList = z
  .object({
    items: z.array(KnowledgeCheckHistoryItem),
    bestScore: z.number().nullable(),
    hasPassed: z.boolean(),
  })
  .openapi("TradeKnowledgeCheckHistoryList");

export const KnowledgeCheckHistoryQuery = z
  .object({
    enrollmentId: z.uuid(),
  })
  .openapi("TradeKnowledgeCheckHistoryQuery");

export const CohortModuleKnowledgeCheckStat = z
  .object({
    moduleId: z.enum(MODULE_IDS),
    attemptsCount: z.number().int(),
    learnersPassed: z.number().int(),
    totalLearners: z.number().int(),
    passRate: z.number(),
  })
  .openapi("TradeCohortModuleKnowledgeCheckStat");

export const CohortKnowledgeCheckStats = z
  .object({
    cohortId: z.uuid(),
    modules: z.array(CohortModuleKnowledgeCheckStat),
  })
  .openapi("TradeCohortKnowledgeCheckStats");

export type KnowledgeCheckAttemptInput = z.infer<typeof KnowledgeCheckAttemptInput>;
export type KnowledgeCheckAttemptResult = z.infer<typeof KnowledgeCheckAttemptResult>;
export type KnowledgeCheckHistoryList = z.infer<typeof KnowledgeCheckHistoryList>;
export type CohortKnowledgeCheckStats = z.infer<typeof CohortKnowledgeCheckStats>;

// ---- Module Submissions & Rubric Scoring (#67) ----
export const CreateModuleSubmissionBody = z
  .object({
    enrollmentId: z.uuid(),
    moduleId: z.enum(MODULE_IDS),
    contentVersion: z.string().trim().optional(),
    worksheetVersionId: z.uuid().optional(),
    evidenceRecordIds: z.array(z.uuid()).optional().default([]),
  })
  .openapi("CreateTradeModuleSubmissionBody");

export const RubricCriterionScoreInput = z.object({
  points: z.number().int().min(0),
  comment: z.string().trim().optional(),
});

export const RubricScoredCriterionView = z.object({
  criterionId: z.string(),
  title: z.string(),
  points: z.number(),
  maxPoints: z.number(),
  mustHave: z.boolean(),
  comment: z.string().optional(),
  passed: z.boolean(),
});

export const RubricAssessmentView = z
  .object({
    id: z.uuid(),
    submissionId: z.uuid(),
    assessorUserId: z.string().nullable(),
    assessorName: z.string().nullable().optional(),
    isFirstScore: z.boolean(),
    scores: z.record(z.string(), z.object({ points: z.number(), comment: z.string().optional() })),
    criterionResults: z.array(RubricScoredCriterionView),
    confirmedCriticalFailures: z.array(z.string()),
    totalPoints: z.number(),
    maxPoints: z.number(),
    percentage: z.number(),
    band: z.string(),
    passed: z.boolean(),
    outcome: z.enum(RUBRIC_SCORE_OUTCOMES),
    feedback: z.string().nullable().optional(),
    overriddenByUserId: z.string().nullable().optional(),
    overrideReason: z.string().nullable().optional(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi("TradeRubricAssessmentView");

export const ModuleSubmissionView = z
  .object({
    id: z.uuid(),
    enrollmentId: z.uuid(),
    organizationId: z.string(),
    organizationName: z.string().optional(),
    cohortId: z.uuid().optional(),
    cohortName: z.string().optional(),
    moduleId: z.enum(MODULE_IDS),
    contentVersion: z.string(),
    version: z.number().int(),
    status: z.enum(MODULE_SUBMISSION_STATUSES),
    worksheetVersionId: z.uuid().nullable(),
    evidenceRecordIds: z.array(z.string()),
    worksheetSnapshot: z.record(z.string(), z.unknown()),
    waitingTimeHours: z.number().optional(),
    submittedAt: z.string(),
    reviewedAt: z.string().nullable(),
    officialScore: RubricAssessmentView.nullable().optional(),
    scoresCount: z.number().int().optional(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi("TradeModuleSubmissionView");

export const ModuleSubmissionList = z
  .object({
    items: z.array(ModuleSubmissionView),
  })
  .openapi("TradeModuleSubmissionList");

export const ModuleSubmissionListQuery = z
  .object({
    cohortId: z.uuid().optional(),
    moduleId: z.enum(MODULE_IDS).optional(),
    status: z.enum(MODULE_SUBMISSION_STATUSES).optional(),
    enrollmentId: z.uuid().optional(),
  })
  .openapi("TradeModuleSubmissionListQuery");

export const SubmissionParam = z
  .object({
    id: z.uuid(),
  })
  .openapi("TradeSubmissionParam");

export const ScoreSubmissionBody = z
  .object({
    scores: z.record(z.string(), RubricCriterionScoreInput),
    confirmedCriticalFailures: z.array(z.string()).optional().default([]),
    feedback: z.string().trim().optional(),
  })
  .openapi("ScoreTradeSubmissionBody");

export const OverrideScoreBody = z
  .object({
    scores: z.record(z.string(), RubricCriterionScoreInput).optional(),
    confirmedCriticalFailures: z.array(z.string()).optional(),
    feedback: z.string().trim().optional(),
    overrideReason: z.string().trim().min(1, "A reason is required to override a score"),
  })
  .openapi("OverrideTradeScoreBody");

export const SubmissionScoresList = z
  .object({
    items: z.array(RubricAssessmentView),
    officialScore: RubricAssessmentView.nullable(),
  })
  .openapi("TradeSubmissionScoresList");

export type CreateModuleSubmissionInput = z.infer<typeof CreateModuleSubmissionBody>;
export type ModuleSubmissionView = z.infer<typeof ModuleSubmissionView>;
export type ModuleSubmissionListQueryInput = z.infer<typeof ModuleSubmissionListQuery>;
export type ScoreSubmissionInput = z.infer<typeof ScoreSubmissionBody>;
export type OverrideScoreInput = z.infer<typeof OverrideScoreBody>;
export type RubricAssessmentView = z.infer<typeof RubricAssessmentView>;
export type SubmissionScoresList = z.infer<typeof SubmissionScoresList>;

// ---- Certificates & Program Completion (#71) ----

export const CertificateCodeParam = z.object({
  code: z.string().min(1).openapi({ example: "TRADE-2026-F98A-32B1" }),
});

export const CertificateParam = z.object({
  id: z.uuid(),
});

export const CertificateView = z
  .object({
    id: z.uuid(),
    enrollmentId: z.uuid(),
    code: z.string().openapi({ example: "TRADE-2026-F98A-32B1" }),
    recipientName: z.string(),
    recipientOrganizationName: z.string(),
    programName: z.string(),
    cohortName: z.string(),
    pathway: z.string(),
    issuedAt: z.iso.datetime(),
    isValid: z.boolean(),
    isRevoked: z.boolean(),
    revokedAt: z.iso.datetime().nullable(),
    revocationReason: z.string().nullable(),
    verificationUrl: z.string(),
  })
  .openapi("TradeCertificate");

export const PublicCertificateView = z
  .object({
    code: z.string().openapi({ example: "TRADE-2026-F98A-32B1" }),
    recipientName: z.string(),
    recipientOrganizationName: z.string(),
    programName: z.string(),
    cohortName: z.string(),
    pathway: z.string(),
    issuedAt: z.iso.datetime(),
    isValid: z.boolean(),
    isRevoked: z.boolean(),
    revokedAt: z.iso.datetime().nullable(),
    revocationReason: z.string().nullable(),
  })
  .openapi("PublicTradeCertificate");

export const RevokeCertificateBody = z
  .object({
    reason: z.string().trim().min(3, "Revocation reason is required"),
  })
  .openapi("RevokeTradeCertificateBody");

export const AdminOverrideModuleBody = z
  .object({
    enrollmentId: z.uuid(),
    moduleId: z.enum(MODULE_IDS),
    reason: z.string().trim().min(3, "Reason for manual completion override is required"),
  })
  .openapi("AdminOverrideModuleBody");

export const DomainComparisonView = z
  .object({
    domainId: z.string(),
    domainTitle: z.string(),
    placementScore: z.number().nullable(),
    placementBand: z.string().nullable(),
    placementBandLabel: z.string().nullable(),
    exitScore: z.number().nullable(),
    exitBand: z.string().nullable(),
    exitBandLabel: z.string().nullable(),
    deltaScore: z.number().nullable(),
  })
  .openapi("TradeDomainComparison");

export const ExitAssessmentReportView = z
  .object({
    enrollmentId: z.uuid(),
    organizationId: z.string(),
    organizationName: z.string(),
    cohortName: z.string(),
    placementAssessmentId: z.uuid().nullable(),
    exitAssessmentId: z.uuid().nullable(),
    placementScores: z.array(ScoreView),
    exitScores: z.array(ScoreView),
    comparisons: z.array(DomainComparisonView),
  })
  .openapi("TradeExitAssessmentReport");

export type CertificateView = z.infer<typeof CertificateView>;
export type PublicCertificateView = z.infer<typeof PublicCertificateView>;
export type RevokeCertificateInput = z.infer<typeof RevokeCertificateBody>;
export type AdminOverrideModuleInput = z.infer<typeof AdminOverrideModuleBody>;
export type DomainComparisonView = z.infer<typeof DomainComparisonView>;
export type ExitAssessmentReportView = z.infer<typeof ExitAssessmentReportView>;

// Commercial Opportunity & Pipeline schemas (#68)
export const OpportunityParam = z
  .object({
    id: z.string().uuid().openapi({ description: "Opportunity ID" }),
  })
  .openapi("TradeOpportunityParam");

export const PipelineQuery = z
  .object({
    organizationId: z.string().optional().openapi({ description: "Organisation ID" }),
    enrollmentId: z.string().uuid().optional().openapi({ description: "Enrolment ID" }),
  })
  .openapi("TradePipelineQuery");

export const CreateOpportunityBody = z
  .object({
    organizationId: z.string().optional(),
    enrollmentId: z.string().uuid().optional(),
    title: z.string().trim().min(1, "Title is required"),
    companyName: z.string().trim().min(1, "Company name is required"),
    buyerName: z.string().trim().optional(),
    country: z.string().trim().min(1, "Country is required"),
    website: z.string().trim().url().optional().or(z.literal("")),
    sourceLinks: z.array(z.string().url()).optional().default([]),
    decisionMakerRole: z.string().trim().optional(),
    notes: z.string().trim().optional(),
    verificationStatus: z.enum(VERIFICATION_LADDER_STATUSES).optional().default("unverified"),
    stage: z.enum(PIPELINE_STAGES).optional().default("lead_discovered"),
    estimatedValue: z.number().nonnegative().optional().nullable(),
    currency: z.string().trim().default("USD"),
  })
  .openapi("CreateTradeOpportunityBody");

export const UpdateOpportunityStageBody = z
  .object({
    stage: z.enum(PIPELINE_STAGES),
  })
  .openapi("UpdateTradeOpportunityStageBody");

export const CreateOpportunityActivityBody = z
  .object({
    type: z.enum(COMMERCIAL_ACTIVITY_TYPES),
    summary: z.string().trim().min(1, "Summary is required"),
    occurredAt: z.string().datetime(),
    followUpDate: z.string().datetime().optional().nullable(),
    evidenceUrl: z.string().url().optional().nullable().or(z.literal("")),
  })
  .openapi("CreateTradeOpportunityActivityBody");

export const OpportunityScorecardBody = z
  .object({
    productFit: z.number().int().min(0).max(5),
    purchasingPowerOrVolume: z.number().int().min(0).max(5),
    paymentTerms: z.number().int().min(0).max(5),
    accessToDecisionMaker: z.number().int().min(0).max(5),
    importExperience: z.number().int().min(0).max(5),
    timeline: z.number().int().min(0).max(5),
  })
  .openapi("TradeOpportunityScorecardBody");

export const ActivityView = z
  .object({
    id: z.string().uuid(),
    opportunityId: z.string().uuid(),
    organizationId: z.string(),
    actorUserId: z.string().nullable(),
    type: z.enum(COMMERCIAL_ACTIVITY_TYPES),
    summary: z.string(),
    occurredAt: z.string(),
    followUpDate: z.string().nullable(),
    evidenceUrl: z.string().nullable(),
    createdAt: z.string(),
  })
  .openapi("TradeActivityView");

export const ActivityList = z
  .object({
    items: z.array(ActivityView),
  })
  .openapi("TradeActivityList");

export const OpportunityView = z
  .object({
    id: z.string().uuid(),
    organizationId: z.string(),
    enrollmentId: z.string().uuid().nullable(),
    title: z.string(),
    companyName: z.string(),
    buyerName: z.string().nullable(),
    country: z.string(),
    website: z.string().nullable(),
    sourceLinks: z.array(z.string()),
    decisionMakerRole: z.string().nullable(),
    notes: z.string().nullable(),
    verificationStatus: z.enum(VERIFICATION_LADDER_STATUSES),
    stage: z.enum(PIPELINE_STAGES),
    scorecard: z.record(z.string(), z.number()).nullable(),
    scorecardTotal: z.number().nullable(),
    scorecardBand: z.enum(QUALIFICATION_BANDS).nullable(),
    estimatedValue: z.number().nullable(),
    currency: z.string().nullable(),
    activityCount: z.number(),
    latestActivity: ActivityView.nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi("TradeOpportunityView");

export const OpportunityList = z
  .object({
    items: z.array(OpportunityView),
  })
  .openapi("TradeOpportunityList");

export const ExportJourneyStageView = z
  .object({
    stageNumber: z.number().int().min(1).max(10),
    title: z.string(),
    description: z.string(),
    furthestOpportunityId: z.string().uuid().nullable(),
    activeOpportunitiesCount: z.number().int(),
    m05DeliverableStatus: z.object({
      isEligible: z.boolean(),
      verifiedCount: z.number().int(),
      missingCount: z.number().int(),
    }),
  })
  .openapi("TradeExportJourneyStageView");

export type CreateOpportunityInput = z.infer<typeof CreateOpportunityBody>;
export type UpdateOpportunityStageInput = z.infer<typeof UpdateOpportunityStageBody>;
export type CreateOpportunityActivityInput = z.infer<typeof CreateOpportunityActivityBody>;
export type OpportunityScorecardInput = z.infer<typeof OpportunityScorecardBody>;
export type OpportunityView = z.infer<typeof OpportunityView>;
export type ActivityView = z.infer<typeof ActivityView>;
export type ExportJourneyStageView = z.infer<typeof ExportJourneyStageView>;

// Financing & Export Outcomes schemas (#69)
export const OutcomeParam = z
  .object({
    id: z.string().uuid().openapi({ description: "Outcome ID" }),
  })
  .openapi("TradeOutcomeParam");

export const OutcomeQuery = z
  .object({
    organizationId: z.string().optional(),
    enrollmentId: z.string().uuid().optional(),
    kind: z.enum(["financing", "export"]).optional(),
  })
  .openapi("TradeOutcomeQuery");

export const CreateFinancingOutcomeBody = z
  .object({
    organizationId: z.string().optional(),
    enrollmentId: z.string().uuid().optional(),
    lenderName: z.string().trim().min(1, "Lender name is required"),
    financingType: z.enum(FINANCING_TYPES),
    amountRequested: z.number().positive("Amount requested must be positive"),
    amountApproved: z.number().nonnegative().optional().nullable(),
    amountDisbursed: z.number().nonnegative().optional().nullable(),
    currency: z.string().trim().default("USD"),
    status: z.enum(FINANCING_OUTCOME_STATUSES).optional().default("application_prepared"),
    approvalDate: z.string().datetime().optional().nullable(),
    disbursementDate: z.string().datetime().optional().nullable(),
    notes: z.string().trim().optional(),
    evidenceTier: z.enum(OUTCOME_EVIDENCE_TIERS).optional().default("self_reported"),
    evidenceUrl: z.string().url().optional().nullable().or(z.literal("")),
  })
  .openapi("CreateTradeFinancingOutcomeBody");

export const UpdateFinancingStatusBody = z
  .object({
    status: z.enum(FINANCING_OUTCOME_STATUSES),
    amountApproved: z.number().nonnegative().optional().nullable(),
    amountDisbursed: z.number().nonnegative().optional().nullable(),
    approvalDate: z.string().datetime().optional().nullable(),
    disbursementDate: z.string().datetime().optional().nullable(),
    evidenceTier: z.enum(OUTCOME_EVIDENCE_TIERS).optional(),
    evidenceUrl: z.string().url().optional().nullable().or(z.literal("")),
    notes: z.string().trim().optional(),
  })
  .openapi("UpdateTradeFinancingStatusBody");

export const CreateExportOutcomeBody = z
  .object({
    organizationId: z.string().optional(),
    enrollmentId: z.string().uuid().optional(),
    opportunityId: z.string().uuid().optional().nullable(),
    buyerName: z.string().trim().min(1, "Buyer name is required"),
    destinationCountry: z.string().trim().min(1, "Destination country is required"),
    productDescription: z.string().trim().min(1, "Product description is required"),
    valuePlanned: z.number().nonnegative().optional().nullable(),
    valueShipped: z.number().nonnegative().optional().nullable(),
    valuePaid: z.number().nonnegative().optional().nullable(),
    currency: z.string().trim().default("USD"),
    status: z.enum(EXPORT_OUTCOME_STATUSES).optional().default("planned"),
    shipmentDate: z.string().datetime().optional().nullable(),
    deliveryDate: z.string().datetime().optional().nullable(),
    paymentDate: z.string().datetime().optional().nullable(),
    notes: z.string().trim().optional(),
    evidenceTier: z.enum(OUTCOME_EVIDENCE_TIERS).optional().default("self_reported"),
    evidenceUrl: z.string().url().optional().nullable().or(z.literal("")),
  })
  .openapi("CreateTradeExportOutcomeBody");

export const UpdateExportStatusBody = z
  .object({
    status: z.enum(EXPORT_OUTCOME_STATUSES),
    valueShipped: z.number().nonnegative().optional().nullable(),
    valuePaid: z.number().nonnegative().optional().nullable(),
    shipmentDate: z.string().datetime().optional().nullable(),
    deliveryDate: z.string().datetime().optional().nullable(),
    paymentDate: z.string().datetime().optional().nullable(),
    evidenceTier: z.enum(OUTCOME_EVIDENCE_TIERS).optional(),
    evidenceUrl: z.string().url().optional().nullable().or(z.literal("")),
    notes: z.string().trim().optional(),
  })
  .openapi("UpdateTradeExportStatusBody");

export const OutcomeEventView = z
  .object({
    id: z.string().uuid(),
    outcomeId: z.string().uuid(),
    organizationId: z.string(),
    actorUserId: z.string().nullable(),
    previousStatus: z.string().nullable(),
    newStatus: z.string(),
    evidenceTier: z.enum(OUTCOME_EVIDENCE_TIERS),
    evidenceUrl: z.string().nullable(),
    notes: z.string().nullable(),
    createdAt: z.string(),
  })
  .openapi("TradeOutcomeEventView");

export const OutcomeView = z
  .object({
    id: z.string().uuid(),
    organizationId: z.string(),
    enrollmentId: z.string().uuid().nullable(),
    kind: z.enum(["financing", "export"]),
    status: z.string(),
    // Financing
    lenderName: z.string().nullable(),
    financingType: z.string().nullable(),
    amountRequested: z.number().nullable(),
    amountApproved: z.number().nullable(),
    amountDisbursed: z.number().nullable(),
    currency: z.string().nullable(),
    approvalDate: z.string().nullable(),
    disbursementDate: z.string().nullable(),
    // Export
    opportunityId: z.string().uuid().nullable(),
    buyerName: z.string().nullable(),
    destinationCountry: z.string().nullable(),
    productDescription: z.string().nullable(),
    valuePlanned: z.number().nullable(),
    valueShipped: z.number().nullable(),
    valuePaid: z.number().nullable(),
    shipmentDate: z.string().nullable(),
    deliveryDate: z.string().nullable(),
    paymentDate: z.string().nullable(),
    // Shared
    notes: z.string().nullable(),
    evidenceTier: z.enum(OUTCOME_EVIDENCE_TIERS),
    evidenceUrl: z.string().nullable(),
    events: z.array(OutcomeEventView).optional(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi("TradeOutcomeView");

export const OutcomeList = z
  .object({
    items: z.array(OutcomeView),
  })
  .openapi("TradeOutcomeList");

export type CreateFinancingOutcomeInput = z.infer<typeof CreateFinancingOutcomeBody>;
export type UpdateFinancingStatusInput = z.infer<typeof UpdateFinancingStatusBody>;
export type CreateExportOutcomeInput = z.infer<typeof CreateExportOutcomeBody>;
export type UpdateExportStatusInput = z.infer<typeof UpdateExportStatusBody>;
export type OutcomeEventView = z.infer<typeof OutcomeEventView>;
export type OutcomeView = z.infer<typeof OutcomeView>;




