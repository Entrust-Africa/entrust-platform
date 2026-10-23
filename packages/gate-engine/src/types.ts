import type { FactKey, PhaseId, StepDefinition, StepId, StepOwner } from "@entrust/rules";

/** Task statuses from the Operational Control Matrix. */
export const TASK_STATUSES = [
  "not_started",
  "in_progress",
  "awaiting_sme",
  "awaiting_buyer",
  "awaiting_bank",
  "awaiting_authority",
  "blocked",
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

/** What a person can record on a step: a task status, or that it is done. */
export const RECORDED_STATUSES = [...TASK_STATUSES, "completed", "not_applicable"] as const;
export type RecordedStatus = (typeof RECORDED_STATUSES)[number];

/** A step's status after evaluation. `undetermined` means a fact it depends on is not known yet. */
export type StepStatus = RecordedStatus | "undetermined";

/** Evidence statuses from the Operational Control Matrix. */
export const EVIDENCE_STATUSES = [
  "not_provided",
  "submitted",
  "under_review",
  "changes_required",
  "approved",
  "rejected",
  "expired",
] as const;
export type EvidenceStatus = (typeof EVIDENCE_STATUSES)[number];

export type FactValue = string | readonly string[];

/** Facts recorded on the case. A missing fact (or an empty list) is unknown. */
export type CaseFacts = Partial<Record<FactKey, FactValue>>;

export interface StepRecord {
  status: RecordedStatus;
  /** Required when the status is not_applicable. */
  reason?: string | null;
}

export interface EvidenceRecord {
  type: string;
  status: EvidenceStatus;
  /** ISO date: the issue date on the document. The type's validity period runs from it. */
  issuedOn?: string | null;
  /** ISO date. Approved evidence counts as expired after this day. Set from the evidence type's validity when approved. */
  validUntil?: string | null;
}

/** Roles in an SME organisation (#18). */
export const SME_ROLES = ["owner", "member"] as const;
export type SmeRole = (typeof SME_ROLES)[number];

/** Roles in the Entrust organisation (#18). */
export const ENTRUST_ROLES = ["admin", "facilitator", "reviewer"] as const;
export type EntrustRole = (typeof ENTRUST_ROLES)[number];

export type Role = SmeRole | EntrustRole;

/** Who makes a change: a person with one of these roles, or CLEAR itself (timers, automated checks). */
export type Actor = Role | "system";

/** An open flag, as the evaluation needs it: the rule, why it was raised and the steps it holds. */
export interface HeldFlag {
  rule: string;
  message: string;
  blocks: readonly StepId[];
}

export interface CaseState {
  facts: CaseFacts;
  steps: Partial<Record<StepId, StepRecord>>;
  /** Open flags. A step one of them holds is blocked until the flag is waived or resolved. */
  flags?: readonly HeldFlag[];
  /** In the order submitted. For each type, the latest record decides its status. */
  evidence: readonly EvidenceRecord[];
  /** Exception steps raised on this case. A raised exception stays listed after it is resolved. */
  raisedExceptions: readonly StepId[];
}

export interface EvaluateOptions {
  /** ISO date the evaluation is for. Used to expire evidence. */
  asOf: string;
}

export type Applicability = "applicable" | "not_applicable" | "undetermined";

export interface EvidenceCheck {
  type: string;
  status: EvidenceStatus;
  satisfied: boolean;
  /** Set when the requirement is conditional and its condition is not known yet. */
  requiredIf: string | null;
}

export interface EvaluatedStep {
  id: StepId;
  phase: PhaseId;
  owner: StepOwner;
  definition: StepDefinition;
  applicability: Applicability;
  status: StepStatus;
  /** Why the step is not applicable, undetermined or blocked. */
  reason: string | null;
  /** True when the engine decided the status rather than a recorded one. */
  derived: boolean;
  /** Prerequisites that are not complete or not applicable. */
  blockedBy: StepId[];
  /** Open flags holding this step. */
  heldBy: string[];
  evidence: EvidenceCheck[];
  /** Required evidence types that are not approved and in date. */
  missingEvidence: string[];
  canComplete: boolean;
  warnings: string[];
}

export interface PhaseGate {
  phase: PhaseId;
  milestoneStep: StepId;
  /**
   * - locked: the milestone sign-off is recorded
   * - ready: every applicable step is complete with approved evidence; the sign-off can be made
   * - open: work is outstanding
   */
  status: "locked" | "ready" | "open";
  outstanding: { stepId: StepId; reason: string }[];
}

export type NextActionKind =
  | "resolve_exception"
  | "determine"
  | "provide_evidence"
  | "review_evidence"
  | "complete"
  | "sign_off";

export interface NextAction {
  stepId: StepId;
  kind: NextActionKind;
  owner: StepOwner;
  detail: string;
}

export interface CaseEvaluation {
  /** In sequence order. */
  steps: EvaluatedStep[];
  phases: PhaseGate[];
  nextAction: NextAction | null;
  warnings: string[];
}
