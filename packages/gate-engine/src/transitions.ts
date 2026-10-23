import type { EvidenceType, StepId, StepOwner } from "@entrust/rules";
import { evidenceStatusOn } from "./evaluate";
import {
  TASK_STATUSES,
  type Actor,
  type EvaluatedStep,
  type EvidenceRecord,
  type EvidenceStatus,
  type RecordedStatus,
  type StepRecord,
  type StepStatus,
} from "./types";

// Who may change a task, evidence or milestone status, and from what to what. The tables are data,
// so they can be shown to Entrust; the functions apply them along with the rules a table can't hold
// (prerequisites, approved evidence, validity periods). A phase gate locks when its milestone step
// is signed off, so milestone transitions are the sign-off and unlock rows of the step table.

export class TransitionError extends Error {
  /**
   * - invalid_transition: the status can't go there from where it is
   * - forbidden: the actor's role can't make this change
   * - precondition_failed: allowed, but not yet (prerequisites, evidence, a missing reason or date)
   */
  readonly code: "invalid_transition" | "forbidden" | "precondition_failed";

  constructor(code: TransitionError["code"], message: string) {
    super(message);
    this.name = "TransitionError";
    this.code = code;
  }
}

const ROLE_LABELS: Record<Actor, string> = {
  owner: "SME owner",
  member: "SME member",
  admin: "Entrust admin",
  facilitator: "Entrust facilitator",
  reviewer: "Entrust reviewer",
  system: "CLEAR",
};

const label = (status: string) => status.replaceAll("_", " ").replace(/\bsme\b/, "SME");
const day = (iso: string) => iso.slice(0, 10);

function forbidden(actor: Actor, allowed: readonly Actor[], doing: string) {
  const roles = allowed.map((a) => ROLE_LABELS[a]).join(", ");
  return new TransitionError("forbidden", `${ROLE_LABELS[actor]} can't ${doing}. Allowed: ${roles}.`);
}

// ---- Steps and milestones ----

export type StepAction = "update" | "complete" | "mark_not_applicable" | "reopen" | "sign_off" | "unlock";

export interface StepTransitionRule {
  action: StepAction;
  from: readonly StepStatus[];
  to: readonly RecordedStatus[];
  /** Milestone sign-off steps have their own rows: signing one off locks its phase gate. */
  milestone: boolean;
  /** "workers" means whoever works the step, from STEP_WORKERS. */
  by: "workers" | readonly Actor[];
}

/**
 * Who works a step, by the party that has to act. Buyers, banks and authorities don't use CLEAR,
 * so the SME records what they did.
 */
export const STEP_WORKERS: Record<StepOwner, readonly Actor[]> = {
  sme: ["owner", "member", "admin", "facilitator"],
  buyer: ["owner", "member", "admin", "facilitator"],
  bank: ["owner", "member", "admin", "facilitator"],
  authority: ["owner", "member", "admin", "facilitator"],
  entrust: ["admin", "facilitator", "reviewer"],
  // Entrust staff stand in until the automation exists.
  system: ["system", "admin", "facilitator"],
};

// A step someone marked blocked is unblocked before it is completed, as in the engine's canComplete.
const WORKING = TASK_STATUSES.filter((s) => s !== "blocked");

export const STEP_TRANSITIONS: readonly StepTransitionRule[] = [
  { action: "update", from: TASK_STATUSES, to: TASK_STATUSES, milestone: false, by: "workers" },
  { action: "complete", from: WORKING, to: ["completed"], milestone: false, by: "workers" },
  // Deciding a step doesn't apply is Entrust's call. A step waiting on its facts can be marked too.
  {
    action: "mark_not_applicable",
    from: [...TASK_STATUSES, "undetermined"],
    to: ["not_applicable"],
    milestone: false,
    by: ["admin", "facilitator"],
  },
  { action: "reopen", from: ["completed", "not_applicable"], to: TASK_STATUSES, milestone: false, by: ["admin", "facilitator"] },
  { action: "update", from: TASK_STATUSES, to: TASK_STATUSES, milestone: true, by: ["admin", "facilitator", "reviewer"] },
  { action: "sign_off", from: WORKING, to: ["completed"], milestone: true, by: ["admin", "facilitator", "reviewer"] },
  { action: "unlock", from: ["completed"], to: TASK_STATUSES, milestone: true, by: ["admin"] },
];

const STEP_VERBS: Record<StepAction, (id: StepId) => string> = {
  update: (id) => `update ${id}`,
  complete: (id) => `complete ${id}`,
  mark_not_applicable: (id) => `mark ${id} not applicable`,
  reopen: (id) => `reopen ${id}`,
  sign_off: (id) => `sign off ${id}`,
  unlock: (id) => `unlock ${id}`,
};

// Actions that leave a record of why, for the case history and the step's reason.
const NEEDS_REASON: readonly StepAction[] = ["mark_not_applicable", "reopen", "unlock"];

export interface StepTransitionRequest {
  to: RecordedStatus;
  actor: Actor;
  /** Required to mark a step not applicable, reopen it or unlock a gate. Recorded as the step's reason. */
  reason?: string | null;
}

export interface StepTransition {
  action: StepAction;
  from: StepStatus;
  /** What to record for the step. */
  record: StepRecord;
}

/**
 * Check a change to a step's status against STEP_TRANSITIONS and the step's evaluation from
 * evaluateCase, and return what to record. Throws a TransitionError if the change isn't allowed.
 */
export function transitionStep(step: EvaluatedStep, request: StepTransitionRequest): StepTransition {
  const { id, status: from } = step;
  const { to, actor } = request;

  if (step.applicability === "not_applicable") {
    throw new TransitionError("invalid_transition", `${id} does not apply to this case. ${step.reason}`);
  }
  // The engine decided this status (waiting on prerequisites or on facts). Only marking the step
  // not applicable gets past it.
  if (step.derived && to !== "not_applicable") {
    const why = [
      step.blockedBy.length ? `waiting on ${step.blockedBy.join(", ")}` : null,
      step.heldBy.length ? `held by ${step.heldBy.join(", ")}` : null,
    ].filter(Boolean);
    throw new TransitionError(
      "precondition_failed",
      from === "blocked" ? `${id} is ${why.join(" and ")}.` : `Record whether ${id} applies first. ${step.reason}`,
    );
  }
  if (from === to) throw new TransitionError("invalid_transition", `${id} is already ${label(to)}.`);

  const milestone = step.definition.milestone === true;
  const rule = STEP_TRANSITIONS.find((r) => r.milestone === milestone && r.from.includes(from) && r.to.includes(to));
  if (!rule) {
    throw new TransitionError(
      "invalid_transition",
      milestone && to === "not_applicable"
        ? `${id} is a milestone sign-off, which can't be marked not applicable.`
        : `${id} can't go from ${label(from)} to ${label(to)}.`,
    );
  }

  const allowed = rule.by === "workers" ? STEP_WORKERS[step.owner] : rule.by;
  if (!allowed.includes(actor)) throw forbidden(actor, allowed, STEP_VERBS[rule.action](id));

  const reason = request.reason?.trim() || null;
  if (NEEDS_REASON.includes(rule.action) && !reason) {
    throw new TransitionError("precondition_failed", `Give a reason to ${STEP_VERBS[rule.action](id)}.`);
  }
  if ((rule.action === "complete" || rule.action === "sign_off") && step.missingEvidence.length) {
    throw new TransitionError(
      "precondition_failed",
      `${id} needs approved, in-date evidence first: ${step.missingEvidence.join(", ")}.`,
    );
  }

  return { action: rule.action, from, record: { status: to, reason } };
}

// ---- Evidence ----

export type EvidenceAction = "submit" | "start_review" | "approve" | "request_changes" | "reject" | "expire";

export interface EvidenceTransitionRule {
  action: EvidenceAction;
  from: readonly EvidenceStatus[];
  to: EvidenceStatus;
  by: readonly Actor[];
  /**
   * For types that need a human reviewer (physical certificates, bank permit stamps, customs
   * release notes), CLEAR can't do this: automated checks pre-validate but don't decide (Entrust, Q9).
   */
  humanDecision?: true;
}

export const EVIDENCE_TRANSITIONS: readonly EvidenceTransitionRule[] = [
  // Each submission is a new record, so a type can be submitted again after changes are asked for,
  // a rejection or expiry. Submitting never satisfies a requirement: only approval does.
  {
    action: "submit",
    from: ["not_provided", "changes_required", "rejected", "expired"],
    to: "submitted",
    by: ["owner", "member", "admin", "facilitator", "system"],
  },
  // CLEAR picks evidence up for automated pre-validation; a reviewer can also start straight away.
  { action: "start_review", from: ["submitted"], to: "under_review", by: ["reviewer", "admin", "system"] },
  { action: "approve", from: ["under_review"], to: "approved", by: ["reviewer", "admin", "system"], humanDecision: true },
  { action: "request_changes", from: ["under_review"], to: "changes_required", by: ["reviewer", "admin", "system"] },
  { action: "reject", from: ["under_review"], to: "rejected", by: ["reviewer", "admin", "system"], humanDecision: true },
  { action: "expire", from: ["approved"], to: "expired", by: ["system"] },
];

const EVIDENCE_VERBS: Record<EvidenceAction, (name: string) => string> = {
  submit: (name) => `submit ${name}`,
  start_review: (name) => `start reviewing ${name}`,
  approve: (name) => `approve ${name}`,
  request_changes: (name) => `request changes to ${name}`,
  reject: (name) => `reject ${name}`,
  expire: (name) => `mark ${name} expired`,
};

function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  // The round trip catches dates that don't exist, such as 2026-02-30.
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== isoDate) {
    throw new RangeError(`Not an ISO date: ${isoDate}`);
  }
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * The last day evidence of this type is valid. The validity period counts from the day after
 * issue, so a 30-day permit issued on 1 October is valid through 31 October. Null when the type has
 * no validity period.
 */
export function evidenceValidUntil(type: EvidenceType, issuedOn: string): string | null {
  return type.validity ? addDays(issuedOn, type.validity.days) : null;
}

export interface EvidenceTransitionRequest {
  /** The evidence type, with its validity period from the canonical data or the case's rule pack. */
  type: EvidenceType;
  /** The latest record of this type on the case. Undefined when nothing has been submitted. */
  current: EvidenceRecord | undefined;
  to: EvidenceStatus;
  actor: Actor;
  /** ISO date of the change. Decides whether approved evidence has expired. */
  asOf: string;
  /** The issue date on the document, if it is recorded or corrected with this change. */
  issuedOn?: string | null;
  /** Required to request changes or reject: what is wrong, for the SME. */
  note?: string | null;
}

export interface EvidenceTransition {
  action: EvidenceAction;
  from: EvidenceStatus;
  /** Submitting adds this as a new record; every other action replaces `current` with it. */
  record: EvidenceRecord;
  note: string | null;
}

/**
 * Check a change to evidence against EVIDENCE_TRANSITIONS and return the record to store. Approval
 * sets the expiry date from the type's validity period. Throws a TransitionError if the change
 * isn't allowed.
 */
export function transitionEvidence(request: EvidenceTransitionRequest): EvidenceTransition {
  const { type, current, to, actor, asOf } = request;
  if (current && current.type !== type.id) throw new Error(`The record is ${current.type} evidence, not ${type.id}.`);

  // Approved evidence past its valid-until day counts as expired, so it can be submitted again.
  // Expiring records what the date has already decided, so it starts from the stored approval.
  const from = to === "expired" ? (current?.status ?? "not_provided") : evidenceStatusOn(current, asOf);
  if (from === to) throw new TransitionError("invalid_transition", `${type.name} is already ${label(to)}.`);

  const rule = EVIDENCE_TRANSITIONS.find((r) => r.from.includes(from) && r.to === to);
  if (!rule) throw new TransitionError("invalid_transition", `${type.name} can't go from ${label(from)} to ${label(to)}.`);

  const doing = EVIDENCE_VERBS[rule.action](type.name);
  if (actor === "system" && rule.humanDecision && type.humanReviewRequired) {
    throw new TransitionError(
      "forbidden",
      `${type.name} needs a human reviewer. Automated checks can pre-validate it but not ${rule.action} it.`,
    );
  }
  if (!rule.by.includes(actor)) throw forbidden(actor, rule.by, doing);

  const note = request.note?.trim() || null;
  if ((rule.action === "request_changes" || rule.action === "reject") && !note) {
    throw new TransitionError("precondition_failed", `Add a note saying what is wrong with ${type.name}.`);
  }

  const issuedOn = request.issuedOn ?? current?.issuedOn ?? null;
  if (issuedOn && addDays(issuedOn, 0) > day(asOf)) {
    throw new TransitionError("precondition_failed", `The issue date ${issuedOn} is after ${day(asOf)}.`);
  }

  if (rule.action === "submit") {
    return { action: rule.action, from, record: { type: type.id, status: to, issuedOn, validUntil: null }, note };
  }
  const record: EvidenceRecord = { type: type.id, ...current, status: to, issuedOn };

  if (rule.action === "approve") {
    if (type.validity && !issuedOn) {
      throw new TransitionError(
        "precondition_failed",
        `Record the issue date to approve ${type.name}: it is valid for ${type.validity.days} days from issue.`,
      );
    }
    record.validUntil = issuedOn ? evidenceValidUntil(type, issuedOn) : null;
    if (record.validUntil && record.validUntil < day(asOf)) {
      throw new TransitionError("precondition_failed", `${type.name} expired on ${record.validUntil}. Ask for a current one.`);
    }
  }
  if (rule.action === "expire" && evidenceStatusOn(current, asOf) !== "expired") {
    throw new TransitionError(
      "precondition_failed",
      current?.validUntil ? `${type.name} is valid until ${current.validUntil}.` : `${type.name} has no expiry date.`,
    );
  }

  return { action: rule.action, from, record, note };
}
