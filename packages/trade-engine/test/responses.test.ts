import { describe, expect, it } from "vitest";
import { validateResponses, visibleQuestions } from "../src";
import { answers, rules, rules010 } from "./helpers";

const check = (a: Record<string, unknown>, submit = true) => validateResponses(rules, a as never, { submit });
const codes = (a: Record<string, unknown>, submit = true) => check(a, submit).errors.map((e) => `${e.question}:${e.code}`);

describe("validateResponses", () => {
  it("accepts a complete set of answers", () => {
    expect(check(answers())).toEqual({ errors: [], conflicts: [], ignored: [] });
  });

  it("lets a draft hold only the answers it has, and a submit ask for the rest", () => {
    expect(check({ A1: "never" }, false).errors).toEqual([]);
    const missing = codes({ A1: "never" });
    expect(missing).toContain("A2:missing");
    expect(missing).toContain("G4:missing");
    expect(missing).not.toContain("A1:missing");
  });

  it("counts 'not known' and 'not applicable' as answers", () => {
    expect(codes(answers({ B1: "not_known", B2: "not_applicable" }))).toEqual([]);
  });

  it("keeps A5's 'not available' on its own", () => {
    expect(codes(answers({ A5: ["shipment_record", "not_available"] }))).toEqual(["A5:exclusive_option"]);
    expect(codes(answers({ A5: ["shipment_record", "purchase_order_or_contract"] }))).toEqual([]);
    expect(codes(answers({ A5: ["not_available"] }))).toEqual([]);
  });

  it("refuses answers that don't fit the question", () => {
    expect(codes(answers({ A1: "sometimes" }))).toEqual(["A1:invalid_answer"]);
    expect(codes(answers({ B1: 4 }))).toEqual(["B1:invalid_answer"]);
    expect(codes(answers({ B1: "high" }))).toEqual(["B1:invalid_answer"]);
    expect(codes(answers({ A5: [] }))).toEqual(["A5:invalid_answer"]);
    expect(codes(answers({ A5: ["shipment_record", "shipment_record"] }))).toEqual(["A5:invalid_answer"]);
    expect(codes(answers({ A4: "both_validated", A4a: "  ", A4b: "Kenya", A4c: "wholesaler" }))).toEqual(["A4a:invalid_answer"]);
    expect(codes(answers({ Z9: 1 }))).toEqual(["Z9:unknown_question"]);
  });

  it("asks the product and market questions only when they apply, and ignores their old answers", () => {
    const ids = (a: Record<string, unknown>) => visibleQuestions(rules, a as never).map((q) => q.id);
    expect(ids({ A4: "no" })).not.toContain("A4a");
    expect(ids({ A4: "product_only" })).toEqual(expect.arrayContaining(["A4a"]));
    expect(ids({ A4: "product_only" })).not.toContain("A4b");
    expect(ids({ A4: "market_only" })).toEqual(expect.arrayContaining(["A4b"]));
    expect(ids({ A4: "both_validated" })).toEqual(expect.arrayContaining(["A4a", "A4b", "A4c"]));

    // A4a was answered, then A4 changed to "no": the answer is ignored, not an error, and doesn't block submit.
    const result = check(answers({ A4: "no", A4a: "Coffee" }));
    expect(result.errors).toEqual([]);
    expect(result.ignored).toEqual(["A4a"]);
    // With A4 "product_only", A4a is asked and so is required.
    expect(codes(answers({ A4: "product_only" }))).toEqual(["A4a:missing"]);
  });

  it("sends history that contradicts the evidence to review without blocking it", () => {
    const result = check(answers({ A1: "never", A5: ["shipment_record"] }));
    expect(result.errors).toEqual([]);
    expect(result.conflicts.map((c) => c.code)).toEqual(["shipment_evidence_contradicts_history"]);
    expect(check(answers({ A1: "regular_exports", A5: ["shipment_record"] })).conflicts).toEqual([]);
  });

  it("sends a reported order with no evidence to review", () => {
    expect(check(answers({ A2: "order_confirmed", A5: ["not_available"] })).conflicts.map((c) => c.code)).toEqual(["order_without_evidence"]);
    expect(check(answers({ A2: "order_confirmed", A5: ["purchase_order_or_contract"] })).conflicts).toEqual([]);
    expect(check(answers({ A2: "quotation_sent", A5: ["not_available"] })).conflicts).toEqual([]);
  });

  it("needs rules that have pathway and plan rules", () => {
    expect(() => validateResponses(rules010, answers(), { submit: true })).toThrow(/no pathway and plan rules/);
  });
});
