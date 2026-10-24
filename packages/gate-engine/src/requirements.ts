import type { PackRequirement, RulePack, StepId } from "@entrust/rules";
import { evaluateCondition } from "./conditions";
import type { CaseEvaluation, CaseFacts, EvaluatedStep, StepStatus } from "./types";

// A rule pack's requirements on a case (#7). A requirement sits on the canonical steps where its
// work is done, so its status is read from theirs: the pack adds what the corridor's law and
// practice ask, with sources, and the steps keep deciding what can be done and when.

/**
 * - not_applicable: its condition doesn't hold for the case, or none of its steps apply
 * - undetermined: whether it applies depends on a fact that isn't known yet
 * - blocked: the work left on it waits on other steps, or a flag holds it
 * - open: some of its work can be done now
 * - met: every one of its steps that applies is completed
 */
export type RequirementStatus = "not_applicable" | "undetermined" | "blocked" | "open" | "met";

export interface EvaluatedRequirement {
  code: string;
  requirement: PackRequirement;
  status: RequirementStatus;
  /** Why it is not applicable, undetermined or blocked. */
  reason: string | null;
  /** Its steps, with their status on the case. */
  steps: { id: StepId; status: StepStatus }[];
}

const reasonsOf = (steps: readonly EvaluatedStep[]) => steps.map((s) => `${s.id}: ${s.reason ?? s.status}`).join(" ");

/** What each of the pack's requirements needs on the case, as its steps stand in the evaluation. */
export function evaluateRequirements(pack: RulePack, facts: CaseFacts, evaluation: CaseEvaluation): EvaluatedRequirement[] {
  const byId = new Map(evaluation.steps.map((s) => [s.id, s]));
  return pack.requirements.map((requirement) => {
    const steps = requirement.steps.map((id) => {
      const step = byId.get(id);
      if (!step) throw new Error(`${requirement.code} is on ${id}, which the evaluation doesn't have`);
      return step;
    });
    const result = (status: RequirementStatus, reason: string | null): EvaluatedRequirement => ({
      code: requirement.code,
      requirement,
      status,
      reason,
      steps: steps.map((s) => ({ id: s.id, status: s.status })),
    });

    const live = steps.filter((s) => s.status !== "not_applicable");
    const when = requirement.appliesWhen;
    const holds = when?.condition ? evaluateCondition(when.condition, facts) : true;
    if (holds === false) return result("not_applicable", `Applies only if ${when?.description}. That is not the case.`);
    if (live.length === 0) {
      return result("not_applicable", `Its steps don't apply: ${steps.map((s) => `${s.id} (${s.reason ?? "not applicable"})`).join("; ")}`);
    }
    if (holds === undefined) return result("undetermined", `Applies only if ${when?.description}. Not known yet.`);

    const left = live.filter((s) => s.status !== "completed");
    if (left.length === 0) return result("met", null);
    if (left.every((s) => s.status === "undetermined")) {
      return result("undetermined", reasonsOf(left));
    }
    if (left.every((s) => s.status === "blocked" || s.status === "undetermined")) {
      return result("blocked", reasonsOf(left));
    }
    return result("open", null);
  });
}
