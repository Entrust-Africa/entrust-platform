import { STEPS, findRulePack, type RequirementBasis, type RulePack } from "@entrust/rules";
import { describe, expect, it } from "vitest";
import { TransitionError, evaluateCase, evaluateRequirements, transitionStep } from "../src";
import type { CaseFacts, EvidenceRecord, RequirementStatus, StepRecord } from "../src";

// The simulation's demo (17 October 2026) ran the ZEBU Coffee case on the simulation's own coffee
// pack. This walks the same case through the platform with the pack ported from it (#7), step by
// step, against what the simulation's engine gave.

const pack = findRulePack("et-us-green-coffee", "0.4.0") as RulePack;

// ZEBU Coffee: green coffee to Artisan Coffee USA, FOB Djibouti, 10% advance and 90% CAD, by sea.
// The demo opened with the phytosanitary need and the inland mode not determined, the exporter and
// the buyer on record (STEP-001, STEP-019) and nothing else done.
const ZEBU: CaseFacts = {
  product: "green_coffee",
  destinationCountry: "US",
  transportMode: "sea",
  coldChain: "no",
  paymentTerms: ["advance_tt", "cad"],
  incoterm: "FOB",
};
const OPENED: Partial<Record<string, StepRecord>> = { "STEP-001": { status: "completed" }, "STEP-019": { status: "completed" } };
const PO_DONE = { ...OPENED, "STEP-020": { status: "completed" } } as const;
const PO_APPROVED: EvidenceRecord[] = [{ type: "sales_contract", status: "approved" }];

const evaluate = (facts: CaseFacts, steps = OPENED, evidence: EvidenceRecord[] = []) =>
  evaluateCase(STEPS, { facts, steps, evidence, raisedExceptions: [] }, { asOf: "2026-10-17" });
const statuses = (facts: CaseFacts, steps = OPENED, evidence: EvidenceRecord[] = []) =>
  Object.fromEntries(evaluateRequirements(pack, facts, evaluate(facts, steps, evidence)).map((r) => [r.code, r.status]));

// What the simulation's engine gave for each requirement when the demo opened the case: its basis
// and its status. The simulation's "pending" is open here and its "conditional" (a condition not
// determined yet) is undetermined.
const SIMULATION: Record<string, [RequirementBasis, "pending" | "blocked" | "conditional"]> = {
  "CASE-01": ["transaction", "pending"],
  "ELG-01": ["confirmed", "pending"],
  "ELG-02": ["awaiting_verification", "pending"],
  "QLT-01": ["confirmed", "blocked"],
  "QLT-02": ["confirmed", "blocked"],
  "QLT-03": ["transaction", "blocked"],
  "QLT-04": ["confirmed", "blocked"],
  "PAY-01": ["transaction", "blocked"],
  "COM-02": ["confirmed", "blocked"],
  "COM-01": ["confirmed", "blocked"],
  "COM-03": ["transaction", "blocked"],
  "COM-04": ["awaiting_verification", "blocked"],
  "PHY-01": ["conditional", "conditional"],
  "CUS-01": ["confirmed", "blocked"],
  "USP-01": ["conditional", "conditional"],
  "USP-02": ["confirmed", "pending"],
  "USP-03": ["confirmed", "pending"],
  "USP-04": ["confirmed", "blocked"],
  "USP-05": ["confirmed", "blocked"],
  "USP-06": ["awaiting_verification", "pending"],
  "TRN-01": ["conditional", "conditional"],
  "TRN-02": ["conditional", "conditional"],
  "TRN-03": ["confirmed", "blocked"],
  "TRN-04": ["confirmed", "blocked"],
  "POR-01": ["transaction", "blocked"],
  "POR-02": ["transaction", "blocked"],
  "POR-03": ["transaction", "blocked"],
  "USE-01": ["confirmed", "blocked"],
  "USE-02": ["confirmed", "blocked"],
  "USE-03": ["awaiting_verification", "blocked"],
  "PAY-02": ["transaction", "blocked"],
  "PAY-03": ["transaction", "blocked"],
  "PAY-04": ["transaction", "blocked"],
  "REV-01": ["transaction", "blocked"],
  "REV-02": ["transaction", "blocked"],
};
const AS_STATUS = { pending: "open", blocked: "blocked", conditional: "undetermined" } as const;

// Where the platform differs from the demo, and why. Everything not listed here matches.
const DIFFERENCES: Record<string, { basis?: RequirementBasis; opened?: RequirementStatus; because: string }> = {
  "ELG-02": { basis: "confirmed", because: "The 24 October 2026 check found the TIN in Tax Administration Proclamation 983/2016, as amended by 1434/2026." },
  "COM-04": {
    basis: "confirmed",
    because: "The 24 October 2026 check confirmed Ethiopia's ICO membership, so the certificate is required; who issues it is still open.",
  },
  "USE-03": { basis: "confirmed", because: "The 24 October 2026 check found FDA's own entry review and detention pages." },
  "ELG-01": { opened: "blocked", because: "The canonical steps verify the TIN and business registration (STEP-002) before the trade licence and competence certificate (STEP-003, STEP-004)." },
  "USP-01": {
    opened: "blocked",
    because:
      "STEP-038 applies to every US-bound case and waits on the facility profile (STEP-011). The simulation waited on the facility type; here an exempt farm marks STEP-038 not applicable with that reason.",
  },
  "USP-02": { opened: "blocked", because: "The destination checks (STEP-037) wait on the HS code sign-off (STEP-010): admissibility depends on the classification." },
  "USP-03": { opened: "blocked", because: "On STEP-037, like USP-02." },
  "USP-06": { opened: "blocked", because: "STEP-042 waits on STEP-037, like USP-02." },
  "TRN-01": { basis: "transaction", because: "A route option with no official source, so it isn't presented as a conditional requirement of law." },
  "TRN-02": { basis: "transaction", because: "As TRN-01." },
};

describe("the ZEBU Coffee demo, step by step", () => {
  it("opens the case with the simulation's 35 requirements", () => {
    expect(pack.requirements.map((r) => r.code).sort()).toEqual(Object.keys(SIMULATION).sort());
    for (const r of pack.requirements) {
      expect(r.basis, r.code).toBe(DIFFERENCES[r.code]?.basis ?? SIMULATION[r.code]?.[0]);
    }
  });

  it("gives every requirement presented as law its official source, and labels what isn't verified", () => {
    for (const r of pack.requirements.filter((x) => x.basis === "confirmed" || x.basis === "conditional")) {
      expect(r.sources.some((s) => s.url?.startsWith("https://")), r.code).toBe(true);
    }
    const awaiting = pack.requirements.filter((r) => r.basis === "awaiting_verification");
    expect(awaiting.every((r) => r.verification.status === "awaiting_verification")).toBe(true);
  });

  it("starts each requirement where the demo did, apart from the listed differences", () => {
    const opened = statuses(ZEBU);
    for (const [code, [, simulated]] of Object.entries(SIMULATION)) {
      expect(opened[code], `${code}: ${DIFFERENCES[code]?.because ?? "should match the demo"}`).toBe(
        DIFFERENCES[code]?.opened ?? AS_STATUS[simulated],
      );
    }
  });

  it("meets CASE-01 once the purchase order is approved and its step completed", () => {
    expect(statuses(ZEBU, PO_DONE, PO_APPROVED)["CASE-01"]).toBe("met");
    // The demo then unlocked PAY-01. Here the advance is verified once the payment instrument is
    // determined (STEP-025), which the PO alone doesn't do.
    expect(statuses(ZEBU, PO_DONE, PO_APPROVED)["PAY-01"]).toBe("blocked");
    expect(statuses(ZEBU, { ...PO_DONE, "STEP-025": { status: "completed" } }, PO_APPROVED)["PAY-01"]).toBe("open");
  });

  it("branches on the inland transport as the demo did", () => {
    const rail = statuses({ ...ZEBU, inlandTransport: "rail" }, PO_DONE, PO_APPROVED);
    expect([rail["TRN-01"], rail["TRN-02"]]).toEqual(["blocked", "not_applicable"]);
    const road = statuses({ ...ZEBU, inlandTransport: "road" }, PO_DONE, PO_APPROVED);
    expect([road["TRN-01"], road["TRN-02"]]).toEqual(["not_applicable", "blocked"]);
    // By air neither applies, whatever the inland mode.
    const air = statuses({ ...ZEBU, transportMode: "air" }, PO_DONE, PO_APPROVED);
    expect([air["TRN-01"], air["TRN-02"], air["TRN-03"], air["TRN-04"]]).toEqual(Array(4).fill("not_applicable"));
  });

  it("refuses to complete contract registration (QLT-01) while it is blocked", () => {
    const evaluation = evaluate({ ...ZEBU, inlandTransport: "rail" }, PO_DONE, PO_APPROVED);
    const step = evaluation.steps.find((s) => s.id === "STEP-034");
    expect(step?.status).toBe("blocked");
    expect(() => transitionStep(step!, { to: "completed", actor: "owner" })).toThrow(TransitionError);
    // The demo's reason was ELG-01, the competence certificate. STEP-034 doesn't wait on STEP-004,
    // so here it is blocked by the commercial sign-off (STEP-033) instead.
    expect(step?.blockedBy).toEqual(["STEP-033"]);
  });

  it("is not ready to ship, and says why", () => {
    const evaluation = evaluate({ ...ZEBU, inlandTransport: "rail" }, PO_DONE, PO_APPROVED);
    expect(evaluation.phases.every((p) => p.status === "open")).toBe(true);
    expect(evaluation.phases.find((p) => p.phase === 5)?.outstanding.length).toBeGreaterThan(0);
    expect(evaluation.nextAction).not.toBeNull();
  });

  it("settles the phytosanitary question when STEP-042 records it", () => {
    expect(statuses(ZEBU)["PHY-01"]).toBe("undetermined");
    expect(statuses({ ...ZEBU, phytoCertificateRequired: "no" })["PHY-01"]).toBe("not_applicable");
    expect(statuses({ ...ZEBU, phytoCertificateRequired: "yes" })["PHY-01"]).toBe("blocked");
  });
});
