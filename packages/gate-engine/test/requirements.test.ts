import { STEPS, findRulePack, type RulePack } from "@entrust/rules";
import { describe, expect, it } from "vitest";
import { evaluateCase, evaluateRequirements } from "../src";
import type { CaseFacts, EvidenceRecord, StepRecord } from "../src";

const pack = findRulePack("et-us-green-coffee", "0.4.0") as RulePack;
const FACTS: CaseFacts = { product: "green_coffee", destinationCountry: "US", transportMode: "sea", paymentTerms: ["cad"], incoterm: "FOB" };

const requirement = (code: string, facts: CaseFacts, steps: Partial<Record<string, StepRecord>> = {}, evidence: EvidenceRecord[] = []) => {
  const evaluation = evaluateCase(STEPS, { facts, steps, evidence, raisedExceptions: [] }, { asOf: "2026-10-24" });
  const found = evaluateRequirements(pack, facts, evaluation).find((r) => r.code === code);
  if (!found) throw new Error(`No requirement ${code}`);
  return found;
};

describe("rule pack requirements on a case", () => {
  it("reads its status from the steps it is on", () => {
    expect(requirement("ELG-02", FACTS)).toMatchObject({ status: "blocked", steps: [{ id: "STEP-002", status: "blocked" }] });
    expect(requirement("ELG-02", FACTS).reason).toBe("STEP-002: Waiting on STEP-001.");
    expect(requirement("ELG-02", FACTS, { "STEP-001": { status: "completed" } })).toMatchObject({ status: "open", reason: null });
    const done = { "STEP-001": { status: "completed" }, "STEP-002": { status: "completed" } } as const;
    expect(requirement("ELG-02", FACTS, done).status).toBe("met");
  });

  it("is met only when every step it is on that applies is completed", () => {
    const licence = { "STEP-001": { status: "completed" }, "STEP-002": { status: "completed" }, "STEP-003": { status: "completed" } } as const;
    expect(requirement("ELG-01", FACTS, licence).status).toBe("open");
    expect(requirement("ELG-01", FACTS, { ...licence, "STEP-004": { status: "completed" } }).status).toBe("met");
  });

  it("does not apply when its own condition doesn't hold", () => {
    const pay02 = requirement("PAY-02", { ...FACTS, paymentTerms: ["lc"] });
    expect(pay02.status).toBe("not_applicable");
    expect(pay02.reason).toBe("Applies only if payment is wholly or partly cash against documents. That is not the case.");
    expect(requirement("POR-01", { ...FACTS, incoterm: "FCA" }).status).toBe("not_applicable");
  });

  it("is undetermined while its condition depends on a fact not recorded yet", () => {
    const { paymentTerms: _, ...unknown } = FACTS;
    expect(requirement("PAY-02", unknown)).toMatchObject({
      status: "undetermined",
      reason: "Applies only if payment is wholly or partly cash against documents. Not known yet.",
    });
  });

  it("does not apply once a person marks all its steps not applicable", () => {
    const exempt = { reason: "Only the exporter's own farm holds the coffee, which is exempt (21 CFR 1.226)." };
    const usp01 = requirement("USP-01", FACTS, {
      "STEP-038": { status: "not_applicable", ...exempt },
      "STEP-039": { status: "not_applicable", ...exempt },
    });
    expect(usp01.status).toBe("not_applicable");
    expect(usp01.reason).toBe(`Its steps don't apply: STEP-038 (${exempt.reason}); STEP-039 (${exempt.reason})`);
  });

  it("follows the steps' own conditions where it has none", () => {
    expect(requirement("USP-04", FACTS).status).toBe("blocked");
    expect(requirement("USP-04", { ...FACTS, transportMode: "air" }).status).toBe("not_applicable");
    expect(requirement("USE-01", { ...FACTS, destinationCountry: "TR" }).status).toBe("not_applicable");
  });
});
