import { EVIDENCE_TYPES, type EvidenceType, type StepDefinition, type StepId } from "@entrust/rules";
import { describe, expect, it } from "vitest";
import {
  EVIDENCE_TRANSITIONS,
  STEP_TRANSITIONS,
  TASK_STATUSES,
  TransitionError,
  evaluateCase,
  evidenceStatusOn,
  evidenceValidUntil,
  transitionEvidence,
  transitionStep,
} from "../src";
import type { CaseState, EvidenceRecord, EvidenceTransitionRequest, RecordedStatus } from "../src";

// A small workflow, independent of the canonical data, with one step per owner and a milestone.
const base = { owner: "sme", authority: null, scope: "shipment", masterControl: "MC-01", evidence: [] } as const;
const STEPS: StepDefinition[] = [
  { ...base, id: "STEP-001", phase: 1, name: "Capture facts", class: "mandatory", prerequisites: [] },
  {
    ...base,
    id: "STEP-002",
    phase: 1,
    name: "Get permit",
    class: "mandatory",
    prerequisites: ["STEP-001"],
    evidence: [{ type: "bank_export_permit" }],
  },
  {
    ...base,
    id: "STEP-003",
    phase: 1,
    name: "Book container",
    class: "conditional",
    prerequisites: [],
    appliesWhen: { condition: { fact: "transportMode", in: ["sea"] }, description: "Ships by sea" },
  },
  { ...base, id: "STEP-004", phase: 1, name: "Verify documents", class: "mandatory", owner: "entrust", prerequisites: [] },
  { ...base, id: "STEP-005", phase: 1, name: "Look up tariff", class: "mandatory", owner: "system", prerequisites: [] },
  { ...base, id: "STEP-006", phase: 1, name: "Handle failure", class: "exception", prerequisites: [], raisedWhen: "Something fails." },
  {
    ...base,
    id: "STEP-007",
    phase: 1,
    name: "Phase 1 sign-off",
    class: "mandatory",
    owner: "entrust",
    prerequisites: [],
    milestone: true,
  },
];

const asOf = "2026-10-22";
const evaluate = (state: Partial<CaseState> = {}) =>
  evaluateCase(STEPS, { facts: {}, steps: {}, evidence: [], raisedExceptions: [], ...state }, { asOf });
const step = (id: StepId, state: Partial<CaseState> = {}) => {
  const found = evaluate(state).steps.find((s) => s.id === id);
  if (!found) throw new Error(`no ${id}`);
  return found;
};
const recorded = (status: RecordedStatus, reason?: string) => ({ status, reason });

function caught(fn: () => unknown): TransitionError {
  try {
    fn();
  } catch (error) {
    if (error instanceof TransitionError) return error;
    throw error;
  }
  throw new Error("Expected a TransitionError");
}

const approvedPermit: EvidenceRecord = { type: "bank_export_permit", status: "approved", validUntil: "2026-11-01" };
// Every step in phase 1 done, so the milestone can be signed off.
const phaseDone: Partial<CaseState> = {
  facts: { transportMode: "air" },
  steps: {
    "STEP-001": recorded("completed"),
    "STEP-002": recorded("completed"),
    "STEP-004": recorded("completed"),
    "STEP-005": recorded("completed"),
  },
  evidence: [approvedPermit],
};

describe("step transition table", () => {
  it("has at most one row for each from and to", () => {
    for (const milestone of [false, true]) {
      const rows = STEP_TRANSITIONS.filter((r) => r.milestone === milestone);
      const pairs = rows.flatMap((r) => r.from.flatMap((from) => r.to.filter((to) => to !== from).map((to) => `${from}>${to}`)));
      expect(new Set(pairs).size).toBe(pairs.length);
    }
  });
});

describe("transitionStep: update", () => {
  it("moves between any two task statuses", () => {
    for (const from of TASK_STATUSES) {
      for (const to of TASK_STATUSES.filter((s) => s !== from)) {
        const result = transitionStep(step("STEP-001", { steps: { "STEP-001": recorded(from) } }), { to, actor: "member" });
        expect(result).toEqual({ action: "update", from, record: { status: to, reason: null } });
      }
    }
  });

  it("keeps an optional reason, such as why a step is blocked", () => {
    const result = transitionStep(step("STEP-001"), { to: "blocked", actor: "owner", reason: " Customs system down " });
    expect(result.record).toEqual({ status: "blocked", reason: "Customs system down" });
  });

  it("lets whoever works the step update it, by owner", () => {
    const allowed = (id: StepId, actor: Parameters<typeof transitionStep>[1]["actor"]) => {
      try {
        // The milestone waits on the rest of its phase, so finish that first.
        transitionStep(step(id, id === "STEP-007" ? phaseDone : {}), { to: "in_progress", actor });
        return true;
      } catch (error) {
        if (error instanceof TransitionError && error.code === "forbidden") return false;
        throw error;
      }
    };
    const actors = ["owner", "member", "admin", "facilitator", "reviewer", "system"] as const;
    const who = (id: StepId) => actors.filter((a) => allowed(id, a));
    expect(who("STEP-001")).toEqual(["owner", "member", "admin", "facilitator"]);
    expect(who("STEP-004")).toEqual(["admin", "facilitator", "reviewer"]);
    expect(who("STEP-005")).toEqual(["admin", "facilitator", "system"]);
    expect(who("STEP-007")).toEqual(["admin", "facilitator", "reviewer"]);
  });

  it("explains a forbidden change", () => {
    expect(caught(() => transitionStep(step("STEP-004"), { to: "in_progress", actor: "member" }))).toMatchObject({
      code: "forbidden",
      message: "SME member can't update STEP-004. Allowed: Entrust admin, Entrust facilitator, Entrust reviewer.",
    });
  });

  it("rejects a change to the status it already has", () => {
    expect(caught(() => transitionStep(step("STEP-001"), { to: "not_started", actor: "member" }))).toMatchObject({
      code: "invalid_transition",
      message: "STEP-001 is already not started.",
    });
  });

  it("refuses to update a step waiting on its prerequisites", () => {
    const waiting = step("STEP-002", { steps: { "STEP-002": recorded("in_progress") } });
    expect(waiting.status).toBe("blocked");
    expect(caught(() => transitionStep(waiting, { to: "awaiting_bank", actor: "member" }))).toMatchObject({
      code: "precondition_failed",
      message: "STEP-002 is waiting on STEP-001.",
    });
  });

  it("refuses to update a step until its facts say whether it applies", () => {
    expect(caught(() => transitionStep(step("STEP-003"), { to: "in_progress", actor: "member" }))).toMatchObject({
      code: "precondition_failed",
      message: "Record whether STEP-003 applies first. Applies only if: Ships by sea. Not known yet.",
    });
  });

  it("refuses any change to a step that does not apply", () => {
    const air = step("STEP-003", { facts: { transportMode: "air" } });
    expect(caught(() => transitionStep(air, { to: "in_progress", actor: "admin" }))).toMatchObject({
      code: "invalid_transition",
      message: "STEP-003 does not apply to this case. Applies only if: Ships by sea. That is not the case.",
    });
    expect(caught(() => transitionStep(step("STEP-006"), { to: "in_progress", actor: "admin" })).code).toBe(
      "invalid_transition",
    );
  });

  it("works a raised exception step like any other", () => {
    const raised = step("STEP-006", { raisedExceptions: ["STEP-006"] });
    expect(transitionStep(raised, { to: "in_progress", actor: "member" }).action).toBe("update");
  });
});

describe("transitionStep: complete", () => {
  it("completes a step that needs no evidence", () => {
    const result = transitionStep(step("STEP-001", { steps: { "STEP-001": recorded("in_progress") } }), {
      to: "completed",
      actor: "member",
    });
    expect(result).toEqual({ action: "complete", from: "in_progress", record: { status: "completed", reason: null } });
  });

  it("completes from any working status, but not from blocked", () => {
    for (const from of TASK_STATUSES.filter((s) => s !== "blocked")) {
      const s = step("STEP-001", { steps: { "STEP-001": recorded(from) } });
      expect(transitionStep(s, { to: "completed", actor: "owner" }).record.status).toBe("completed");
    }
    const blocked = step("STEP-001", { steps: { "STEP-001": recorded("blocked") } });
    expect(caught(() => transitionStep(blocked, { to: "completed", actor: "owner" }))).toMatchObject({
      code: "invalid_transition",
      message: "STEP-001 can't go from blocked to completed.",
    });
  });

  it("needs approved, in-date evidence: a submitted document is not enough", () => {
    const done = { "STEP-001": recorded("completed") };
    const submitted = step("STEP-002", { steps: done, evidence: [{ type: "bank_export_permit", status: "submitted" }] });
    expect(caught(() => transitionStep(submitted, { to: "completed", actor: "member" }))).toMatchObject({
      code: "precondition_failed",
      message: "STEP-002 needs approved, in-date evidence first: bank_export_permit.",
    });
    const expired = step("STEP-002", { steps: done, evidence: [{ ...approvedPermit, validUntil: "2026-10-21" }] });
    expect(caught(() => transitionStep(expired, { to: "completed", actor: "member" })).code).toBe("precondition_failed");
    const approved = step("STEP-002", { steps: done, evidence: [approvedPermit] });
    expect(transitionStep(approved, { to: "completed", actor: "member" }).action).toBe("complete");
  });

  it("refuses to complete a step waiting on its prerequisites", () => {
    expect(caught(() => transitionStep(step("STEP-002"), { to: "completed", actor: "admin" }))).toMatchObject({
      code: "precondition_failed",
      message: "STEP-002 is waiting on STEP-001.",
    });
  });

  it("lets CLEAR complete its own steps, and Entrust staff stand in", () => {
    expect(transitionStep(step("STEP-005"), { to: "completed", actor: "system" }).action).toBe("complete");
    expect(transitionStep(step("STEP-005"), { to: "completed", actor: "facilitator" }).action).toBe("complete");
    expect(caught(() => transitionStep(step("STEP-005"), { to: "completed", actor: "owner" })).code).toBe("forbidden");
  });
});

describe("transitionStep: mark not applicable", () => {
  it("lets Entrust mark a step not applicable with a reason", () => {
    const result = transitionStep(step("STEP-001"), { to: "not_applicable", actor: "facilitator", reason: "Done last year" });
    expect(result).toEqual({
      action: "mark_not_applicable",
      from: "not_started",
      record: { status: "not_applicable", reason: "Done last year" },
    });
    expect(evaluate({ steps: { "STEP-001": result.record } }).steps[0]?.status).toBe("not_applicable");
  });

  it("needs a reason", () => {
    expect(caught(() => transitionStep(step("STEP-001"), { to: "not_applicable", actor: "admin", reason: "  " }))).toMatchObject({
      code: "precondition_failed",
      message: "Give a reason to mark STEP-001 not applicable.",
    });
  });

  it("is not the SME's call", () => {
    for (const actor of ["owner", "member", "reviewer", "system"] as const) {
      expect(caught(() => transitionStep(step("STEP-001"), { to: "not_applicable", actor, reason: "No" })).code).toBe("forbidden");
    }
  });

  it("works on a step waiting on prerequisites or on facts", () => {
    expect(transitionStep(step("STEP-002"), { to: "not_applicable", actor: "admin", reason: "Paid in advance" }).from).toBe("blocked");
    expect(transitionStep(step("STEP-003"), { to: "not_applicable", actor: "admin", reason: "Air freight" }).from).toBe("undetermined");
  });

  it("never applies to a milestone sign-off", () => {
    expect(caught(() => transitionStep(step("STEP-007"), { to: "not_applicable", actor: "admin", reason: "Skip" }))).toMatchObject({
      code: "invalid_transition",
      message: "STEP-007 is a milestone sign-off, which can't be marked not applicable.",
    });
  });
});

describe("transitionStep: reopen", () => {
  const completed = { steps: { "STEP-001": recorded("completed") } };
  const notApplicable = { steps: { "STEP-001": recorded("not_applicable", "Done last year") } };

  it("lets Entrust reopen a completed or not-applicable step with a reason", () => {
    expect(transitionStep(step("STEP-001", completed), { to: "in_progress", actor: "admin", reason: "Wrong HS code" })).toEqual({
      action: "reopen",
      from: "completed",
      record: { status: "in_progress", reason: "Wrong HS code" },
    });
    expect(transitionStep(step("STEP-001", notApplicable), { to: "not_started", actor: "facilitator", reason: "It applies" }).action).toBe(
      "reopen",
    );
  });

  it("needs a reason and an Entrust admin or facilitator", () => {
    expect(caught(() => transitionStep(step("STEP-001", completed), { to: "in_progress", actor: "admin" })).code).toBe(
      "precondition_failed",
    );
    expect(caught(() => transitionStep(step("STEP-001", completed), { to: "in_progress", actor: "owner", reason: "Oops" })).code).toBe(
      "forbidden",
    );
  });

  it("does not go straight from one done status to the other", () => {
    expect(caught(() => transitionStep(step("STEP-001", completed), { to: "not_applicable", actor: "admin", reason: "x" }))).toMatchObject({
      code: "invalid_transition",
      message: "STEP-001 can't go from completed to not applicable.",
    });
    expect(caught(() => transitionStep(step("STEP-001", notApplicable), { to: "completed", actor: "admin" })).code).toBe(
      "invalid_transition",
    );
  });
});

describe("transitionStep: milestones and phase gates", () => {
  it("locks the gate when the milestone is signed off", () => {
    expect(evaluate(phaseDone).phases[0]?.status).toBe("ready");
    for (const actor of ["admin", "facilitator", "reviewer"] as const) {
      const result = transitionStep(step("STEP-007", phaseDone), { to: "completed", actor });
      expect(result).toEqual({ action: "sign_off", from: "not_started", record: { status: "completed", reason: null } });
    }
    const locked = evaluate({ ...phaseDone, steps: { ...phaseDone.steps, "STEP-007": recorded("completed") } });
    expect(locked.phases[0]?.status).toBe("locked");
  });

  it("never lets an SME or CLEAR sign off", () => {
    for (const actor of ["owner", "member", "system"] as const) {
      expect(caught(() => transitionStep(step("STEP-007", phaseDone), { to: "completed", actor })).code).toBe("forbidden");
    }
  });

  it("refuses to sign off while the gate has outstanding work", () => {
    const open = { ...phaseDone, evidence: [{ ...approvedPermit, validUntil: "2026-10-21" }] };
    expect(evaluate(open).phases[0]?.status).toBe("open");
    expect(caught(() => transitionStep(step("STEP-007", open), { to: "completed", actor: "admin" }))).toMatchObject({
      code: "precondition_failed",
      message: "STEP-007 is waiting on STEP-002.",
    });
  });

  it("lets only an admin unlock a locked gate, with a reason", () => {
    const locked = { ...phaseDone, steps: { ...phaseDone.steps, "STEP-007": recorded("completed") } };
    expect(transitionStep(step("STEP-007", locked), { to: "in_progress", actor: "admin", reason: "LC amended" })).toEqual({
      action: "unlock",
      from: "completed",
      record: { status: "in_progress", reason: "LC amended" },
    });
    expect(caught(() => transitionStep(step("STEP-007", locked), { to: "in_progress", actor: "facilitator", reason: "x" }))).toMatchObject({
      code: "forbidden",
      message: "Entrust facilitator can't unlock STEP-007. Allowed: Entrust admin.",
    });
    expect(caught(() => transitionStep(step("STEP-007", locked), { to: "in_progress", actor: "admin" })).code).toBe(
      "precondition_failed",
    );
  });
});

// ---- Evidence ----

const evidenceType = (id: string): EvidenceType => {
  const found = EVIDENCE_TYPES.find((t) => t.id === id);
  if (!found) throw new Error(`no ${id}`);
  return found;
};
const permit = evidenceType("bank_export_permit");
const phyto = evidenceType("phytosanitary_certificate");
const priceCheck = evidenceType("minimum_price_check");
const record = (status: EvidenceRecord["status"], extra: Partial<EvidenceRecord> = {}): EvidenceRecord => ({
  type: "bank_export_permit",
  status,
  ...extra,
});
const move = (request: Partial<EvidenceTransitionRequest> & Pick<EvidenceTransitionRequest, "to" | "actor">) =>
  transitionEvidence({ type: permit, current: undefined, asOf, ...request });

describe("evidence transition table", () => {
  it("has at most one row for each from and to", () => {
    const pairs = EVIDENCE_TRANSITIONS.flatMap((r) => r.from.map((from) => `${from}>${r.to}`));
    expect(new Set(pairs).size).toBe(pairs.length);
  });

  it("marks physical certificates, bank permits and customs release notes for human review", () => {
    for (const id of [
      "phytosanitary_certificate",
      "health_certificate",
      "quality_certificate",
      "grading_certificate",
      "bank_export_permit",
      "customs_release_note",
    ]) {
      expect(evidenceType(id).humanReviewRequired, id).toBe(true);
    }
  });
});

describe("transitionEvidence: submit", () => {
  it("adds a submitted record, which does not satisfy the requirement", () => {
    const result = move({ to: "submitted", actor: "member", issuedOn: "2026-10-20" });
    expect(result).toEqual({
      action: "submit",
      from: "not_provided",
      record: { type: "bank_export_permit", status: "submitted", issuedOn: "2026-10-20", validUntil: null },
      note: null,
    });
    const s = step("STEP-002", { steps: { "STEP-001": recorded("completed") }, evidence: [result.record] });
    expect(s.missingEvidence).toEqual(["bank_export_permit"]);
    expect(s.canComplete).toBe(false);
  });

  it("allows another submission after changes are asked for, a rejection or expiry", () => {
    for (const current of [
      record("changes_required"),
      record("rejected"),
      record("expired"),
      record("approved", { validUntil: "2026-10-21" }),
    ]) {
      const result = move({ to: "submitted", actor: "owner", current });
      expect(result.action).toBe("submit");
      expect(result.record.status).toBe("submitted");
    }
  });

  it("refuses a new submission while one is pending or approved and in date", () => {
    expect(caught(() => move({ to: "submitted", actor: "owner", current: record("submitted") }))).toMatchObject({
      code: "invalid_transition",
      message: "Bank export permit is already submitted.",
    });
    expect(caught(() => move({ to: "submitted", actor: "owner", current: record("under_review") })).code).toBe("invalid_transition");
    expect(caught(() => move({ to: "submitted", actor: "owner", current: record("approved", { validUntil: "2026-10-22" }) }))).toMatchObject({
      code: "invalid_transition",
      message: "Bank export permit can't go from approved to submitted.",
    });
  });

  it("is done by the SME, Entrust facilitators and admins, or CLEAR, but not reviewers", () => {
    for (const actor of ["owner", "member", "admin", "facilitator", "system"] as const) {
      expect(move({ to: "submitted", actor }).action).toBe("submit");
    }
    expect(caught(() => move({ to: "submitted", actor: "reviewer" })).code).toBe("forbidden");
  });

  it("refuses an issue date in the future, or one that is not a date", () => {
    expect(caught(() => move({ to: "submitted", actor: "member", issuedOn: "2026-10-23" }))).toMatchObject({
      code: "precondition_failed",
      message: "The issue date 2026-10-23 is after 2026-10-22.",
    });
    expect(() => move({ to: "submitted", actor: "member", issuedOn: "2026-02-30" })).toThrow(RangeError);
  });
});

describe("transitionEvidence: review", () => {
  const submitted = record("submitted", { issuedOn: "2026-10-20" });
  const underReview = record("under_review", { issuedOn: "2026-10-20" });

  it("starts a review: reviewers, admins and CLEAR's automated checks", () => {
    for (const actor of ["reviewer", "admin", "system"] as const) {
      expect(move({ to: "under_review", actor, current: submitted })).toEqual({
        action: "start_review",
        from: "submitted",
        record: { ...submitted, status: "under_review" },
        note: null,
      });
    }
    for (const actor of ["owner", "member", "facilitator"] as const) {
      expect(caught(() => move({ to: "under_review", actor, current: submitted })).code).toBe("forbidden");
    }
  });

  it("approves from under review only", () => {
    expect(caught(() => move({ to: "approved", actor: "reviewer", current: submitted }))).toMatchObject({
      code: "invalid_transition",
      message: "Bank export permit can't go from submitted to approved.",
    });
    expect(caught(() => move({ to: "approved", actor: "reviewer" })).code).toBe("invalid_transition");
  });

  it("sets the expiry date from the type's validity period when approved", () => {
    const result = move({ to: "approved", actor: "reviewer", current: underReview });
    expect(result).toEqual({
      action: "approve",
      from: "under_review",
      record: { type: "bank_export_permit", status: "approved", issuedOn: "2026-10-20", validUntil: "2026-11-19" },
      note: null,
    });
  });

  it("takes the issue date given with the approval over the submitted one", () => {
    const result = move({ to: "approved", actor: "admin", current: underReview, issuedOn: "2026-10-01" });
    expect(result.record).toMatchObject({ issuedOn: "2026-10-01", validUntil: "2026-10-31" });
  });

  it("needs the issue date of a type with a validity period", () => {
    expect(caught(() => move({ to: "approved", actor: "reviewer", current: record("under_review") }))).toMatchObject({
      code: "precondition_failed",
      message: "Record the issue date to approve Bank export permit: it is valid for 30 days from issue.",
    });
  });

  it("refuses to approve evidence that has already expired", () => {
    expect(caught(() => move({ to: "approved", actor: "reviewer", current: record("under_review", { issuedOn: "2026-09-01" }) }))).toMatchObject({
      code: "precondition_failed",
      message: "Bank export permit expired on 2026-10-01. Ask for a current one.",
    });
  });

  it("approves a type with no validity period without an expiry date", () => {
    const result = transitionEvidence({ type: phyto, current: { type: phyto.id, status: "under_review" }, to: "approved", actor: "reviewer", asOf });
    expect(result.record).toEqual({ type: phyto.id, status: "approved", issuedOn: null, validUntil: null });
  });

  it("never lets CLEAR approve or reject a type that needs a human reviewer", () => {
    const current = { type: phyto.id, status: "under_review" } as const;
    for (const to of ["approved", "rejected"] as const) {
      expect(caught(() => transitionEvidence({ type: phyto, current, to, actor: "system", asOf, note: "Bad scan" }))).toMatchObject({
        code: "forbidden",
        message: expect.stringContaining("Phytosanitary certificate needs a human reviewer. Automated checks can pre-validate it"),
      });
    }
    // Pre-validation can still send it back for changes.
    expect(transitionEvidence({ type: phyto, current, to: "changes_required", actor: "system", asOf, note: "Unreadable" }).action).toBe(
      "request_changes",
    );
  });

  it("lets CLEAR approve and reject what it can check itself", () => {
    const current = { type: priceCheck.id, status: "under_review" } as const;
    expect(transitionEvidence({ type: priceCheck, current, to: "approved", actor: "system", asOf }).action).toBe("approve");
    expect(transitionEvidence({ type: priceCheck, current, to: "rejected", actor: "system", asOf, note: "Below minimum" }).action).toBe(
      "reject",
    );
  });

  it("keeps SMEs and facilitators out of decisions", () => {
    for (const actor of ["owner", "member", "facilitator"] as const) {
      for (const to of ["approved", "changes_required", "rejected"] as const) {
        expect(caught(() => move({ to, actor, current: underReview, note: "x" })).code).toBe("forbidden");
      }
    }
  });

  it("asks for changes or rejects with a note saying what is wrong", () => {
    expect(move({ to: "changes_required", actor: "reviewer", current: underReview, note: " Stamp missing " })).toEqual({
      action: "request_changes",
      from: "under_review",
      record: { ...underReview, status: "changes_required" },
      note: "Stamp missing",
    });
    expect(move({ to: "rejected", actor: "admin", current: underReview, note: "Wrong document" }).action).toBe("reject");
    for (const to of ["changes_required", "rejected"] as const) {
      expect(caught(() => move({ to, actor: "reviewer", current: underReview }))).toMatchObject({
        code: "precondition_failed",
        message: "Add a note saying what is wrong with Bank export permit.",
      });
    }
  });

  it("does not reopen a decision", () => {
    for (const from of ["changes_required", "rejected"] as const) {
      for (const to of ["under_review", "approved"] as const) {
        expect(caught(() => move({ to, actor: "admin", current: record(from) })).code).toBe("invalid_transition");
      }
    }
  });
});

describe("transitionEvidence: expire", () => {
  const approved = record("approved", { issuedOn: "2026-09-21", validUntil: "2026-10-21" });

  it("lets CLEAR record the expiry once the last valid day has passed", () => {
    expect(move({ to: "expired", actor: "system", current: approved })).toEqual({
      action: "expire",
      from: "approved",
      record: { ...approved, status: "expired" },
      note: null,
    });
  });

  it("refuses before then, or without an expiry date", () => {
    expect(caught(() => move({ to: "expired", actor: "system", current: { ...approved, validUntil: "2026-10-22" } }))).toMatchObject({
      code: "precondition_failed",
      message: "Bank export permit is valid until 2026-10-22.",
    });
    expect(caught(() => move({ to: "expired", actor: "system", current: record("approved") }))).toMatchObject({
      code: "precondition_failed",
      message: "Bank export permit has no expiry date.",
    });
  });

  it("is only CLEAR's to record, and only for approved evidence", () => {
    for (const actor of ["owner", "member", "admin", "facilitator", "reviewer"] as const) {
      expect(caught(() => move({ to: "expired", actor, current: approved })).code).toBe("forbidden");
    }
    expect(caught(() => move({ to: "expired", actor: "system", current: record("under_review") })).code).toBe("invalid_transition");
    expect(caught(() => move({ to: "expired", actor: "system", current: record("expired") })).code).toBe("invalid_transition");
  });
});

describe("evidenceValidUntil", () => {
  it("counts the validity period from the day after issue", () => {
    expect(evidenceValidUntil(permit, "2026-10-01")).toBe("2026-10-31");
    expect(evidenceValidUntil(permit, "2026-12-15")).toBe("2027-01-14");
    expect(evidenceValidUntil(permit, "2028-02-01")).toBe("2028-03-02");
  });

  it("keeps evidence valid through its last day and expired the day after", () => {
    const approved = record("approved", { validUntil: evidenceValidUntil(permit, "2026-10-01") });
    expect(evidenceStatusOn(approved, "2026-10-31")).toBe("approved");
    expect(evidenceStatusOn(approved, "2026-11-01")).toBe("expired");
  });

  it("is null for a type with no validity period", () => {
    expect(evidenceValidUntil(phyto, "2026-10-01")).toBeNull();
  });

  it("rejects a date that does not exist", () => {
    expect(() => evidenceValidUntil(permit, "2026-13-01")).toThrow(RangeError);
  });
});

// Not every status pair is listed above; these check the unlisted ones fail closed.
describe("unlisted transitions", () => {
  it("rejects every step status pair with no row", () => {
    const statuses: RecordedStatus[] = [...TASK_STATUSES, "completed", "not_applicable"];
    for (const milestone of [false, true]) {
      const id: StepId = milestone ? "STEP-007" : "STEP-001";
      for (const from of statuses) {
        for (const to of statuses) {
          const listed = STEP_TRANSITIONS.some((r) => r.milestone === milestone && r.from.includes(from) && r.to.includes(to));
          if (listed || from === to) continue;
          const s = step(id, { ...phaseDone, steps: { ...phaseDone.steps, [id]: recorded(from, "Reason") } });
          // The engine ignores a not-applicable mark on a milestone, so there is no such step to move.
          if (s.status !== from) continue;
          expect(caught(() => transitionStep(s, { to, actor: "admin", reason: "Reason" })).code, `${id} ${from} > ${to}`).toBe(
            "invalid_transition",
          );
        }
      }
    }
  });
});
