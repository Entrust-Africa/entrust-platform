import type { StepDefinition } from "@entrust/rules";
import { describe, expect, it } from "vitest";
import { evaluateCase, evaluateCondition } from "../src";
import type { CaseState } from "../src";

// A small workflow, independent of the canonical data, to pin down the engine's rules.
const base = { owner: "sme", authority: null, scope: "shipment", masterControl: "MC-01", evidence: [] } as const;
const STEPS: StepDefinition[] = [
  { ...base, id: "STEP-001", phase: 1, name: "Capture facts", class: "mandatory", prerequisites: [] },
  {
    ...base,
    id: "STEP-002",
    phase: 1,
    name: "Book container",
    class: "conditional",
    prerequisites: ["STEP-001"],
    appliesWhen: { condition: { fact: "transportMode", in: ["sea"] }, description: "Ships by sea" },
  },
  {
    ...base,
    id: "STEP-003",
    phase: 1,
    name: "Get permit",
    class: "mandatory",
    prerequisites: ["STEP-002"],
    evidence: [{ type: "bank_export_permit" }],
  },
  { ...base, id: "STEP-004", phase: 1, name: "Handle failure", class: "exception", prerequisites: [], raisedWhen: "Something fails." },
  { ...base, id: "STEP-005", phase: 1, name: "Phase 1 sign-off", class: "mandatory", prerequisites: [], milestone: true },
  { ...base, id: "STEP-006", phase: 2, name: "Ship", class: "mandatory", prerequisites: ["STEP-003"] },
  { ...base, id: "STEP-007", phase: 2, name: "Phase 2 sign-off", class: "mandatory", prerequisites: [], milestone: true },
];

const state = (overrides: Partial<CaseState> = {}): CaseState => ({
  facts: {},
  steps: {},
  evidence: [],
  raisedExceptions: [],
  ...overrides,
});

const asOf = "2026-10-22";
const run = (s: CaseState, steps: StepDefinition[] = STEPS) => evaluateCase(steps, s, { asOf });
const step = (result: ReturnType<typeof run>, id: string) => {
  const found = result.steps.find((s) => s.id === id);
  if (!found) throw new Error(`no ${id}`);
  return found;
};

describe("evaluateCondition", () => {
  it("is unknown until the fact is recorded", () => {
    expect(evaluateCondition({ fact: "transportMode", in: ["sea"] }, {})).toBeUndefined();
    expect(evaluateCondition({ fact: "transportMode", in: ["sea"] }, { transportMode: "" })).toBeUndefined();
    expect(evaluateCondition({ fact: "paymentTerms", in: ["cad"] }, { paymentTerms: [] })).toBeUndefined();
  });

  it("matches any value of a multi-valued fact", () => {
    expect(evaluateCondition({ fact: "paymentTerms", in: ["cad"] }, { paymentTerms: ["advance_tt", "cad"] })).toBe(true);
    expect(evaluateCondition({ fact: "paymentTerms", in: ["lc"] }, { paymentTerms: ["advance_tt", "cad"] })).toBe(false);
  });

  it("uses three-valued logic for all, any and not", () => {
    const sea = { fact: "transportMode", in: ["sea"] } as const;
    const us = { fact: "destinationCountry", in: ["US"] } as const;
    expect(evaluateCondition({ all: [sea, us] }, { transportMode: "air" })).toBe(false);
    expect(evaluateCondition({ all: [sea, us] }, { transportMode: "sea" })).toBeUndefined();
    expect(evaluateCondition({ any: [sea, us] }, { destinationCountry: "US" })).toBe(true);
    expect(evaluateCondition({ any: [sea, us] }, { destinationCountry: "DE" })).toBeUndefined();
    expect(evaluateCondition({ not: sea }, { transportMode: "air" })).toBe(true);
    expect(evaluateCondition({ not: sea }, {})).toBeUndefined();
  });
});

describe("evaluateCase", () => {
  it("marks a conditional step not applicable, with the reason, when its condition fails", () => {
    const result = run(state({ facts: { transportMode: "air" } }));
    const container = step(result, "STEP-002");
    expect(container.status).toBe("not_applicable");
    expect(container.derived).toBe(true);
    expect(container.reason).toContain("Ships by sea");
  });

  it("treats a step as undetermined while its fact is unknown, and blocks what depends on it", () => {
    const result = run(state({ steps: { "STEP-001": { status: "completed" } } }));
    expect(step(result, "STEP-002").status).toBe("undetermined");
    expect(step(result, "STEP-003").status).toBe("blocked");
    expect(step(result, "STEP-003").blockedBy).toEqual(["STEP-002"]);
  });

  it("blocks a step until its prerequisites are complete or not applicable", () => {
    const before = run(state({ facts: { transportMode: "sea" } }));
    expect(step(before, "STEP-002").status).toBe("blocked");
    expect(step(before, "STEP-002").reason).toBe("Waiting on STEP-001.");
    expect(step(before, "STEP-002").canComplete).toBe(false);

    const after = run(state({ facts: { transportMode: "air" }, steps: { "STEP-001": { status: "completed" } } }));
    expect(step(after, "STEP-003").blockedBy).toEqual([]);
    expect(step(after, "STEP-003").status).toBe("not_started");
  });

  it("only lets approved, in-date evidence satisfy a requirement", () => {
    const facts = { transportMode: "air" } as const;
    const done = { "STEP-001": { status: "completed" } } as const;
    const permit = (status: "submitted" | "approved", validUntil?: string) =>
      run(state({ facts, steps: done, evidence: [{ type: "bank_export_permit", status, validUntil }] }));

    expect(step(permit("submitted"), "STEP-003").canComplete).toBe(false);
    expect(step(permit("submitted"), "STEP-003").missingEvidence).toEqual(["bank_export_permit"]);
    expect(step(permit("approved", "2026-10-22"), "STEP-003").canComplete).toBe(true);
    const expired = step(permit("approved", "2026-10-21"), "STEP-003");
    expect(expired.canComplete).toBe(false);
    expect(expired.evidence[0]?.status).toBe("expired");
  });

  it("requires a reason to mark a step not applicable", () => {
    const withReason = run(state({ steps: { "STEP-001": { status: "not_applicable", reason: "Done by the buyer" } } }));
    expect(step(withReason, "STEP-001").status).toBe("not_applicable");
    expect(step(withReason, "STEP-001").reason).toBe("Done by the buyer");

    const without = run(state({ steps: { "STEP-001": { status: "not_applicable", reason: " " } } }));
    expect(step(without, "STEP-001").status).toBe("not_started");
    expect(step(without, "STEP-001").warnings).toHaveLength(1);
  });

  it("only applies an exception step once it is raised", () => {
    expect(step(run(state()), "STEP-004").status).toBe("not_applicable");
    const raised = run(state({ raisedExceptions: ["STEP-004"] }));
    expect(step(raised, "STEP-004").status).toBe("not_started");
    expect(raised.nextAction).toMatchObject({ stepId: "STEP-004", kind: "resolve_exception" });
  });

  it("closes a phase gate only when every applicable step is complete with approved evidence", () => {
    const facts = { transportMode: "air" } as const;
    const steps = { "STEP-001": { status: "completed" }, "STEP-003": { status: "completed" } } as const;

    const unapproved = run(state({ facts, steps, evidence: [{ type: "bank_export_permit", status: "submitted" }] }));
    expect(unapproved.phases[0]).toMatchObject({ status: "open", outstanding: [{ stepId: "STEP-003" }] });
    expect(step(unapproved, "STEP-005").status).toBe("blocked");

    const approved = run(state({ facts, steps, evidence: [{ type: "bank_export_permit", status: "approved" }] }));
    expect(approved.phases[0]).toMatchObject({ status: "ready", outstanding: [] });
    expect(approved.nextAction).toMatchObject({ stepId: "STEP-005", kind: "sign_off" });

    const locked = run(
      state({
        facts,
        steps: { ...steps, "STEP-005": { status: "completed" } },
        evidence: [{ type: "bank_export_permit", status: "approved" }],
      }),
    );
    expect(locked.phases[0]?.status).toBe("locked");
  });

  it("recommends the first open step in sequence", () => {
    expect(run(state()).nextAction).toMatchObject({ stepId: "STEP-001", kind: "complete" });

    const determine = run(state({ steps: { "STEP-001": { status: "completed" } } }));
    expect(determine.nextAction).toMatchObject({ stepId: "STEP-002", kind: "determine" });

    const evidence = run(
      state({
        facts: { transportMode: "air" },
        steps: { "STEP-001": { status: "completed" } },
        evidence: [{ type: "bank_export_permit", status: "under_review" }],
      }),
    );
    expect(evidence.nextAction).toMatchObject({ stepId: "STEP-003", kind: "review_evidence" });
  });

  it("warns when a completed step's prerequisites are no longer done", () => {
    const result = run(state({ facts: { transportMode: "sea" }, steps: { "STEP-002": { status: "completed" } } }));
    expect(step(result, "STEP-002").status).toBe("completed");
    expect(step(result, "STEP-002").warnings[0]).toContain("STEP-001");
  });

  it("rejects unknown prerequisites and cycles", () => {
    const unknown = STEPS.map((s) => (s.id === "STEP-001" ? { ...s, prerequisites: ["STEP-999" as const] } : s));
    expect(() => run(state(), unknown)).toThrow("Unknown step STEP-999");
    const cycle = STEPS.map((s) => (s.id === "STEP-001" ? { ...s, prerequisites: ["STEP-003" as const] } : s));
    expect(() => run(state(), cycle)).toThrow("Prerequisite cycle");
  });
});
