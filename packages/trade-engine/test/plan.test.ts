import { describe, expect, it } from "vitest";
import { assignPathway, buildLearningPlan, scoreDomains } from "../src";
import { answers, noShipment, order, planFor, rules, setAll } from "./helpers";

const BUYER = ["B1", "B2", "B3", "B4", "B5"];
const FINANCIAL = ["C1", "C2", "C3", "C4", "C5", "C6"];
// A finance gap that leaves C4 alone, because C4 also counts toward operations.
const FINANCE_GAP = setAll(["C1", "C2", "C3", "C5", "C6"], 1);
const entry = (plan: ReturnType<typeof planFor>["plan"], module: string) => plan.modules.find((m) => m.module === module);
const reasons = (plan: ReturnType<typeof planFor>["plan"], module: string) => [...(entry(plan, module)?.reasonCodes ?? [])].sort();

describe("the placement spec's three SME profiles", () => {
  it("Case A, a first-time exporter with a product and no buyer: M01, M05, M06, M03, M11, M12", () => {
    const given = answers({
      A1: "never",
      A2: "none",
      A3: "0",
      A4: "product_only",
      A4a: "Green coffee",
      ...setAll(BUYER, 1),
      ...setAll(["E1", "E2", "E5", "E6"], 1),
      ...setAll(FINANCIAL, 1),
      // Operations shares C4 with finance, so keep its other questions strong.
      G1: 3,
      G2: 3,
    });
    const { plan, assignment } = planFor(given);
    expect(assignment.pathway).toBe("A");
    expect(order(plan)).toEqual(["M01", "M05", "M06", "M03", "M11", "M12"]);
    expect(plan.modules.map((m) => m.status)).toEqual(Array(6).fill("required"));
    expect(reasons(plan, "M05")).toEqual(["GAP_BUYER", "NO_QUALIFIED_BUYER"]);
    expect(plan.requiresHumanReview).toBe(false);
  });

  it("Case B, a confirmed order with no working capital and freight not costed: M04, M06 and M08 as priority, then M03", () => {
    const given = answers({
      A1: "preparing_first_export",
      A2: "order_confirmed",
      A3: "0",
      A5: ["purchase_order_or_contract"],
      C5: 0,
      C6: 1,
      E2: 0,
    });
    const { plan, assignment } = planFor(given, { liveOrder: false });
    // The first-time exporter stays on Pathway A, and the order is read from A2.
    expect(assignment.pathway).toBe("A");
    expect(order(plan)).toEqual(["M01", "M04", "M06", "M08", "M03", "M11", "M12"]);
    expect(plan.modules.map((m) => m.status)).toEqual([
      "required",
      "priority_required",
      "priority_required",
      "priority_required",
      "required",
      "required",
      "required",
    ]);
    expect(reasons(plan, "M06")).toEqual(["GAP_COSTING", "LIVE_ORDER"]);
    expect(reasons(plan, "M03")).toEqual(["GAP_FINANCIAL"]);
    expect(plan.pathway).toBe("A");
  });

  it("Case C, a regular exporter with margin leakage and weak receivables tracking: M02, M03, M06, M10", () => {
    const given = answers({
      A1: "regular_exports",
      A3: "2_to_3",
      A5: ["shipment_record"],
      E5: 0,
      E6: 1,
      F3: 1,
      C2: 1,
      C3: 1,
    });
    const { plan, assignment } = planFor(given, { lastShipmentDate: "2026-09-01", shipmentVerified: true }, { recordsVerified: false });
    expect(assignment).toMatchObject({ pathway: "B", provisional: false });
    expect(order(plan)).toEqual(["M01", "M02", "M03", "M06", "M10", "M11", "M12"]);
    expect(reasons(plan, "M02")).toEqual(["GAP_DIGITAL", "RECORDS_BEFORE_FINANCE"]);
    expect(reasons(plan, "M03")).toEqual(["GAP_FINANCIAL", "RECORDS_BEFORE_FINANCE"]);
    expect(reasons(plan, "M10")).toEqual(["HAS_EXPORTED_RETENTION"]);
  });
});

describe("buildLearningPlan", () => {
  it("always has M01, M11 and M12, with a reason for every module and contiguous sequence numbers", () => {
    const { plan } = planFor(answers());
    expect(order(plan)).toEqual(["M01", "M11", "M12"]);
    expect(plan.modules.map((m) => m.sequence)).toEqual([1, 2, 3]);
    expect(reasons(plan, "M01")).toEqual(["REQUIRED_ALL"]);
    expect(reasons(plan, "M11")).toEqual(["REQUIRED_ALL"]);
    expect(reasons(plan, "M12")).toEqual(["REQUIRED_TO_GRADUATE"]);
    expect(plan.modules.every((m) => m.reasonCodes.length > 0)).toBe(true);
  });

  it("gives 'assessment needed' for a missing score and never 'required'", () => {
    const partial = Object.fromEntries(Object.entries(answers()).filter(([id]) => !BUYER.includes(id)));
    const { plan } = planFor(partial);
    expect(entry(plan, "M05")).toMatchObject({ status: "assessment_needed", reasonCodes: ["ASSESSMENT_NEEDED"] });
    // 'Not known' is missing, not zero: the buyer group has too few valid answers to score.
    const unknown = planFor(answers(setAll(BUYER, "not_known"))).plan;
    expect(entry(unknown, "M05")).toMatchObject({ status: "assessment_needed" });
    // A real zero is a gap.
    expect(entry(planFor(answers(setAll(BUYER, 0))).plan, "M05")).toMatchObject({ status: "required", reasonCodes: ["GAP_BUYER"] });
  });

  it("assigns a module below 60 and not at 60", () => {
    // 8 of 15 is 53.33; 9 of 15 is 60.
    const buyerAt = (points: number) => Object.fromEntries(BUYER.map((id, i) => [id, Math.max(0, Math.min(3, points - i * 3))]));
    expect(order(planFor(answers(buyerAt(8))).plan)).toContain("M05");
    expect(order(planFor(answers(buyerAt(9))).plan)).not.toContain("M05");
  });

  it("offers a test-out at 80 and above, after the modules the SME has to take", () => {
    const { plan } = planFor(answers({ ...setAll(BUYER, 3), F4: 3, ...FINANCE_GAP }));
    expect(plan.modules.map((m) => [m.module, m.status])).toEqual([
      ["M01", "required"],
      ["M03", "required"],
      ["M11", "required"],
      ["M12", "required"],
      ["M05", "optional"],
      ["M09", "optional"],
    ]);
    expect(reasons(plan, "M05")).toEqual(["TEST_OUT_OFFERED"]);
    expect(plan.modules.map((m) => m.sequence)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("moves M04, M06 and M08 straight after M01 for any live-order stage", () => {
    for (const A2 of ["order_confirmed", "shipment_underway", "shipped_awaiting_payment"]) {
      const { plan } = planFor(answers({ A2, A5: ["purchase_order_or_contract"], ...setAll(BUYER, 0) }));
      expect(order(plan).slice(0, 4)).toEqual(["M01", "M04", "M06", "M08"]);
      expect(plan.modules.slice(1, 4).every((m) => m.status === "priority_required")).toBe(true);
    }
    // A quotation isn't an order: M06 is required but nothing jumps the queue.
    const quoted = planFor(answers({ A2: "quotation_sent", ...setAll(BUYER, 0) })).plan;
    expect(order(quoted)).toEqual(["M01", "M05", "M06", "M11", "M12"]);
    expect(entry(quoted, "M06")).toMatchObject({ status: "required", reasonCodes: ["ACTIVE_QUOTATION"] });
    expect(entry(quoted, "M04")).toBeUndefined();
  });

  it("uses the live-order flag from the diagnostic as well as the placement answers", () => {
    const { plan } = planFor(answers(), { liveOrder: true });
    expect(order(plan)).toEqual(["M01", "M04", "M06", "M08", "M11", "M12"]);
  });

  it("puts the records module before the finance module, after any live-order modules", () => {
    const given = answers({ A2: "order_confirmed", A5: ["purchase_order_or_contract"], ...FINANCE_GAP });
    expect(order(planFor(given, {}, { recordsVerified: false }).plan)).toEqual(["M01", "M04", "M06", "M08", "M02", "M03", "M11", "M12"]);
    // Records verified, or not known: no prerequisite.
    expect(order(planFor(given, {}, { recordsVerified: true }).plan)).not.toContain("M02");
    expect(order(planFor(given, {}).plan)).not.toContain("M02");
    // No finance module, no prerequisite.
    expect(order(planFor(answers(), {}, { recordsVerified: false }).plan)).toEqual(["M01", "M11", "M12"]);
  });

  it("assigns M05 to an SME with no qualified buyer yet, but not once an inquiry is in", () => {
    expect(entry(planFor(answers({ A3: "0", A2: "buyer_contacted" })).plan, "M05")).toMatchObject({ reasonCodes: ["NO_QUALIFIED_BUYER"] });
    expect(entry(planFor(answers({ A3: "0", A2: "inquiry_received" })).plan, "M05")).toBeUndefined();
    expect(entry(planFor(answers({ A3: "1", A2: "none" })).plan, "M05")).toBeUndefined();
  });

  it("assigns M10 to an SME that has exported unless its buyer score is 80 or more", () => {
    const exported = { A1: "occasional_exports", A5: ["shipment_record"] };
    expect(entry(planFor(answers(exported)).plan, "M10")).toMatchObject({ status: "required", reasonCodes: ["HAS_EXPORTED_RETENTION"] });
    expect(entry(planFor(answers({ ...exported, ...setAll(BUYER, 3) })).plan, "M10")).toBeUndefined();
    expect(entry(planFor(answers({ ...exported, ...setAll(BUYER, "not_known") })).plan, "M10")).toMatchObject({ status: "required" });
    expect(entry(planFor(answers({ A1: "preparing_first_export" })).plan, "M10")).toBeUndefined();
  });

  it("sends a provisional pathway, a conflict or an unapproved 'not applicable' to staff review", () => {
    expect(planFor(answers()).plan).toMatchObject({ requiresHumanReview: false, reviewReasons: [] });
    const provisional = planFor(answers({ A1: "regular_exports" }), { lastShipmentDate: "2026-05-01" }).plan;
    expect(provisional).toMatchObject({ requiresHumanReview: true, reviewReasons: ["provisional_pathway"] });
    const conflict = planFor(answers({ A1: "never", A5: ["shipment_record"] })).plan;
    expect(conflict.reviewReasons).toEqual(["shipment_evidence_contradicts_history"]);
    const pending = planFor(answers({ B1: "not_applicable" })).plan;
    expect(pending.reviewReasons).toEqual(["not_applicable_pending"]);
    const all = planFor(
      answers({ A2: "order_confirmed", A5: ["not_available"], B1: "not_applicable" }),
      { lastShipmentDate: "2026-05-01" },
    ).plan;
    expect(all.reviewReasons).toEqual(["provisional_pathway", "not_applicable_pending", "order_without_evidence"]);
  });

  it("gives the same plan for the same input, and records the rules version and pathway", () => {
    const given = answers({ A2: "order_confirmed", A5: ["purchase_order_or_contract"], E2: 0 });
    const first = planFor(given).plan;
    expect(JSON.stringify(first)).toBe(JSON.stringify(planFor(given).plan));
    expect(first).toMatchObject({ rulesVersion: "0.2.0", pathway: "A" });
  });

  it("refuses scores or a pathway made with other rules", () => {
    const assignment = assignPathway(rules, noShipment);
    const scores = scoreDomains(rules, { answers: answers() });
    expect(() => buildLearningPlan(rules, { answers: answers(), scores: { ...scores, rulesVersion: "0.1.0" }, pathway: assignment })).toThrow(/other rules/);
    expect(() => buildLearningPlan(rules, { answers: answers(), scores, pathway: { ...assignment, rulesVersion: "0.1.0" } })).toThrow(/other rules/);
  });
});
