import { z } from "@hono/zod-openapi";
import { learnerModuleSchema, moduleContentSchema } from "@entrust/trade-content";
import { QUESTION_TYPES } from "@entrust/forms";
import { ASSESSMENT_STATUSES } from "@entrust/trade-engine";
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
