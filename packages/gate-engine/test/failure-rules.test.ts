import { FAILURE_RULES, STEPS, type StepId } from "@entrust/rules";
import { describe, expect, it } from "vitest";
import {
  CHECKED_FAILURE_RULES,
  CLOCK_INPUT_SET,
  STEP_COMPLETED,
  TransitionError,
  checkFailureRules,
  checkMinimumPrice,
  evaluateCase,
  evaluateDeadlines,
  reconcileFlags,
  transitionStep,
} from "../src";
import type { CaseEvent, CaseFacts, CaseState, ClockInputKey, EvidenceRecord, HeldFlag, MinimumPrice, MinimumPriceCheck, RecordedStatus } from "../src";

const NOW = "2026-10-23T09:00:00Z";
const US_SEA: CaseFacts = { product: "green_coffee", destinationCountry: "US", transportMode: "sea" };

const done = (stepId: StepId, occurredAt: string): CaseEvent => ({ type: STEP_COMPLETED, stepId, occurredAt });
const input = (key: ClockInputKey, value: string): CaseEvent => ({ type: CLOCK_INPUT_SET, occurredAt: "2026-10-01", data: { key, value } });
const approved = (...types: string[]): EvidenceRecord[] => types.map((type) => ({ type, status: "approved" }));

/** Step records for the given recorded statuses. */
const records = (steps: Partial<Record<StepId, RecordedStatus>>): CaseState["steps"] =>
  Object.fromEntries(Object.entries(steps).flatMap(([id, status]) => (status ? [[id, { status }]] : []))) as CaseState["steps"];

interface Scenario {
  facts?: CaseFacts;
  steps?: Partial<Record<StepId, RecordedStatus>>;
  evidence?: EvidenceRecord[];
  events?: CaseEvent[];
  minimumPrice?: MinimumPriceCheck | null;
  now?: string;
}

function fire({ facts = US_SEA, steps = {}, evidence = [], events = [], minimumPrice, now = NOW }: Scenario = {}) {
  const state: CaseState = {
    facts,
    steps: records(steps),
    evidence,
    raisedExceptions: [],
  };
  const evaluation = evaluateCase(STEPS, state, { asOf: now });
  const clocks = evaluateDeadlines(STEPS, { facts, steps: state.steps, events }, { now });
  return checkFailureRules(STEPS, { state, evaluation, clocks, events, minimumPrice }, { now });
}
const rulesFired = (scenario?: Scenario) => fire(scenario).map((f) => f.rule);
const only = (rule: string, scenario?: Scenario) => fire(scenario).find((f) => f.rule === rule);

describe("FL-01 product misclassification", () => {
  it("fires when an admissibility step has started and the HS code is not verified", () => {
    const flag = only("FL-01", { steps: { "STEP-037": "in_progress" } });
    expect(flag).toMatchObject({ severity: "high", blocks: ["STEP-037", "STEP-054"] });
    expect(flag?.message).toBe("The HS code (STEP-010) is not verified, but STEP-037 has started.");
    expect(only("FL-01", { steps: { "STEP-036": "completed", "STEP-042": "awaiting_authority" } })?.message).toMatch(/STEP-036, STEP-042 have started/);
  });

  it("stays quiet once the HS code is verified with its evidence, or while no admissibility step has started", () => {
    const started = { "STEP-037": "in_progress" } as const;
    expect(rulesFired({ steps: { ...started, "STEP-010": "completed" }, evidence: approved("hs_classification") })).not.toContain("FL-01");
    expect(rulesFired({ steps: { ...started, "STEP-010": "completed" } })).toContain("FL-01"); // evidence not approved
    expect(rulesFired({ steps: { "STEP-037": "not_started", "STEP-001": "completed" } })).not.toContain("FL-01");
  });
});

describe("FL-02 commercial term conflict", () => {
  it("fires on a letter of credit and cash against documents together", () => {
    const flag = only("FL-02", { facts: { ...US_SEA, paymentTerms: ["lc", "cad"] } });
    expect(flag).toMatchObject({ severity: "critical", raises: ["STEP-029"], blocks: ["STEP-033", "STEP-035"] });
    expect(flag?.message).toMatch(/letter of credit and cash against documents are both recorded/);
  });

  it("does not fire on an advance with the balance by CAD, which is the pilot case's normal split", () => {
    expect(rulesFired({ facts: { ...US_SEA, incoterm: "FOB", paymentTerms: ["advance_tt", "cad"] } })).not.toContain("FL-02");
    expect(rulesFired({ facts: { ...US_SEA, paymentTerms: ["advance_tt", "lc"] } })).not.toContain("FL-02");
  });

  it("fires on an Incoterm for sea transport with air cargo", () => {
    for (const incoterm of ["FOB", "CFR", "CIF"]) {
      expect(only("FL-02", { facts: { ...US_SEA, transportMode: "air", incoterm } })?.message, incoterm).toMatch(
        new RegExp(`${incoterm} is an Incoterm for sea transport, but the cargo goes by air`),
      );
    }
    expect(rulesFired({ facts: { ...US_SEA, transportMode: "air", incoterm: "FCA" } })).not.toContain("FL-02");
    expect(rulesFired({ facts: { ...US_SEA, transportMode: "sea", incoterm: "FOB" } })).not.toContain("FL-02");
  });

  it("reports both problems in one flag, and waits for facts that aren't recorded", () => {
    const both = only("FL-02", { facts: { ...US_SEA, transportMode: "air", incoterm: "cif", paymentTerms: ["lc", "cad"] } });
    expect(both?.message).toMatch(/both recorded as the payment instrument; CIF is an Incoterm for sea/);
    expect(rulesFired({ facts: { product: "green_coffee", destinationCountry: "US" } })).not.toContain("FL-02");
  });
});

describe("FL-03 price below the minimum export price", () => {
  const checkOf = (amount: number, rest: Partial<MinimumPrice> = {}) =>
    checkMinimumPrice(
      { contractDate: "2026-10-22", unitPrice: { amount, currency: "USD", unit: "kg" }, coffeeType: "washed", grade: "1", origin: null },
      [
        {
          id: "p1", tableId: "t1", recordedAt: "2026-10-19T08:00:00Z", effectiveFrom: "2026-10-20", effectiveTo: "2026-10-26",
          coffeeType: "washed", grade: "1", origin: null, currency: "USD", unit: "kg", minPrice: 6.61, ...rest,
        },
      ],
    );

  it("fires with the words of the check when the price is below the floor", () => {
    const minimumPrice = checkOf(5.9);
    const flag = only("FL-03", { minimumPrice });
    expect(flag).toMatchObject({ severity: "high", raises: ["STEP-029"], blocks: ["STEP-033", "STEP-035"], message: minimumPrice.message });
    expect(flag?.message).toMatch(/^The contract price of 5\.90 USD\/kg is below the minimum export price of 6\.61 USD\/kg/);
  });

  it("stays quiet for a price at the floor, and when the check can't tell", () => {
    expect(rulesFired({ minimumPrice: checkOf(6.61) })).not.toContain("FL-03");
    expect(rulesFired({ minimumPrice: checkOf(5.9, { effectiveFrom: "2026-11-01", effectiveTo: "2026-11-07" }) })).not.toContain("FL-03"); // no price on file
    expect(rulesFired({ minimumPrice: checkOf(5.9, { currency: "EUR" }) })).not.toContain("FL-03"); // different currency
    expect(rulesFired({ minimumPrice: checkMinimumPrice(null, []) })).not.toContain("FL-03");
    expect(rulesFired({ minimumPrice: null })).not.toContain("FL-03");
    expect(rulesFired()).not.toContain("FL-03");
  });

  it("is for coffee: it stays quiet where STEP-024 doesn't apply, and keeps firing once the step is done", () => {
    const minimumPrice = checkOf(5.9);
    expect(rulesFired({ facts: { ...US_SEA, product: "fresh_produce" }, minimumPrice })).not.toContain("FL-03");
    expect(rulesFired({ steps: { "STEP-024": "completed" }, minimumPrice })).toContain("FL-03"); // still wrong after the step is done
  });
});

describe("FL-04 US FDA registration or Prior Notice missing", () => {
  it("fires when the cargo has departed without the facility registration verified", () => {
    const flag = only("FL-04", { steps: { "STEP-104": "completed" } });
    expect(flag).toMatchObject({ severity: "critical", raises: ["STEP-053"], blocks: ["STEP-054", "STEP-106"] });
    expect(flag?.message).toBe("The cargo has departed without the FDA food facility registration (STEP-038) verified.");
    expect(rulesFired({ steps: { "STEP-104": "completed", "STEP-038": "completed" }, evidence: approved("fda_facility_registration") })).not.toContain("FL-04");
    expect(rulesFired({ steps: { "STEP-104": "in_progress" } })).not.toContain("FL-04");
  });

  it("fires when the Prior Notice deadline has passed unfiled, or was filed late", () => {
    const arrival = input("estimatedArrival", "2026-10-20T12:00:00Z"); // due 04:00 UTC the same day
    expect(only("FL-04", { events: [arrival] })?.message).toBe("The Prior Notice deadline has passed and it is not filed.");
    const late = [arrival, done("STEP-095", "2026-10-20T05:00:00Z")];
    expect(only("FL-04", { events: late })?.message).toBe("The Prior Notice was filed after its deadline.");
    const onTime = [arrival, done("STEP-095", "2026-10-20T04:00:00Z")];
    expect(rulesFired({ events: onTime })).not.toContain("FL-04");
    expect(rulesFired({ events: [input("estimatedArrival", "2026-10-30T12:00:00Z")] })).not.toContain("FL-04");
  });

  it("is only for cargo bound for the US", () => {
    const events = [input("estimatedArrival", "2026-10-20T12:00:00Z")];
    expect(rulesFired({ facts: { ...US_SEA, destinationCountry: "DE" }, steps: { "STEP-104": "completed" }, events })).not.toContain("FL-04");
  });
});

describe("FL-07 equipment not confirmed before haulage", () => {
  const haulage = input("plannedHaulage", "2026-11-02"); // the start of 2 November in Addis Ababa: 21:00 UTC on the 1st

  it("fires from 7 days before the planned haulage, to the moment", () => {
    expect(rulesFired({ events: [haulage], now: "2026-10-25T20:59:59Z" })).not.toContain("FL-07");
    const flag = only("FL-07", { events: [haulage], now: "2026-10-25T21:00:00Z" });
    expect(flag).toMatchObject({ severity: "medium", raises: ["STEP-090"], blocks: ["STEP-078"] });
    expect(flag?.message).toBe("Container equipment (STEP-075) is not confirmed, and the dry port haulage is planned for 2026-11-02.");
  });

  it("stays quiet when the equipment is confirmed, the date is unknown, or the cargo isn't in containers", () => {
    const late = { events: [haulage], now: "2026-10-30T00:00:00Z" };
    expect(rulesFired({ ...late, steps: { "STEP-075": "completed" }, evidence: approved("equipment_release") })).not.toContain("FL-07");
    expect(rulesFired({ now: "2026-10-30T00:00:00Z" })).not.toContain("FL-07");
    expect(rulesFired({ ...late, facts: { ...US_SEA, transportMode: "air" } })).not.toContain("FL-07");
  });
});

describe("FL-08 FX proceeds not repatriated in time", () => {
  const permit = (issued: string) => done("STEP-048", issued);

  it("fires once the 90 days have passed without the proceeds", () => {
    const flag = only("FL-08", { events: [permit("2026-07-01")] }); // 90 days later is 2026-09-29
    expect(flag).toMatchObject({ severity: "critical", raises: ["STEP-122"], blocks: ["STEP-125"] });
    expect(flag?.message).toBe("The proceeds were due by 2026-09-29 and have not been repatriated.");
  });

  it("stays quiet while the days run and when the proceeds came in time", () => {
    expect(rulesFired({ events: [permit("2026-10-01")] })).not.toContain("FL-08");
    expect(rulesFired({ events: [permit("2026-07-01"), done("STEP-117", "2026-09-29")] })).not.toContain("FL-08");
  });

  it("keeps firing when the proceeds came in late", () => {
    const flag = only("FL-08", { events: [permit("2026-07-01"), done("STEP-117", "2026-09-30")] });
    expect(flag?.message).toBe("The proceeds were repatriated after the 2026-09-29 deadline.");
  });
});

describe("FL-09 bank or FX process not confirmed before dispatch", () => {
  const verifiedBasics = {
    steps: { "STEP-078": "in_progress", "STEP-015": "completed", "STEP-025": "completed" },
    evidence: approved("bank_account_confirmation"),
  } as const;

  it("fires when dispatch has started and the bank account and payment instrument aren't confirmed", () => {
    const flag = only("FL-09", { steps: { "STEP-078": "in_progress" } });
    expect(flag).toMatchObject({ severity: "critical", blocks: ["STEP-078", "STEP-104"] });
    expect(flag?.message).toBe(
      "Dispatch has started, but these are not confirmed: the exporter's bank account for FX (STEP-015), the payment instrument (STEP-025).",
    );
    expect(only("FL-09", { steps: { "STEP-104": "completed" } })).toBeDefined();
  });

  it("stays quiet before dispatch, and once the bank side is confirmed", () => {
    expect(rulesFired({ steps: { "STEP-078": "not_started" } })).not.toContain("FL-09");
    expect(rulesFired(verifiedBasics)).not.toContain("FL-09");
  });

  it("wants the LC terms and the LC expiry for a letter of credit, and the collecting bank for CAD", () => {
    const lc = { ...verifiedBasics, facts: { ...US_SEA, paymentTerms: ["lc"] } };
    expect(only("FL-09", lc)?.message).toMatch(/the letter of credit terms \(STEP-026\), the LC expiry date/);
    const confirmed = { ...lc, steps: { ...lc.steps, "STEP-026": "completed" }, evidence: approved("bank_account_confirmation", "letter_of_credit") } as const;
    expect(only("FL-09", confirmed)?.message).toMatch(/the LC expiry date, which sets the presentation deadline\.$/);
    expect(rulesFired({ ...confirmed, events: [input("lcExpiry", "2026-12-31")] })).not.toContain("FL-09");

    const cad = { ...verifiedBasics, facts: { ...US_SEA, paymentTerms: ["advance_tt", "cad"] } };
    expect(only("FL-09", cad)?.message).toMatch(/the CAD agreement and collecting bank \(STEP-027\)/);
  });
});

describe("FL-12 transport document or payment handoff failure", () => {
  const lc: CaseFacts = { ...US_SEA, paymentTerms: ["lc"] };
  const shipped = done("STEP-104", "2026-09-01"); // 21 days later is 2026-09-22

  it("fires when the documents are past the LC presentation deadline, or reached the bank late", () => {
    expect(only("FL-12", { facts: lc, events: [shipped] })?.message).toBe("The documents were due by 2026-09-22 and have not been presented to the bank.");
    const late = only("FL-12", { facts: lc, events: [shipped, done("STEP-110", "2026-09-23")] });
    expect(late).toMatchObject({ severity: "critical", blocks: ["STEP-125"] });
    expect(late?.message).toBe("The documents were presented to the bank after the 2026-09-22 deadline.");
  });

  it("stays quiet when they were presented in time, or the payment isn't by letter of credit", () => {
    expect(rulesFired({ facts: lc, events: [shipped, done("STEP-110", "2026-09-22")] })).not.toContain("FL-12");
    expect(rulesFired({ events: [shipped] })).not.toContain("FL-12");
  });
});

describe("FL-13 case can't close", () => {
  it("fires when a completed delivery or payment step has lost its approved evidence", () => {
    const flag = only("FL-13", { steps: { "STEP-117": "completed", "STEP-107": "completed" }, evidence: approved("proof_of_delivery") });
    expect(flag).toMatchObject({ severity: "high", blocks: ["STEP-125"] });
    expect(flag?.message).toBe("Delivery or payment evidence is no longer approved and in date: STEP-117 (swift_mt103).");
    expect(rulesFired({ steps: { "STEP-117": "completed" }, evidence: approved("swift_mt103") })).not.toContain("FL-13");
    expect(rulesFired({ steps: { "STEP-117": "in_progress" } })).not.toContain("FL-13");
  });
});

describe("FL-14 conflicting or missing source data", () => {
  it("fires when the step that establishes a fact is complete but the fact is unknown, holding that phase's sign-off", () => {
    const flag = only("FL-14", { steps: { "STEP-025": "completed" } });
    expect(flag).toMatchObject({ severity: "critical", blocks: ["STEP-035"] });
    expect(flag?.message).toBe("A step that establishes a fact is complete, but the fact is not recorded: Payment terms (STEP-025).");
    const two = only("FL-14", { steps: { "STEP-025": "completed", "STEP-022": "completed", "STEP-082": "completed" } });
    expect(two?.message).toMatch(/Payment terms \(STEP-025\), Incoterm \(STEP-022\), Customs risk channel \(STEP-082\)/);
    expect(two?.blocks).toEqual(["STEP-035", "STEP-091"]);
  });

  it("stays quiet when the fact is recorded or its step isn't complete", () => {
    expect(rulesFired({ facts: { ...US_SEA, paymentTerms: ["cad"] }, steps: { "STEP-025": "completed" } })).not.toContain("FL-14");
    expect(rulesFired({ steps: { "STEP-025": "in_progress" } })).not.toContain("FL-14");
  });
});

describe("the rules together", () => {
  it("fire nothing on a fresh case or on the pilot case's commercial terms", () => {
    expect(fire()).toEqual([]);
    expect(fire({ facts: { ...US_SEA, incoterm: "FOB", paymentTerms: ["advance_tt", "cad"], coldChain: "no" } })).toEqual([]);
  });

  it("have a check, or say what they are waiting on", () => {
    const dormant = FAILURE_RULES.filter((r) => !CHECKED_FAILURE_RULES.includes(r.id));
    expect(dormant.map((r) => r.id)).toEqual(["FL-05", "FL-06", "FL-10", "FL-11"]);
    for (const rule of dormant) expect(rule.waitingOn, rule.id).toBeTruthy();
    for (const id of CHECKED_FAILURE_RULES) expect(FAILURE_RULES.some((r) => r.id === id), id).toBe(true);
  });

  it("return the rule's severity, the steps it raises and the steps it holds", () => {
    const [flag] = fire({ facts: { ...US_SEA, paymentTerms: ["lc", "cad"] } });
    const rule = FAILURE_RULES.find((r) => r.id === "FL-02");
    expect(flag).toMatchObject({ rule: "FL-02", severity: rule?.severity, raises: rule?.raises, blocks: rule?.blocks });
  });
});

describe("reconcileFlags", () => {
  const triggered = (rule: string, message = "Because.") => ({ rule, severity: "high", message, raises: [], blocks: [] }) as never;
  const flag = (rule: string, status: string, message = "Because.") => ({ id: `${rule}-${status}`, rule, status, message });

  it("raises a flag for a rule that fires with none active", () => {
    expect(reconcileFlags([triggered("FL-02")], []).raise.map((t) => t.rule)).toEqual(["FL-02"]);
  });

  it("keeps an open or waived flag while its rule keeps firing, so a waiver isn't undone", () => {
    for (const status of ["open", "waived"]) {
      expect(reconcileFlags([triggered("FL-02")], [flag("FL-02", status)])).toEqual({ raise: [], resolve: [], refresh: [] });
    }
  });

  it("resolves an active flag when its rule stops firing, waived or not", () => {
    expect(reconcileFlags([], [flag("FL-02", "open"), flag("FL-04", "waived")]).resolve.map((f) => f.id)).toEqual(["FL-02-open", "FL-04-waived"]);
  });

  it("raises a new flag when a rule fires again after its flag resolved", () => {
    const changes = reconcileFlags([triggered("FL-02")], [flag("FL-02", "resolved")]);
    expect(changes.raise.map((t) => t.rule)).toEqual(["FL-02"]);
    expect(changes.resolve).toEqual([]);
  });

  it("refreshes the words when the rule still fires with different ones", () => {
    const changes = reconcileFlags([triggered("FL-09", "Now only STEP-025 is missing.")], [flag("FL-09", "open", "STEP-015 and STEP-025 are missing.")]);
    expect(changes.refresh).toEqual([{ flag: flag("FL-09", "open", "STEP-015 and STEP-025 are missing."), message: "Now only STEP-025 is missing." }]);
  });
});

describe("flags holding steps", () => {
  const held = (rule: string, ...blocks: StepId[]): HeldFlag => ({ rule, message: "Terms conflict.", blocks });
  const run = (flags: HeldFlag[], steps: Partial<Record<StepId, RecordedStatus>> = {}, evidence: EvidenceRecord[] = []) =>
    evaluateCase(STEPS, { facts: US_SEA, steps: records(steps), evidence, raisedExceptions: [], flags }, { asOf: NOW });
  const step = (evaluation: ReturnType<typeof run>, id: string) => {
    const found = evaluation.steps.find((s) => s.id === id);
    if (!found) throw new Error(id);
    return found;
  };

  it("blocks a step the flag holds, with the flag as the reason", () => {
    const s = step(run([held("FL-02", "STEP-001")]), "STEP-001");
    expect(s).toMatchObject({ status: "blocked", derived: true, heldBy: ["FL-02"], canComplete: false, reason: "Held by FL-02: Terms conflict." });
    expect(step(run([]), "STEP-001")).toMatchObject({ status: "not_started", heldBy: [] });
  });

  it("refuses to work a held step, naming the flag, but lets Entrust mark it not applicable", () => {
    const s = step(run([held("FL-02", "STEP-001")]), "STEP-001");
    expect(() => transitionStep(s, { to: "in_progress", actor: "owner" })).toThrow(new TransitionError("precondition_failed", "STEP-001 is held by FL-02."));
    expect(transitionStep(s, { to: "not_applicable", actor: "facilitator", reason: "Waived by Entrust" }).action).toBe("mark_not_applicable");
  });

  it("names both a prerequisite and a flag when both hold a step", () => {
    const s = step(run([held("FL-02", "STEP-002")]), "STEP-002");
    expect(s.reason).toBe("Waiting on STEP-001. Held by FL-02: Terms conflict.");
    expect(() => transitionStep(s, { to: "in_progress", actor: "facilitator" })).toThrow("STEP-002 is waiting on STEP-001 and held by FL-02.");
  });

  it("leaves a completed step completed, with a warning", () => {
    const s = step(run([held("FL-02", "STEP-001")], { "STEP-001": "completed" }), "STEP-001");
    expect(s.status).toBe("completed");
    expect(s.warnings).toContain("Completed, but FL-02 is open.");
  });

  it("keeps a phase gate shut when the flag holds only its sign-off", () => {
    const all = STEPS.filter((s) => s.phase === 1 && !s.milestone);
    const steps = Object.fromEntries(all.map((s) => [s.id, "completed" as const]));
    const evidence = approved(...new Set(all.flatMap((s) => s.evidence.map((e) => e.type))));
    expect(run([], steps, evidence).phases[0]).toMatchObject({ status: "ready", outstanding: [] });
    const gate = run([held("FL-01", "STEP-018")], steps, evidence).phases[0];
    expect(gate).toMatchObject({ status: "open" });
    expect(gate?.outstanding).toEqual([{ stepId: "STEP-018", reason: "Held by FL-01: Terms conflict." }]);
  });
});
