import type { StepDefinition, StepId } from "@entrust/rules";
import { evaluateCondition } from "./conditions";
import type {
  Applicability,
  CaseEvaluation,
  CaseState,
  EvaluatedStep,
  EvaluateOptions,
  EvidenceCheck,
  EvidenceRecord,
  EvidenceStatus,
  NextAction,
  PhaseGate,
  StepStatus,
} from "./types";

export const isDone = (status: StepStatus) => status === "completed" || status === "not_applicable";

const day = (iso: string) => iso.slice(0, 10);

/** A record's status on a date: approved evidence past its valid-until day counts as expired. */
export function evidenceStatusOn(record: EvidenceRecord | undefined, asOf: string): EvidenceStatus {
  if (!record) return "not_provided";
  if (record.status === "approved" && record.validUntil && day(record.validUntil) < day(asOf)) return "expired";
  return record.status;
}

function applicabilityOf(step: StepDefinition, state: CaseState): { applicability: Applicability; reason: string | null } {
  if (step.class === "exception") {
    return state.raisedExceptions.includes(step.id)
      ? { applicability: "applicable", reason: null }
      : { applicability: "not_applicable", reason: `Exception step, not raised on this case. Raised when: ${step.raisedWhen}` };
  }
  if (!step.appliesWhen) return { applicability: "applicable", reason: null };
  const { condition, description } = step.appliesWhen;
  const holds = evaluateCondition(condition, state.facts);
  if (holds === undefined) return { applicability: "undetermined", reason: `Applies only if: ${description}. Not known yet.` };
  if (holds) return { applicability: "applicable", reason: null };
  return { applicability: "not_applicable", reason: `Applies only if: ${description}. That is not the case.` };
}

/**
 * Work out, for every step of a case, whether it applies, whether it is blocked and why, what
 * evidence is missing, and whether it can be completed; then which phase gates can close and what
 * to do next. Pure: the same definitions, state and date always give the same result.
 */
export function evaluateCase(
  definitions: readonly StepDefinition[],
  state: CaseState,
  options: EvaluateOptions,
): CaseEvaluation {
  const byId = new Map(definitions.map((d) => [d.id, d]));
  const warnings: string[] = [];
  for (const id of state.raisedExceptions) {
    const definition = byId.get(id);
    if (!definition) warnings.push(`Raised exception ${id} is not a known step.`);
    else if (definition.class !== "exception") warnings.push(`${id} is raised as an exception but is a ${definition.class} step.`);
  }

  // A milestone waits on every other step in its phase, as well as its own prerequisites.
  const prerequisitesOf = (step: StepDefinition): readonly StepId[] =>
    step.milestone
      ? [...step.prerequisites, ...definitions.filter((d) => d.phase === step.phase && d.id !== step.id).map((d) => d.id)]
      : step.prerequisites;

  const memo = new Map<StepId, EvaluatedStep>();
  const visiting = new Set<StepId>();

  const evaluate = (id: StepId): EvaluatedStep => {
    const cached = memo.get(id);
    if (cached) return cached;
    const step = byId.get(id);
    if (!step) throw new Error(`Unknown step ${id}`);
    if (visiting.has(id)) throw new Error(`Prerequisite cycle at ${id}`);
    visiting.add(id);

    const stepWarnings: string[] = [];
    const { applicability, reason: applicabilityReason } = applicabilityOf(step, state);
    const prerequisites = prerequisitesOf(step).map(evaluate);
    // A milestone also waits on completed steps whose evidence is no longer approved.
    const blockedBy = prerequisites
      .filter((p) => !isDone(p.status) || (step.milestone && p.status === "completed" && p.missingEvidence.length > 0))
      .map((p) => p.id);

    const evidence: EvidenceCheck[] = [];
    if (applicability !== "not_applicable") {
      for (const requirement of step.evidence) {
        const required = requirement.when ? evaluateCondition(requirement.when.condition, state.facts) : true;
        if (required === false) continue;
        // The latest record of a type decides its status, so a rejected resubmission is not hidden
        // by an older approval or review.
        const status = evidenceStatusOn(
          state.evidence.filter((e) => e.type === requirement.type).at(-1),
          options.asOf,
        );
        evidence.push({
          type: requirement.type,
          status,
          satisfied: status === "approved",
          requiredIf: required === undefined ? (requirement.when?.description ?? null) : null,
        });
      }
    }
    const missingEvidence = evidence.filter((e) => !e.satisfied).map((e) => e.type);

    let recorded = state.steps[id];
    if (recorded?.status === "not_applicable" && step.milestone) {
      stepWarnings.push("A milestone sign-off cannot be marked not applicable, so the mark is ignored.");
      recorded = undefined;
    } else if (recorded?.status === "not_applicable" && !recorded.reason?.trim()) {
      stepWarnings.push("Marked not applicable without a reason, so the mark is ignored.");
      recorded = undefined;
    }

    let status: StepStatus;
    let reason: string | null = null;
    let derived = false;
    if (applicability === "not_applicable") {
      status = "not_applicable";
      reason = applicabilityReason;
      derived = true;
    } else if (recorded?.status === "not_applicable") {
      status = "not_applicable";
      reason = recorded.reason ?? null;
    } else if (recorded?.status === "completed") {
      status = "completed";
      if (blockedBy.length) stepWarnings.push(`Completed, but these prerequisites are no longer done: ${blockedBy.join(", ")}.`);
      if (missingEvidence.length) stepWarnings.push(`Completed, but this evidence is not approved: ${missingEvidence.join(", ")}.`);
    } else if (blockedBy.length) {
      status = "blocked";
      reason = `Waiting on ${blockedBy.join(", ")}.`;
      derived = true;
    } else if (applicability === "undetermined") {
      status = "undetermined";
      reason = applicabilityReason;
      derived = true;
    } else {
      status = recorded?.status ?? "not_started";
      reason = recorded?.reason ?? null;
    }

    const result: EvaluatedStep = {
      id,
      phase: step.phase,
      owner: step.owner,
      definition: step,
      applicability,
      status,
      reason,
      derived,
      blockedBy,
      evidence,
      missingEvidence,
      canComplete:
        applicability === "applicable" && !isDone(status) && status !== "blocked" && missingEvidence.length === 0,
      warnings: stepWarnings,
    };
    visiting.delete(id);
    memo.set(id, result);
    return result;
  };

  const steps = definitions.map((d) => evaluate(d.id));
  const phases = phaseGates(steps);
  return { steps, phases, nextAction: nextAction(steps), warnings };
}

// A gate's outstanding work is exactly what blocks its milestone step.
function phaseGates(steps: readonly EvaluatedStep[]): PhaseGate[] {
  const byId = new Map(steps.map((s) => [s.id, s]));
  return steps
    .filter((s) => s.definition.milestone)
    .map((milestone) => {
      const outstanding = milestone.blockedBy.map((id) => {
        const s = byId.get(id);
        const reason =
          s?.status === "completed"
            ? `Evidence not approved: ${s.missingEvidence.join(", ")}.`
            : (s?.reason ?? `Status: ${s?.status.replaceAll("_", " ")}.`);
        return { stepId: id, reason };
      });
      const status = milestone.status === "completed" ? "locked" : outstanding.length ? "open" : "ready";
      return { phase: milestone.phase, milestoneStep: milestone.id, status, outstanding };
    });
}

function nextAction(steps: readonly EvaluatedStep[]): NextAction | null {
  // Completed steps whose evidence is no longer approved still need work before their gate closes.
  const open = steps.filter(
    (s) => (!isDone(s.status) && s.status !== "blocked") || (s.status === "completed" && s.missingEvidence.length > 0),
  );
  const step = open.find((s) => s.definition.class === "exception") ?? open[0];
  if (!step) return null;
  const { definition } = step;

  if (definition.class === "exception") {
    return { stepId: step.id, kind: "resolve_exception", owner: step.owner, detail: `Resolve: ${definition.name}.` };
  }
  if (step.status === "undetermined") {
    return {
      stepId: step.id,
      kind: "determine",
      owner: "entrust",
      detail: `Record whether this applies: ${definition.appliesWhen?.description ?? definition.name}.`,
    };
  }
  if (definition.milestone) {
    return { stepId: step.id, kind: "sign_off", owner: step.owner, detail: `Sign off: ${definition.name}.` };
  }
  const inReview = step.evidence.find((e) => !e.satisfied && (e.status === "submitted" || e.status === "under_review"));
  if (inReview) {
    return { stepId: step.id, kind: "review_evidence", owner: "entrust", detail: `Review the submitted ${inReview.type}.` };
  }
  const missing = step.evidence.find((e) => !e.satisfied);
  if (missing) {
    return { stepId: step.id, kind: "provide_evidence", owner: step.owner, detail: `Provide ${missing.type} (${missing.status.replaceAll("_", " ")}).` };
  }
  return { stepId: step.id, kind: "complete", owner: step.owner, detail: `Complete: ${definition.name}.` };
}
