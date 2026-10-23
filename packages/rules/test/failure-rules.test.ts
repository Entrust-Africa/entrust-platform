import { describe, expect, it } from "vitest";
import { FAILURE_RULES, FAILURE_RULE_IDS, STEPS, validateFailureRules } from "../src";

describe("failure rules", () => {
  it("define FL-01 to FL-14 once each, in order", () => {
    expect(FAILURE_RULES.map((r) => r.id)).toEqual([...FAILURE_RULE_IDS]);
  });

  it("only raise exception steps and only hold steps that exist", () => {
    expect(validateFailureRules(FAILURE_RULES, STEPS)).toEqual([]);
  });

  it("catches a rule that raises a mandatory step, holds a missing one, or is defined twice", () => {
    const [first] = FAILURE_RULES;
    if (!first) throw new Error("no rules");
    const errors = validateFailureRules(
      [{ ...first, raises: ["STEP-001"], blocks: ["STEP-999"] }, first, { ...first, id: "FL-02", origin: "proposed" }],
      STEPS,
    );
    expect(errors).toEqual(expect.arrayContaining([
      "FL-01: raises STEP-001, which is a mandatory step, not an exception step",
      "FL-01: blocks unknown step STEP-999",
      "FL-01: duplicate rule",
      "FL-02: a proposed rule names the failure point it comes from",
      "FL-03: not defined",
    ]));
  });

  it("keep Entrust's eight apart from the six we propose", () => {
    const origin = (id: string) => FAILURE_RULES.find((r) => r.id === id)?.origin;
    expect(FAILURE_RULES.filter((r) => r.origin === "matrix").map((r) => r.id)).toEqual(
      ["FL-01", "FL-02", "FL-03", "FL-04", "FL-05", "FL-06", "FL-07", "FL-08"],
    );
    expect(origin("FL-09")).toBe("proposed");
    // The Register points the issue names for them.
    expect(FAILURE_RULES.filter((r) => r.origin === "proposed").map((r) => r.basis)).toEqual(
      ["FP-05", "FP-06", "FP-09", "FP-10", "FP-11", "FP-12"],
    );
  });

  it("use the severities Entrust's matrix gives FL-01 to FL-08", () => {
    const severities = Object.fromEntries(FAILURE_RULES.slice(0, 8).map((r) => [r.id, r.severity]));
    expect(severities).toEqual({
      "FL-01": "high", "FL-02": "critical", "FL-03": "high", "FL-04": "critical",
      "FL-05": "high", "FL-06": "high", "FL-07": "medium", "FL-08": "critical",
    });
  });

  it("raise the exception steps whose raisedWhen names the rule", () => {
    const named = (id: string) => STEPS.filter((s) => s.class === "exception" && s.raisedWhen?.includes(`(${id})`)).map((s) => s.id);
    for (const rule of FAILURE_RULES.slice(0, 8)) {
      for (const step of named(rule.id)) {
        // FL-06's exception (STEP-111) is raised when the bank reports discrepancies, not by our own comparison.
        if (rule.id !== "FL-06") expect(rule.raises, `${rule.id} should raise ${step}`).toContain(step);
      }
    }
  });
});
