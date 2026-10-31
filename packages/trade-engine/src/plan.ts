import type { ModuleId, ReasonCode, TradeRules, TriggerGroupId } from "@entrust/trade-rules";
import type { Pathway } from "@entrust/trade-rules";
import type { PathwayAssignment } from "./pathway";
import { CONFLICT_CODES, validateResponses } from "./responses";
import type { Answers, ConflictCode } from "./responses";
import { planningRules } from "./rules";
import type { Scores } from "./scoring";

export const MODULE_STATUSES = ["required", "priority_required", "assessment_needed", "optional"] as const;
/**
 * required is a gap or a core module, priority_required is a live order's module that goes straight after
 * M01, assessment_needed is a module whose score can't be worked out yet, and optional is a test-out offer.
 */
export type ModuleStatus = (typeof MODULE_STATUSES)[number];

export interface PlannedModule {
  module: ModuleId;
  status: ModuleStatus;
  /** 1 for the first module. Optional test-outs come after the modules the SME has to take. */
  sequence: number;
  reasonCodes: readonly ReasonCode[];
}

export type ReviewReason = "provisional_pathway" | "not_applicable_pending" | ConflictCode;

export interface LearningPlan {
  rulesVersion: string;
  pathway: Pathway;
  modules: readonly PlannedModule[];
  requiresHumanReview: boolean;
  reviewReasons: readonly ReviewReason[];
}

export interface PlanInput {
  answers: Answers;
  scores: Scores;
  pathway: PathwayAssignment;
  /** Whether the financial records have been verified. Leave it out while that isn't known: unknown is not a gap. */
  recordsVerified?: boolean | undefined;
}

const GAP_CODES: Record<TriggerGroupId, ReasonCode> = {
  buyer: "GAP_BUYER",
  financial: "GAP_FINANCIAL",
  trade_finance: "GAP_TRADE_FINANCE",
  costing: "GAP_COSTING",
  execution: "GAP_EXECUTION",
  operations: "GAP_OPERATIONS",
  digital: "GAP_DIGITAL",
  ai_productivity: "GAP_AI_PRODUCTIVITY",
};

// A prerequisite applies when its rule's condition holds. RULE-01 is the curriculum's records gap.
const PREREQUISITE_CONDITIONS: Record<string, (input: PlanInput) => boolean> = {
  "RULE-01": (input) => input.recordsVerified === false,
};

const RANK: Record<ModuleStatus, number> = { priority_required: 0, required: 1, assessment_needed: 2, optional: 3 };

/**
 * Turn scores, answers and a pathway into an ordered plan with a reason for every module. The order follows
 * the review's rule precedence: M01 first, then a live order's urgent modules, then prerequisites, then
 * bottlenecks, enablers, and the relationship and closing modules. A missing score gives "assessment needed",
 * never "required". The same input and rules version always give the same plan.
 */
export function buildLearningPlan(rules: TradeRules, input: PlanInput): LearningPlan {
  const { plan } = planningRules(rules);
  if (input.scores.rulesVersion !== rules.version || input.pathway.rulesVersion !== rules.version) {
    throw new Error(`The scores and pathway were made with other rules than ${rules.version}`);
  }

  const stage = typeof input.answers.A2 === "string" ? input.answers.A2 : undefined;
  const history = typeof input.answers.A1 === "string" ? input.answers.A1 : undefined;
  const liveOrder = input.pathway.liveOrder || (stage !== undefined && plan.liveOrderStages.includes(stage));
  const quotationOut = stage !== undefined && plan.quotationStages.includes(stage);
  const noQualifiedBuyer = input.answers.A3 === "0" && stage !== undefined && plan.noBuyerStages.includes(stage);
  const hasExported = history !== undefined && plan.exportedHistory.includes(history);

  const assigned = new Map<ModuleId, { status: ModuleStatus; reasons: Set<ReasonCode> }>();
  const assign = (module: ModuleId, status: ModuleStatus, reason: ReasonCode) => {
    const current = assigned.get(module);
    if (!current) assigned.set(module, { status, reasons: new Set([reason]) });
    else {
      current.reasons.add(reason);
      if (RANK[status] < RANK[current.status]) current.status = status;
    }
  };

  for (const m of rules.modules.filter((m) => m.requiredForAll)) assign(m.id, "required", m.trigger.reasonCodes[0]!);

  for (const group of rules.triggerGroups) {
    const result = input.scores.groups.find((g) => g.id === group.id);
    if (!result || result.score === null) assign(group.module, "assessment_needed", "ASSESSMENT_NEEDED");
    else if (result.score < rules.thresholds.assignBelow) assign(group.module, "required", GAP_CODES[group.id]);
    else if (result.score >= rules.thresholds.testOutFrom) assign(group.module, "optional", "TEST_OUT_OFFERED");
  }

  if (hasExported) {
    const buyer = input.scores.groups.find((g) => g.id === "buyer")?.score ?? null;
    if (buyer === null || buyer < rules.thresholds.retentionBelow) assign("M10", "required", "HAS_EXPORTED_RETENTION");
  }
  if (quotationOut) assign("M06", "required", "ACTIVE_QUOTATION");
  if (noQualifiedBuyer) assign("M05", "required", "NO_QUALIFIED_BUYER");
  if (liveOrder) for (const module of plan.urgentModules) assign(module, "priority_required", "LIVE_ORDER");

  // Gating prerequisites: the module a rule requires first is added, and the pair stays together in the order.
  const gated: ModuleId[] = [];
  for (const m of rules.modules) {
    const dependent = assigned.get(m.id);
    if (!dependent || dependent.status === "optional") continue;
    for (const p of m.prerequisites) {
      const applies = PREREQUISITE_CONDITIONS[p.ruleId];
      if (!applies) throw new Error(`No condition is implemented for prerequisite rule ${p.ruleId}`);
      if (!applies(input)) continue;
      assign(p.module, "required", p.reasonCode);
      dependent.reasons.add(p.reasonCode);
      gated.push(p.module, m.id);
    }
  }

  const order: ModuleId[] = [];
  const place = (ids: readonly ModuleId[], status?: (s: ModuleStatus) => boolean) => {
    for (const id of ids) {
      const entry = assigned.get(id);
      if (entry && !order.includes(id) && (!status || status(entry.status))) order.push(id);
    }
  };
  const stages = [...plan.sequence.first, ...plan.sequence.bottleneck, ...plan.sequence.enabler, ...plan.sequence.closing];
  const taken = (s: ModuleStatus) => s !== "optional";
  place(plan.sequence.first, taken);
  if (liveOrder) place(plan.urgentModules, taken);
  place(gated, taken);
  place(stages, taken);
  place(stages);

  const conflicts = validateResponses(rules, input.answers, { submit: false }).conflicts.map((c) => c.code);
  const reviewReasons: ReviewReason[] = [
    ...(input.pathway.provisional ? (["provisional_pathway"] as const) : []),
    ...(input.scores.domains.some((d) => d.pendingNotApplicable.length) || input.scores.groups.some((g) => g.pendingNotApplicable.length)
      ? (["not_applicable_pending"] as const)
      : []),
    ...CONFLICT_CODES.filter((c) => conflicts.includes(c)),
  ];

  return {
    rulesVersion: rules.version,
    pathway: input.pathway.pathway,
    modules: order.map((module, i) => {
      const entry = assigned.get(module)!;
      return { module, status: entry.status, sequence: i + 1, reasonCodes: [...entry.reasons] };
    }),
    requiresHumanReview: reviewReasons.length > 0,
    reviewReasons,
  };
}
