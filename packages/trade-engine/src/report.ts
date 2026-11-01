import type { Band, ModuleId, Pathway, ReasonCode, TradeRules } from "@entrust/trade-rules";
import type { PathwayAssignment } from "./pathway";
import type { LearningPlan, ModuleStatus, ReviewReason } from "./plan";
import type { Answers } from "./responses";
import type { Scores } from "./scoring";
import type { EvidenceConfidence } from "./statuses";

// The placement report: what the SME and staff read after an assessment is scored. It is a view of the
// stored scores, pathway and plan in plain words, with no calculation of its own, so it can't disagree with
// them. The placement spec's section 6 lists what it holds.

export const PATHWAY_NAMES: Readonly<Record<Pathway, string>> = {
  A: "Export Entry and Readiness",
  B: "Export Execution and Scale",
};

const EVIDENCE_LABELS: Readonly<Record<EvidenceConfidence, string>> = {
  self_reported: "Self-reported",
  documented: "Documents provided",
  reviewed: "Reviewed by staff",
  verified: "Verified",
};

const MODULE_STATUS_LABELS: Readonly<Record<ModuleStatus, string>> = {
  priority_required: "Required first, because of your live order",
  required: "Required",
  assessment_needed: "More answers needed",
  optional: "Optional: you can test out",
};

const REVIEW_NOTES: Readonly<Record<ReviewReason, string>> = {
  provisional_pathway: "Your pathway rests on your own word that you shipped recently. Staff will confirm it against a shipment record.",
  not_applicable_pending: "Some of your \"not applicable\" answers are waiting for staff to approve them.",
  shipment_evidence_contradicts_history: "You said you hadn't completed an export, but offered a shipment record. Staff will check which is right.",
  order_without_evidence: "You reported a confirmed order or a shipment, but said no evidence is available. Staff will check.",
};

export interface ReportBaseline {
  organisation: string;
  /** The SME ID, shared across CLEAR and TRADE. */
  smeId: string;
  /** The day the assessment was submitted, as YYYY-MM-DD. */
  assessedOn: string;
  /** 1 for the first assessment, 2 for the first retake. */
  attempt: number;
}

export interface ReportInput {
  baseline: ReportBaseline;
  answers: Answers;
  scores: Scores;
  pathway: PathwayAssignment;
  plan: LearningPlan;
  /** A later retake replaced this report. It stays readable. */
  superseded?: boolean;
}

export interface ReportReason {
  code: ReasonCode;
  /** The sentence the SME reads next to the module. */
  text: string;
}

export interface ReportDomain {
  id: string;
  title: string;
  /** 0 to 100, or null while too few questions have a valid answer. */
  score: number | null;
  band: Band["id"] | null;
  bandLabel: string | null;
  /** What the band means for the SME. */
  guidance: string | null;
  /** The share of questions with a valid answer, as a whole percent. */
  coverage: number;
  answered: number;
  total: number;
  evidence: EvidenceConfidence;
  evidenceLabel: string;
}

export interface ReportModule {
  sequence: number;
  module: ModuleId;
  title: string;
  deliverable: string;
  status: ModuleStatus;
  statusLabel: string;
  /** Why the module is in the plan. Never empty. */
  reasons: readonly ReportReason[];
  contentStatus: "ready" | "draft" | "in_production";
}

export interface ReportObjectives {
  /** A2: how far the most advanced current export opportunity has got. */
  opportunity: { value: string; label: string } | null;
  /** A4: the product and market for the next export, and what the SME wrote about them. */
  target: { status: { value: string; label: string } | null; product: string | null; market: string | null; buyerType: string | null };
}

export interface PlacementReport {
  rulesVersion: string;
  status: "current" | "superseded";
  baseline: ReportBaseline;
  pathway: {
    id: Pathway;
    name: string;
    /** Rests on the SME's word until staff accept a shipment record. */
    provisional: boolean;
    /** A confirmed order or a shipment under way, which moves M04, M06 and M08 forward. */
    liveOrder: boolean;
    reasons: readonly ReportReason[];
  };
  domains: readonly ReportDomain[];
  plan: {
    modules: readonly ReportModule[];
    requiresStaffReview: boolean;
    /** Why staff will look at it, in plain words. */
    reviewNotes: readonly string[];
  };
  objectives: ReportObjectives;
}

/** Look up the sentence for a reason code. A version that names a code without text fails loudly. */
function reasonsOf(rules: TradeRules, codes: readonly ReasonCode[]): ReportReason[] {
  return codes.map((code) => {
    const definition = rules.reasonCodes.find((r) => r.code === code);
    if (!definition) throw new Error(`TRADE rules ${rules.version} have no text for reason code ${code}`);
    return { code, text: definition.text };
  });
}

function optionLabel(rules: TradeRules, question: string, answers: Answers): { value: string; label: string } | null {
  const value = answers[question];
  if (typeof value !== "string") return null;
  const label = rules.template.questions.find((q) => q.id === question)?.options?.find((o) => o.value === value)?.label;
  return { value, label: label ?? value };
}

const textAnswer = (answers: Answers, question: string): string | null => {
  const value = answers[question];
  return typeof value === "string" && value.trim() ? value.trim() : null;
};

/**
 * Build the placement report from a scored assessment. Everything in it comes from the stored scores,
 * pathway and plan and the rules version they were made with, so it reads the same each time. Every module
 * carries its reason codes and their text, and the report names the rules version.
 */
export function buildPlacementReport(rules: TradeRules, input: ReportInput): PlacementReport {
  const { scores, plan, pathway } = input;
  if (scores.rulesVersion !== rules.version || plan.rulesVersion !== rules.version || pathway.rulesVersion !== rules.version) {
    throw new Error(`The scores, pathway and plan were made with other rules than ${rules.version}`);
  }

  const domains = rules.domains.map((domain): ReportDomain => {
    const result = scores.domains.find((d) => d.id === domain.id);
    if (!result) throw new Error(`No score for domain ${domain.id}`);
    const band = result.band ? rules.bands.find((b) => b.id === result.band) : undefined;
    return {
      id: domain.id,
      title: domain.title,
      score: result.score,
      band: result.band,
      bandLabel: band?.label ?? null,
      guidance: band?.action ?? null,
      coverage: Math.round(result.coverage * 100),
      answered: result.valid,
      total: result.eligible,
      evidence: result.evidence,
      evidenceLabel: EVIDENCE_LABELS[result.evidence],
    };
  });

  const modules = plan.modules.map((planned): ReportModule => {
    const definition = rules.modules.find((m) => m.id === planned.module);
    if (!definition) throw new Error(`The rules have no module ${planned.module}`);
    return {
      sequence: planned.sequence,
      module: planned.module,
      title: definition.title,
      deliverable: definition.deliverable,
      status: planned.status,
      statusLabel: MODULE_STATUS_LABELS[planned.status],
      reasons: reasonsOf(rules, planned.reasonCodes),
      contentStatus: definition.contentStatus,
    };
  });

  return {
    rulesVersion: rules.version,
    status: input.superseded ? "superseded" : "current",
    baseline: input.baseline,
    pathway: {
      id: pathway.pathway,
      name: PATHWAY_NAMES[pathway.pathway],
      provisional: pathway.provisional,
      liveOrder: pathway.liveOrder || plan.modules.some((m) => m.status === "priority_required"),
      reasons: reasonsOf(rules, pathway.reasonCodes),
    },
    domains,
    plan: { modules, requiresStaffReview: plan.requiresHumanReview, reviewNotes: plan.reviewReasons.map((r) => REVIEW_NOTES[r]) },
    objectives: {
      opportunity: optionLabel(rules, "A2", input.answers),
      target: {
        status: optionLabel(rules, "A4", input.answers),
        product: textAnswer(input.answers, "A4a"),
        market: textAnswer(input.answers, "A4b"),
        buyerType: textAnswer(input.answers, "A4c"),
      },
    },
  };
}
