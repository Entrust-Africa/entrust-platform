import { describe, expect, it } from "vitest";
import { MODULE_IDS, REASON_CODES, TRADE_RULES, compareVersions, findTradeRules, latestTradeRules, validateTradeRules } from "../src";
import type { ModuleDefinition, ModuleId, Question, TradeRules } from "../src";

const rules = findTradeRules("0.1.0") as TradeRules;
const errorsFor = (...versions: TradeRules[]) => validateTradeRules(versions);

/** The rules with part of them changed, for the validator to catch. */
const changed = (change: Partial<TradeRules>): TradeRules => ({ ...rules, ...change });
const withModule = (id: ModuleId, change: Partial<ModuleDefinition>): TradeRules =>
  changed({ modules: rules.modules.map((m) => (m.id === id ? { ...m, ...change } : m)) });
const withQuestion = (id: string, change: Partial<Question>): TradeRules =>
  changed({ template: { ...rules.template, questions: rules.template.questions.map((q) => (q.id === id ? { ...q, ...change } : q)) } });
const question = (id: string) => rules.template.questions.find((q) => q.id === id) as Question;

// The content of every published version. Every score and plan stores the rules version it used, so a
// published version must not change: put a correction in a new version instead. Add a line here when a
// version is published.
const PUBLISHED: Record<string, string> = {
  "0.1.0": "37630a728b9b9599a5e8e02b603e04b5d4a877fdf99b8a264913f31792c7ea36",
  "0.2.0": "6e65eecb07fa651732172de7e04cbc41603922c23c346ff951c41c02e0b3900c",
};

describe("TRADE rules", () => {
  it("all validate", () => {
    expect(errorsFor(...TRADE_RULES)).toEqual([]);
  });

  it("never change once published", async () => {
    const sha256 = async (text: string) =>
      [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)))]
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    const hashes = Object.fromEntries(await Promise.all(TRADE_RULES.map(async (r) => [r.version, await sha256(JSON.stringify(r))])));
    expect(hashes).toEqual(PUBLISHED);
  });

  it("finds a version, and the newest one", () => {
    expect(findTradeRules("0.1.0")).toBe(rules);
    expect(findTradeRules("9.9.9")).toBeUndefined();
    expect(latestTradeRules().version).toBe("0.2.0");
    expect(compareVersions("0.10.0", "0.9.0")).toBeGreaterThan(0);
    expect(compareVersions("1.0.0", "1.0.0")).toBe(0);
    expect(errorsFor(rules, { ...rules, version: "0.10.0" })).toEqual([]);
    expect(errorsFor(rules, rules)).toContain("0.1.0: published twice");
    expect(errorsFor({ ...rules, version: "1.0" })).toContain("1.0: the version is major.minor.patch");
  });
});

describe("placement template", () => {
  const ids = (section: string) => rules.template.questions.filter((q) => q.section === section).map((q) => q.id);

  it("has the questions of the placement spec", () => {
    expect(ids("A")).toEqual(["A1", "A2", "A3", "A4", "A4a", "A4b", "A4c", "A5"]);
    expect(ids("B")).toEqual(["B1", "B2", "B3", "B4", "B5"]);
    expect(ids("C")).toEqual(["C1", "C2", "C3", "C4", "C5", "C6", "C7"]);
    expect(ids("D")).toEqual(["D1", "D2", "D3", "D4", "D5"]);
    expect(ids("E")).toEqual(["E1", "E2", "E3", "E4", "E5", "E6"]);
    expect(ids("F")).toEqual(["F1", "F2", "F3", "F4", "F5"]);
    expect(ids("G")).toEqual(["G1", "G2", "G3", "G4"]);
    expect(question("A2").options?.map((o) => o.label)).toEqual([
      "None",
      "Buyer identified",
      "Buyer contacted",
      "Inquiry received",
      "Quotation sent",
      "Order confirmed",
      "Shipment underway",
      "Shipped and awaiting payment",
    ]);
  });

  it("asks the pathway questions once, in the diagnostic", () => {
    // Q137 of the diagnostic holds the last shipment date (#48 and #78), so there is no A1b.
    expect(rules.template.questions.find((q) => q.id === "A1b")).toBeUndefined();
  });

  it("scores sections B to G on a 0 to 3 scale and leaves A and C7 out of any score", () => {
    expect(rules.template.scale.map((s) => [s.score, s.key])).toEqual([
      [0, "not_in_place"],
      [1, "informal"],
      [2, "repeatable"],
      [3, "documented_reviewed"],
    ]);
    expect(rules.template.unscoredAnswers.map((a) => a.value)).toEqual(["not_applicable", "not_known"]);
    const scored = rules.template.questions.filter((q) => q.kind === "capability").map((q) => q.section);
    expect(new Set(scored)).toEqual(new Set(["B", "C", "D", "E", "F", "G"]));
    expect(question("C7").kind).toBe("choice");
    expect(question("C7").options?.map((o) => o.value)).toEqual(["never_applied", "preparing", "submitted", "approved", "declined", "disbursed"]);
  });

  it("marks evidence-based questions and keeps 'not available' on its own", () => {
    expect(question("B3").evidenceBased).toBe(true);
    expect(question("C1").evidenceBased).toBe(true);
    expect(question("D1").evidenceBased).toBe(false);
    expect(question("A5").options?.find((o) => o.exclusive)?.value).toBe("not_available");
    expect(errorsFor(withQuestion("A1", { options: [{ value: "never", label: "Never", exclusive: true }, ...(question("A1").options ?? [])] }))).toEqual([
      "0.1.0: A1: duplicate option never",
      "0.1.0: A1: only a multiple-choice question has an exclusive option",
    ]);
  });

  it("asks the product and market questions only once they apply", () => {
    expect(question("A4a").askWhen).toEqual({ question: "A4", in: ["product_only", "both_not_validated", "both_validated"] });
    expect(errorsFor(withQuestion("A4a", { askWhen: { question: "A4", in: ["maybe"] } }))).toEqual(['0.1.0: A4a: A4 has no option "maybe"']);
    expect(errorsFor(withQuestion("A4a", { askWhen: { question: "B1", in: ["x"] } }))).toEqual(["0.1.0: A4a: asked after B1, which comes later"]);
    expect(errorsFor(withQuestion("A4a", { askWhen: { question: "Z9", in: ["x"] } }))).toEqual(["0.1.0: A4a: asked after unknown question Z9"]);
  });

  it("refuses a malformed template", () => {
    expect(errorsFor(changed({ template: { ...rules.template, questions: [...rules.template.questions, question("B1")] } }))).toEqual([
      "0.1.0: duplicate question B1",
      "0.1.0: two questions share the key buyer_list",
    ]);
    expect(errorsFor(withQuestion("B1", { section: "Z" as never }))).toContain("0.1.0: B1: unknown section Z");
    expect(errorsFor(withQuestion("A3", { kind: "capability", options: undefined }))).toContain(
      "0.1.0: A3: a capability question is in section A, which isn't scored",
    );
    expect(errorsFor(withQuestion("A3", { options: [{ value: "0", label: "0" }] }))).toEqual(["0.1.0: A3: needs at least two options"]);
    expect(errorsFor(withQuestion("B1", { options: [{ value: "x", label: "X" }] }))).toEqual(["0.1.0: B1: a capability question has no options"]);
  });
});

describe("domains and trigger groups", () => {
  it("score the six domains of sections B to G", () => {
    expect(rules.domains.map((d) => [d.id, d.questions.length, d.maxPoints])).toEqual([
      ["buyer_development", 5, 15],
      ["financial_records", 6, 18],
      ["transaction_finance", 5, 15],
      ["costing_execution", 6, 18],
      ["digital_productivity", 5, 15],
      ["operational_readiness", 4, 12],
    ]);
  });

  it("trigger the modules of the proposed groups", () => {
    const group = (id: string) => rules.triggerGroups.find((g) => g.id === id);
    expect(group("buyer")).toMatchObject({ module: "M05", questions: ["B1", "B2", "B3", "B4", "B5"] });
    expect(group("financial")).toMatchObject({ module: "M03", questions: ["C1", "C2", "C3", "C4", "C5", "C6"] });
    expect(group("trade_finance")).toMatchObject({ module: "M04", questions: ["D1", "D2", "D3", "D4", "D5"] });
    expect(group("costing")).toMatchObject({ module: "M06", questions: ["E1", "E2", "E5", "E6"] });
    expect(group("execution")).toMatchObject({ module: "M08", questions: ["E3", "E4", "G3", "G4"] });
    expect(group("operations")).toMatchObject({ module: "M07", questions: ["G1", "G2", "C4"] });
    expect(group("digital")).toMatchObject({ module: "M02", questions: ["F1", "F2", "F3", "F5"] });
    expect(group("ai_productivity")).toMatchObject({ module: "M09", questions: ["F4"] });
  });

  it("refuses a question in two domains", () => {
    const domains = rules.domains.map((d) => (d.id === "financial_records" ? { ...d, questions: [...d.questions, "B1"], maxPoints: 21 } : d));
    expect(errorsFor(changed({ domains }))).toEqual(["0.1.0: B1 is in two domains: buyer_development and financial_records"]);
  });

  it("refuses an unknown module ID in a trigger group", () => {
    const triggerGroups = rules.triggerGroups.map((g) => (g.id === "buyer" ? { ...g, module: "M99" as ModuleId } : g));
    expect(errorsFor(changed({ triggerGroups }))).toEqual(["0.1.0: trigger group buyer: unknown module M99"]);
  });

  it("refuses a trigger group that names a missing question", () => {
    const triggerGroups = rules.triggerGroups.map((g) => (g.id === "costing" ? { ...g, questions: [...g.questions, "E9"] } : g));
    expect(errorsFor(changed({ triggerGroups }))).toEqual(["0.1.0: trigger group costing: names missing question E9"]);
    const domains = rules.domains.map((d) => (d.id === "operational_readiness" ? { ...d, questions: [...d.questions, "G9"], maxPoints: 15 } : d));
    expect(errorsFor(changed({ domains }))).toEqual(["0.1.0: domain operational_readiness: names missing question G9"]);
  });

  it("refuses a question that can't be scored or could never assign a module", () => {
    const triggerGroups = rules.triggerGroups.map((g) => (g.id === "ai_productivity" ? { ...g, questions: ["C7"] } : g));
    expect(errorsFor(changed({ triggerGroups }))).toEqual([
      "0.1.0: trigger group ai_productivity: C7 isn't a capability question, so it has no score",
      "0.1.0: F4 is in no trigger group, so it could never assign a module",
    ]);
    const domains = rules.domains.filter((d) => d.id !== "operational_readiness");
    expect(errorsFor(changed({ domains }))).toEqual([
      "0.1.0: G1 is in no domain, so it would never be scored",
      "0.1.0: G2 is in no domain, so it would never be scored",
      "0.1.0: G3 is in no domain, so it would never be scored",
      "0.1.0: G4 is in no domain, so it would never be scored",
    ]);
  });

  it("refuses a maximum that doesn't match the questions", () => {
    const domains = rules.domains.map((d) => (d.id === "buyer_development" ? { ...d, maxPoints: 12 } : d));
    expect(errorsFor(changed({ domains }))).toEqual(["0.1.0: domain buyer_development: max points is 12, but 5 questions come to 15"]);
  });
});

describe("bands and thresholds", () => {
  it("band a score from the placement spec", () => {
    const bandOf = (score: number) => rules.bands.filter((b) => score >= b.from).at(-1)?.id;
    expect([0, 39, 40, 59, 60, 79, 80, 100].map(bandOf)).toEqual([
      "critical_gap",
      "critical_gap",
      "developing",
      "developing",
      "functional",
      "functional",
      "demonstrated",
      "demonstrated",
    ]);
    expect(rules.thresholds).toEqual({ assignBelow: 60, testOutFrom: 80, retentionBelow: 80, minCoverage: 0.8 });
  });

  it("refuse bands and thresholds that disagree", () => {
    expect(errorsFor(changed({ bands: rules.bands.slice(1) }))).toContain("0.1.0: the first band starts at 0");
    expect(errorsFor(changed({ bands: [rules.bands[1]!, rules.bands[0]!, ...rules.bands.slice(2)] }))).toContain(
      "0.1.0: band critical_gap doesn't start above developing",
    );
    expect(errorsFor(changed({ thresholds: { ...rules.thresholds, assignBelow: 55 } }))).toEqual([
      "0.1.0: threshold assignBelow (55) is not where a band starts",
    ]);
    expect(errorsFor(changed({ thresholds: { ...rules.thresholds, assignBelow: 80, testOutFrom: 60 } }))).toContain(
      "0.1.0: a test-out is offered above the score that assigns a module",
    );
    expect(errorsFor(changed({ thresholds: { ...rules.thresholds, minCoverage: 0 } }))).toEqual([
      "0.1.0: minimum coverage is a share above 0 and up to 1",
    ]);
  });
});

describe("module catalogue", () => {
  const module = (id: ModuleId) => rules.modules.find((m) => m.id === id) as ModuleDefinition;

  it("lists M01 to M12 with a content status", () => {
    expect(rules.modules.map((m) => m.id)).toEqual([...MODULE_IDS]);
    const status = (s: string) => rules.modules.filter((m) => m.contentStatus === s).map((m) => m.id);
    expect(status("draft")).toEqual(["M01", "M03", "M04", "M05", "M07", "M08"]);
    expect(status("in_production")).toEqual(["M02", "M06", "M09", "M10", "M11", "M12"]);
    expect(status("ready")).toEqual([]);
  });

  it("gives every module its own rule ID and a deliverable", () => {
    expect(new Set(rules.modules.map((m) => m.trigger.ruleId)).size).toBe(12);
    expect(module("M04").deliverable).toBe("Transaction finance and payment-risk brief");
    expect(module("M12").deliverable).toBe("Individual 90-day action plan");
  });

  it("requires M01, M11 and M12 of everyone and adapts M11 to the pathway", () => {
    expect(rules.modules.filter((m) => m.requiredForAll).map((m) => m.id)).toEqual(["M01", "M11", "M12"]);
    expect(rules.modules.filter((m) => m.adaptedToPathway).map((m) => m.id)).toEqual(["M11"]);
  });

  it("puts M02 before M03 when records are unverified", () => {
    expect(rules.modules.flatMap((m) => m.prerequisites.map((p) => [p.module, "before", m.id, p.reasonCode, p.ruleId]))).toEqual([
      ["M02", "before", "M03", "RECORDS_BEFORE_FINANCE", "RULE-01"],
    ]);
  });

  it("doesn't make a MIZAN sync a completion criterion", () => {
    expect(rules.modules.flatMap((m) => m.completion.map((c) => c.text)).filter((t) => /mizan/i.test(t))).toEqual([]);
    expect(module("M01").completion.map((c) => c.id)).toContain("placement_submitted");
  });

  it("refuses an unknown module, a missing one and a bad prerequisite", () => {
    expect(errorsFor(changed({ modules: rules.modules.slice(1) }))).toEqual(["0.1.0: module M01 is missing from the catalogue"]);
    expect(errorsFor(withModule("M03", { prerequisites: [{ module: "M99" as ModuleId, ruleId: "RULE-01", when: "", reasonCode: "RECORDS_BEFORE_FINANCE" }] }))).toEqual([
      "0.1.0: M03: prerequisite M99 is not in the catalogue",
    ]);
    expect(errorsFor(withModule("M03", { prerequisites: [{ module: "M03", ruleId: "RULE-01", when: "", reasonCode: "RECORDS_BEFORE_FINANCE" }] }))).toContain(
      "0.1.0: M03: is its own prerequisite",
    );
    const loop = changed({
      modules: rules.modules.map((m) =>
        m.id === "M02" ? { ...m, prerequisites: [{ module: "M03" as ModuleId, ruleId: "RULE-02", when: "", reasonCode: "RECORDS_BEFORE_FINANCE" as const }] } : m,
      ),
    });
    expect(errorsFor(loop)).toEqual(["0.1.0: prerequisites go in a circle: M02 -> M03 -> M02"]);
  });

  it("refuses a reused rule ID, an unknown reason code and an empty completion list", () => {
    expect(errorsFor(withModule("M02", { trigger: { ...module("M02").trigger, ruleId: "TRIGGER-M03" } }))).toEqual(["0.1.0: rule ID TRIGGER-M03 is used twice"]);
    expect(errorsFor(withModule("M02", { trigger: { ...module("M02").trigger, reasonCodes: ["GAP_MAGIC" as never] } }))).toEqual([
      "0.1.0: M02: trigger uses unknown reason code GAP_MAGIC",
    ]);
    expect(errorsFor(withModule("M02", { completion: [] }))).toEqual(["0.1.0: M02: has no completion criteria"]);
  });
});

describe("reason codes", () => {
  const latest = latestTradeRules();

  it("has a sentence for each code, including the ones the issue names", () => {
    expect(latest.reasonCodes.map((r) => r.code)).toEqual([...REASON_CODES]);
    // 0.1.0 defines the first 18 and 0.2.0 adds the four pathway codes.
    expect(rules.reasonCodes.map((r) => r.code)).toEqual(REASON_CODES.slice(0, 18));
    for (const code of ["REQUIRED_ALL", "GAP_FINANCIAL", "LIVE_ORDER", "NO_QUALIFIED_BUYER", "HAS_EXPORTED_RETENTION", "ASSESSMENT_NEEDED", "RECORDS_BEFORE_FINANCE", "STAFF_OVERRIDE"]) {
      expect(REASON_CODES).toContain(code);
    }
  });

  it("refuses a missing, repeated or empty one", () => {
    expect(errorsFor(changed({ reasonCodes: rules.reasonCodes.slice(1) }))).toEqual([
      "0.1.0: M01: trigger uses unknown reason code REQUIRED_ALL",
      "0.1.0: M11: trigger uses unknown reason code REQUIRED_ALL",
    ]);
    expect(errorsFor(changed({ reasonCodes: [...rules.reasonCodes, rules.reasonCodes[0]!] }))).toEqual(["0.1.0: duplicate reason code REQUIRED_ALL"]);
    expect(errorsFor(changed({ reasonCodes: rules.reasonCodes.map((r) => (r.code === "LIVE_ORDER" ? { ...r, text: " " } : r)) }))).toEqual([
      "0.1.0: reason code LIVE_ORDER has an empty sentence",
    ]);
  });
});

describe("pathway and plan rules", () => {
  const v2 = latestTradeRules();
  const withPlan = (change: Partial<NonNullable<TradeRules["plan"]>>): TradeRules => ({ ...v2, plan: { ...v2.plan!, ...change } });

  it("are in 0.2.0 and not in 0.1.0", () => {
    expect(rules.pathway).toBeUndefined();
    expect(rules.plan).toBeUndefined();
    expect(v2.pathway).toEqual({ shipmentWindowMonths: 24 });
    expect(v2.plan?.liveOrderStages).toEqual(["order_confirmed", "shipment_underway", "shipped_awaiting_payment"]);
    expect(v2.plan?.urgentModules).toEqual(["M04", "M06", "M08"]);
    expect(Object.values(v2.plan!.sequence).flat().sort()).toEqual([...MODULE_IDS]);
  });

  it("leave 0.1.0 as it was", () => {
    expect(errorsFor(rules, v2)).toEqual([]);
  });

  it("refuse an answer the template doesn't offer", () => {
    expect(errorsFor(withPlan({ liveOrderStages: ["order_confirmed", "signed"] }))).toEqual(['0.2.0: plan: live order stages name "signed", which A2 doesn\'t offer']);
    expect(errorsFor(withPlan({ exportedHistory: ["often"] }))).toEqual(['0.2.0: plan: exported history name "often", which A1 doesn\'t offer']);
    expect(errorsFor(withPlan({ quotationStages: [] }))).toEqual(["0.2.0: plan: quotation stages are empty"]);
    expect(errorsFor(withPlan({ quotationStages: ["quotation_sent", "order_confirmed"] }))).toEqual([
      '0.2.0: plan: "order_confirmed" is both a live order and a quotation stage',
    ]);
  });

  it("refuse a sequence that loses, repeats or invents a module", () => {
    const { sequence } = v2.plan!;
    expect(errorsFor(withPlan({ sequence: { ...sequence, closing: ["M10", "M11"] } }))).toEqual(["0.2.0: plan: M12 has no place in the sequence"]);
    expect(errorsFor(withPlan({ sequence: { ...sequence, enabler: ["M09", "M05"] } }))).toEqual(["0.2.0: plan: M05 is in the sequence twice"]);
    expect(errorsFor(withPlan({ sequence: { ...sequence, enabler: ["M09", "M13" as ModuleId] } }))).toEqual([
      "0.2.0: plan: sequence has unknown module M13",
    ]);
    expect(errorsFor(withPlan({ urgentModules: ["M04", "M99" as ModuleId] }))).toEqual(["0.2.0: plan: urgent module M99 is unknown"]);
  });

  it("refuse a window that isn't whole months, one half without the other, and a missing pathway sentence", () => {
    expect(errorsFor({ ...v2, pathway: { shipmentWindowMonths: 0 } })).toEqual(["0.2.0: the shipment window is a whole number of months, at least 1"]);
    expect(errorsFor({ ...v2, plan: undefined })).toEqual(["0.2.0: pathway rules and plan rules come together"]);
    expect(errorsFor({ ...v2, reasonCodes: v2.reasonCodes.filter((r) => r.code !== "PATHWAY_ORDER_PRIORITY") })).toEqual([
      "0.2.0: pathway rules use reason code PATHWAY_ORDER_PRIORITY, which has no sentence",
    ]);
  });
});
