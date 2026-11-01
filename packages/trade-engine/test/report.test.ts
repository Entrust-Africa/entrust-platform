import { findTradeRules } from "@entrust/trade-rules";
import { describe, expect, it } from "vitest";
import { assignPathway, buildPlacementReport, evaluatePlacement } from "../src";
import type { Answers, PathwayInput } from "../src";
import { answers, noShipment, order, planFor, rules, rules010, setAll } from "./helpers";

const baseline = { organisation: "ZEBU Coffee", smeId: "ET-SME-000001", assessedOn: "2026-11-19", attempt: 1 };
const domain = (id: string) => rules.domains.find((d) => d.id === id)!;

/** Score, plan and report a set of answers. */
function reportFor(a: Answers, pathway: Partial<PathwayInput> = {}, superseded = false) {
  const { assignment, scores, plan } = planFor(a, pathway);
  return buildPlacementReport(rules, { baseline, answers: a, scores, pathway: assignment, plan, superseded });
}

describe("evaluatePlacement", () => {
  const pathway = assignPathway(rules, noShipment);

  it("scores the assessment and generates the plan, with the rules version they used", () => {
    const outcome = evaluatePlacement(rules, { answers: answers(), pathway });
    expect(outcome).toMatchObject({ rulesVersion: "0.2.0", assessmentStatus: "scored", planStatus: "generated" });
    expect(outcome.scores.domains).toHaveLength(6);
    expect(outcome.plan.modules.map((m) => m.module)).toContain("M01");
    expect(outcome.plan.requiresHumanReview).toBe(false);
  });

  it("gives the same outcome for the same answers, pathway and rules version, found by version", () => {
    const first = evaluatePlacement(rules, { answers: answers({ B1: 0 }), pathway });
    const again = evaluatePlacement(findTradeRules(first.rulesVersion)!, { answers: answers({ B1: 0 }), pathway });
    expect(again).toEqual(first);
  });

  it("sends the assessment and the plan to staff when the pathway is provisional", () => {
    const provisional = assignPathway(rules, { ...noShipment, lastShipmentDate: "2026-09-01" });
    expect(provisional.provisional).toBe(true);
    expect(evaluatePlacement(rules, { answers: answers(), pathway: provisional })).toMatchObject({
      assessmentStatus: "review_required",
      planStatus: "review_required",
      plan: { requiresHumanReview: true, reviewReasons: ["provisional_pathway"] },
    });
  });

  it("sends it to staff when answers disagree, and when a \"not applicable\" waits for approval", () => {
    expect(evaluatePlacement(rules, { answers: answers({ A1: "never", A5: ["shipment_record"] }), pathway }).assessmentStatus).toBe("review_required");
    const waiting = evaluatePlacement(rules, { answers: answers({ B1: "not_applicable" }), pathway });
    expect(waiting.plan.reviewReasons).toEqual(["not_applicable_pending"]);
    expect(evaluatePlacement(rules, { answers: answers({ B1: "not_applicable" }), pathway, approvedNotApplicable: ["B1"] }).assessmentStatus).toBe("scored");
  });

  it("refuses answers that aren't a complete, valid submission", () => {
    const { B1: _, ...incomplete } = answers();
    expect(() => evaluatePlacement(rules, { answers: incomplete, pathway })).toThrow(RangeError);
    expect(() => evaluatePlacement(rules, { answers: incomplete, pathway })).toThrow("B1: answer this question before you submit");
    expect(() => evaluatePlacement(rules, { answers: answers({ B1: 7 }), pathway })).toThrow("B1: score 0 to 3");
  });

  it("can't build a plan with rules that have no plan rules", () => {
    expect(() => evaluatePlacement(rules010, { answers: answers(), pathway })).toThrow();
  });
});

describe("the placement report", () => {
  it("names the baseline, the rules version and the pathway in plain words", () => {
    const report = reportFor(answers());
    expect(report).toMatchObject({ rulesVersion: "0.2.0", status: "current", baseline });
    expect(report.pathway).toMatchObject({ id: "A", name: "Export Entry and Readiness", provisional: false, liveOrder: false });
    expect(report.pathway.reasons).toEqual([{ code: "PATHWAY_NO_RECENT_SHIPMENT", text: expect.any(String) }]);
    expect(report.pathway.reasons[0]?.text.length).toBeGreaterThan(10);
  });

  it("gives each of the six domains its score, band, coverage and evidence status", () => {
    const report = reportFor(answers());
    expect(report.domains.map((d) => d.id)).toEqual(rules.domains.map((d) => d.id));
    expect(report.domains[0]).toMatchObject({
      title: domain("buyer_development").title,
      score: 66.67,
      band: "functional",
      bandLabel: "Functional",
      coverage: 100,
      answered: 5,
      total: 5,
      evidence: "self_reported",
      evidenceLabel: "Self-reported",
    });
    expect(report.domains[0]?.guidance).toBe(rules.bands.find((b) => b.id === "functional")?.action);
  });

  it("reports a domain without enough answers as unscored, never as zero", () => {
    const buyer = domain("buyer_development").questions;
    const report = reportFor(answers(setAll(buyer, "not_known")));
    expect(report.domains[0]).toMatchObject({ score: null, band: null, bandLabel: null, guidance: null, coverage: 0, answered: 0, total: 5 });
    expect(report.plan.modules.find((m) => m.status === "assessment_needed")?.statusLabel).toBe("More answers needed");
  });

  it("puts a gap in the plan with the reason in the words of the rules", () => {
    const report = reportFor(answers(setAll(domain("buyer_development").questions, 0)));
    const m05 = report.plan.modules.find((m) => m.module === "M05");
    expect(m05).toMatchObject({ status: "required", statusLabel: "Required" });
    const gap = rules.reasonCodes.find((r) => r.code === "GAP_BUYER")!;
    expect(m05?.reasons).toContainEqual({ code: "GAP_BUYER", text: gap.text });
  });

  it("gives every module in the plan an order, a title and at least one reason with its code (pilot criterion 6)", () => {
    const report = reportFor(answers(setAll(domain("buyer_development").questions, 0)));
    expect(report.plan.modules.map((m) => m.sequence)).toEqual(report.plan.modules.map((_, i) => i + 1));
    for (const m of report.plan.modules) {
      expect(m.title, m.module).toBeTruthy();
      expect(m.reasons.length, m.module).toBeGreaterThan(0);
      for (const r of m.reasons) expect(r.text, `${m.module} ${r.code}`).toBeTruthy();
    }
    expect(report.plan.modules[0]).toMatchObject({ module: "M01", sequence: 1 });
    expect(report.rulesVersion).toBe("0.2.0");
  });

  it("puts M04, M06 and M08 first for a live order, and says why (pilot criterion 5)", () => {
    const report = reportFor(answers({ A2: "order_confirmed", A5: ["purchase_order_or_contract"] }));
    expect(report.pathway).toMatchObject({ id: "A", liveOrder: true });
    expect(report.plan.modules.slice(0, 4).map((m) => m.module)).toEqual(["M01", "M04", "M06", "M08"]);
    for (const m of report.plan.modules.slice(1, 4)) {
      expect(m.status).toBe("priority_required");
      expect(m.statusLabel).toMatch(/live order/);
      expect(m.reasons.map((r) => r.code)).toContain("LIVE_ORDER");
    }
  });

  it("tells the SME why staff will look at the plan, in plain words", () => {
    const report = reportFor(answers({ A1: "never", A5: ["shipment_record"] }), { lastShipmentDate: "2026-09-01" });
    expect(report.plan.requiresStaffReview).toBe(true);
    expect(report.plan.reviewNotes).toEqual([
      expect.stringMatching(/Staff will confirm it against a shipment record/),
      expect.stringMatching(/Staff will check which is right/),
    ]);
    expect(reportFor(answers()).plan).toMatchObject({ requiresStaffReview: false, reviewNotes: [] });
  });

  it("gives the commercial objectives from A2 and A4", () => {
    const report = reportFor(
      answers({ A2: "quotation_sent", A4: "both_validated", A4a: "Washed Sidamo coffee", A4b: "Germany", A4c: "Specialty roaster", A5: ["buyer_inquiry_or_quotation"] }),
    );
    expect(report.objectives).toEqual({
      opportunity: { value: "quotation_sent", label: "Quotation sent" },
      target: { status: { value: "both_validated", label: "Both validated" }, product: "Washed Sidamo coffee", market: "Germany", buyerType: "Specialty roaster" },
    });
  });

  it("leaves out the target details the SME wasn't asked for", () => {
    const report = reportFor(answers({ A4: "no" }));
    expect(report.objectives.target).toEqual({ status: { value: "no", label: "No" }, product: null, market: null, buyerType: null });
    expect(report.objectives.opportunity).toEqual({ value: "none", label: "None" });
  });

  it("marks an old report superseded and still builds it", () => {
    expect(reportFor(answers(), {}, true).status).toBe("superseded");
  });

  it("is the same every time it is built from the same stored result", () => {
    const a = answers({ C1: 0 });
    expect(reportFor(a)).toEqual(reportFor(a));
  });

  it("refuses scores, a pathway and a plan made with other rules", () => {
    const { assignment, scores, plan } = planFor(answers());
    expect(() => buildPlacementReport(rules010, { baseline, answers: answers(), scores, pathway: assignment, plan })).toThrow("other rules than 0.1.0");
  });

  it("lists the modules in the same order as the plan", () => {
    const a = answers(setAll(domain("buyer_development").questions, 0));
    const { plan } = planFor(a);
    expect(reportFor(a).plan.modules.map((m) => m.module)).toEqual(order(plan));
  });
});
