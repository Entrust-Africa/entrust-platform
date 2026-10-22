import { EVIDENCE_TYPES, STEPS } from "@entrust/rules";
import { describe, expect, it } from "vitest";
import { evaluateCase } from "../src";
import type { CaseFacts, StepRecord } from "../src";

const evaluate = (facts: CaseFacts, steps: Partial<Record<string, StepRecord>> = {}) =>
  evaluateCase(STEPS, { facts, steps, evidence: [], raisedExceptions: [] }, { asOf: "2026-10-22" });

const applicability = (facts: CaseFacts) =>
  Object.fromEntries(evaluate(facts).steps.map((s) => [s.id, s.applicability]));

const applying = (facts: CaseFacts, ids: string[]) => {
  const all = applicability(facts);
  return Object.fromEntries(ids.map((id) => [id, all[id]]));
};

// The simulation's pilot case: ZEBU Coffee, green coffee to Artisan Coffee USA, FOB Djibouti,
// 10% advance / 90% CAD. The demo opened it with the phytosanitary requirement not yet determined.
const ZEBU: CaseFacts = {
  product: "green_coffee",
  destinationCountry: "US",
  transportMode: "sea",
  coldChain: "no",
  paymentTerms: ["advance_tt", "cad"],
  incoterm: "FOB",
};

const SEA_STEPS = ["STEP-075", "STEP-077", "STEP-079", "STEP-085", "STEP-086", "STEP-089"];

describe("canonical steps through the engine", () => {
  it("evaluates every step without errors", () => {
    const result = evaluate(ZEBU);
    expect(result.steps).toHaveLength(125);
    expect(result.phases).toHaveLength(7);
    expect(result.warnings).toEqual([]);
  });

  it("applies container, dry port and Djibouti steps by sea but not by air", () => {
    const sea = applying({ ...ZEBU, transportMode: "sea" }, SEA_STEPS);
    expect(Object.values(sea).every((a) => a === "applicable")).toBe(true);
    const air = applying({ ...ZEBU, transportMode: "air" }, SEA_STEPS);
    expect(Object.values(air).every((a) => a === "not_applicable")).toBe(true);
  });

  it("applies the ISF only to sea cargo bound for the US", () => {
    expect(applicability({ ...ZEBU, transportMode: "sea" })["STEP-097"]).toBe("applicable");
    expect(applicability({ ...ZEBU, transportMode: "air" })["STEP-097"]).toBe("not_applicable");
    expect(applicability({ ...ZEBU, destinationCountry: "TR" })["STEP-097"]).toBe("not_applicable");
  });

  it("branches on LC, CAD and advance TT", () => {
    const ids = ["STEP-026", "STEP-027", "STEP-028", "STEP-103", "STEP-110", "STEP-112", "STEP-113", "STEP-114", "STEP-115"];
    expect(applying({ ...ZEBU, paymentTerms: ["lc"] }, ids)).toEqual({
      "STEP-026": "applicable",
      "STEP-027": "not_applicable",
      "STEP-028": "not_applicable",
      "STEP-103": "applicable",
      "STEP-110": "applicable",
      "STEP-112": "applicable",
      "STEP-113": "applicable",
      "STEP-114": "not_applicable",
      "STEP-115": "applicable",
    });
    expect(applying({ ...ZEBU, paymentTerms: ["cad"] }, ids)).toEqual({
      "STEP-026": "not_applicable",
      "STEP-027": "applicable",
      "STEP-028": "not_applicable",
      "STEP-103": "applicable",
      "STEP-110": "applicable",
      "STEP-112": "not_applicable",
      "STEP-113": "applicable",
      "STEP-114": "applicable",
      "STEP-115": "applicable",
    });
    expect(applying({ ...ZEBU, paymentTerms: ["advance_tt"] }, ids)).toEqual({
      "STEP-026": "not_applicable",
      "STEP-027": "not_applicable",
      "STEP-028": "applicable",
      "STEP-103": "not_applicable",
      "STEP-110": "not_applicable",
      "STEP-112": "not_applicable",
      "STEP-113": "not_applicable",
      "STEP-114": "not_applicable",
      "STEP-115": "not_applicable",
    });
  });

  it("asks for an insurance certificate only under CIF", () => {
    const insurance = (incoterm: string) =>
      evaluate({ ...ZEBU, incoterm })
        .steps.find((s) => s.id === "STEP-102")
        ?.evidence.some((e) => e.type === "insurance_certificate");
    expect(insurance("CIF")).toBe(true);
    expect(insurance("FOB")).toBe(false);
  });

  it("applies destination checks by country", () => {
    const ids = ["STEP-038", "STEP-039", "STEP-040", "STEP-041", "STEP-095", "STEP-096"];
    expect(applying({ ...ZEBU, destinationCountry: "US" }, ids)).toEqual({
      "STEP-038": "applicable",
      "STEP-039": "applicable",
      "STEP-040": "not_applicable",
      "STEP-041": "not_applicable",
      "STEP-095": "applicable",
      "STEP-096": "applicable",
    });
    expect(applying({ ...ZEBU, destinationCountry: "TR" }, ids)).toEqual({
      "STEP-038": "not_applicable",
      "STEP-039": "not_applicable",
      "STEP-040": "applicable",
      "STEP-041": "not_applicable",
      "STEP-095": "not_applicable",
      "STEP-096": "not_applicable",
    });
    expect(applying({ ...ZEBU, destinationCountry: "DE" }, ids)).toMatchObject({
      "STEP-038": "not_applicable",
      "STEP-041": "applicable",
    });
  });

  it("gives the ZEBU Coffee case the same open questions as the demo", () => {
    const zebu = applicability(ZEBU);
    // Phytosanitary and health certificate needs were open in the demo; they wait on STEP-042.
    for (const id of ["STEP-049", "STEP-051", "STEP-069", "STEP-070"]) expect(zebu[id], id).toBe("undetermined");
    // Mixed advance + CAD: both payment branches apply, the LC branch does not.
    expect(zebu["STEP-027"]).toBe("applicable");
    expect(zebu["STEP-028"]).toBe("applicable");
    expect(zebu["STEP-026"]).toBe("not_applicable");
    // US-bound by sea, so the FDA, Prior Notice and ISF steps apply; no cold chain.
    for (const id of ["STEP-038", "STEP-039", "STEP-095", "STEP-096", "STEP-097"]) expect(zebu[id], id).toBe("applicable");
    expect(zebu["STEP-076"]).toBe("not_applicable");
    // Green coffee is graded.
    expect(zebu["STEP-061"]).toBe("applicable");
  });

  it("starts a new case at STEP-001 with every phase open", () => {
    const result = evaluate(ZEBU);
    expect(result.nextAction).toMatchObject({ stepId: "STEP-001", kind: "complete" });
    expect(result.phases.every((p) => p.status === "open")).toBe(true);
  });

  it("does not let the final bill of lading be issued before loading", () => {
    const result = evaluate(ZEBU);
    expect(result.steps.find((s) => s.id === "STEP-094")?.blockedBy).toEqual(["STEP-104"]);
  });

  it("does not close the case while earlier gates are unsigned", () => {
    const facts: CaseFacts = {
      ...ZEBU,
      sourcingChannel: "ecx",
      phytoCertificateRequired: "no",
      healthCertificateRequired: "no",
      customsChannel: "green",
    };
    const steps = Object.fromEntries(STEPS.filter((s) => !s.milestone).map((s) => [s.id, { status: "completed" as const }]));
    const evidence = EVIDENCE_TYPES.map((e) => ({ type: e.id, status: "approved" as const }));
    const result = evaluateCase(STEPS, { facts, steps, evidence, raisedExceptions: [] }, { asOf: "2026-10-22" });
    expect(result.steps.find((s) => s.id === "STEP-125")?.canComplete).toBe(false);
    expect(result.nextAction).toMatchObject({ stepId: "STEP-018", kind: "sign_off" });
  });

  it("can walk the ZEBU case from STEP-001 to case closure", () => {
    const facts: CaseFacts = {
      ...ZEBU,
      sourcingChannel: "ecx",
      phytoCertificateRequired: "no",
      healthCertificateRequired: "no",
      customsChannel: "green",
    };
    const evidence = EVIDENCE_TYPES.map((e) => ({ type: e.id, status: "approved" as const }));
    const steps: Partial<Record<string, StepRecord>> = {};
    const order: string[] = [];
    for (let round = 0; round < 200; round++) {
      const result = evaluateCase(STEPS, { facts, steps, evidence, raisedExceptions: [] }, { asOf: "2026-10-22" });
      const next = result.steps.find((s) => s.canComplete);
      if (!next) {
        expect(result.phases.map((p) => p.status)).toEqual(Array(7).fill("locked"));
        expect(result.nextAction).toBeNull();
        break;
      }
      steps[next.id] = { status: "completed" };
      order.push(next.id);
    }
    expect(order.indexOf("STEP-097")).toBeLessThan(order.indexOf("STEP-104"));
    expect(order.indexOf("STEP-104")).toBeLessThan(order.indexOf("STEP-094"));
    expect(order.at(-1)).toBe("STEP-125");
  });
});
