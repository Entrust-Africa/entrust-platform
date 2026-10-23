import { STEPS, type StepId } from "@entrust/rules";
import { describe, expect, it } from "vitest";
import {
  CAD_CAP_USD,
  CLOCK_INPUT_KEYS,
  CLOCK_INPUT_SET,
  DEADLINE_CLOCKS,
  STEP_COMPLETED,
  checkCadCap,
  dueReminders,
  evaluateDeadlines,
} from "../src";
import type { CaseEvent, CaseFacts, ClockId, ClockInputKey, DeadlineInput } from "../src";

// Times are written in Ethiopian time (+03:00) and compared as instants, so a day boundary in the
// test is a day boundary there.
const z = (value: string) => new Date(value).toISOString();

const completed = (stepId: StepId, occurredAt: string): CaseEvent => ({ type: STEP_COMPLETED, stepId, occurredAt });
const setInput = (key: ClockInputKey, value: string): CaseEvent => ({
  type: CLOCK_INPUT_SET,
  occurredAt: "2026-10-01T00:00:00Z",
  data: { key, value },
});

const US_SEA: CaseFacts = { product: "green_coffee", destinationCountry: "US", transportMode: "sea" };
const input = (events: CaseEvent[], facts: CaseFacts = US_SEA): DeadlineInput => ({ facts, events });

const clockOf = (id: ClockId, i: DeadlineInput, now: string) => {
  const found = evaluateDeadlines(STEPS, i, { now }).find((c) => c.id === id);
  if (!found) throw new Error(`no clock ${id}`);
  return found;
};
const remindersAt = (i: DeadlineInput, now: string) => dueReminders(STEPS, i, { now });

const NOW = "2026-10-02T10:00:00+03:00";

describe("export permit validity (FXD/01/2024 Art. 7.1.6)", () => {
  const permit = input([completed("STEP-048", "2026-10-01")]);

  it("is valid through the 30th day after issue", () => {
    const clock = clockOf("permit_validity", permit, NOW);
    expect(clock.due).toEqual({ day: "2026-10-31" });
    expect(clockOf("permit_validity", permit, "2026-10-31T23:59:59+03:00").state).toBe("running");
    expect(clockOf("permit_validity", permit, "2026-11-01T00:00:00+03:00").state).toBe("overdue");
  });

  it("is met by lodging the declaration on the last day, and late the day after", () => {
    const lodged = (when: string) => input([completed("STEP-048", "2026-10-01"), completed("STEP-080", when)]);
    expect(clockOf("permit_validity", lodged("2026-10-31T23:59:59.999+03:00"), NOW).state).toBe("met");
    expect(clockOf("permit_validity", lodged("2026-11-01T00:00:00+03:00"), NOW).state).toBe("met_late");
  });

  it("counts the issue day in Ethiopian time, not UTC", () => {
    // 00:30 on 1 October in Addis Ababa is still 30 September in UTC.
    const lateEvening = input([completed("STEP-048", "2026-09-30T21:30:00Z")]);
    expect(clockOf("permit_validity", lateEvening, NOW).due).toEqual({ day: "2026-10-31" });
  });

  it("warns 7 days before the last day, then reports it overdue", () => {
    expect(remindersAt(permit, "2026-10-23T23:59:59+03:00")).toEqual([]);
    expect(remindersAt(permit, "2026-10-24T00:00:00+03:00")).toMatchObject([
      { key: "permit_validity:warn-7d:2026-10-31", kind: "warning", stepId: "STEP-080" },
    ]);
    expect(remindersAt(permit, "2026-11-01T00:00:00+03:00")).toMatchObject([
      { key: "permit_validity:overdue:2026-10-31", kind: "overdue" },
    ]);
  });

  it("waits until the permit issue date is recorded", () => {
    const clock = clockOf("permit_validity", input([]), NOW);
    expect(clock).toMatchObject({ state: "waiting", due: null, startedAt: null, alerts: [] });
    expect(remindersAt(input([]), NOW)).toEqual([]);
  });

  it("uses the latest recorded issue date", () => {
    const corrected = input([completed("STEP-048", "2026-10-01"), completed("STEP-048", "2026-10-05")]);
    expect(clockOf("permit_validity", corrected, NOW).due).toEqual({ day: "2026-11-04" });
  });
});

describe("FX proceeds repatriation (FXD/01/2024 Annex One 1.3.7(d))", () => {
  const permit = input([completed("STEP-048", "2026-10-01")]);

  it("falls due 90 days after the permit issue date, with alerts at day 60 and day 75", () => {
    const clock = clockOf("fx_repatriation", permit, NOW);
    expect(clock.due).toEqual({ day: "2026-12-30" });
    expect(clock.alerts).toEqual([
      { key: "warn-30d", kind: "warning", at: z("2026-11-30T00:00:00+03:00") },
      { key: "warn-15d", kind: "warning", at: z("2026-12-15T00:00:00+03:00") },
      { key: "overdue", kind: "overdue", at: z("2026-12-31T00:00:00+03:00") },
    ]);
  });

  it.each([
    ["the day before day 60", "2026-11-29T23:59:59+03:00", undefined],
    ["day 60", "2026-11-30T00:00:00+03:00", "fx_repatriation:warn-30d:2026-12-30"],
    ["the day before day 75", "2026-12-14T23:59:59+03:00", "fx_repatriation:warn-30d:2026-12-30"],
    ["day 75", "2026-12-15T00:00:00+03:00", "fx_repatriation:warn-15d:2026-12-30"],
    ["day 90, the last day", "2026-12-30T23:59:59+03:00", "fx_repatriation:warn-15d:2026-12-30"],
    ["day 91", "2026-12-31T00:00:00+03:00", "fx_repatriation:overdue:2026-12-30"],
  ])("sends the right reminder on %s", (_, now, key) => {
    const fx = remindersAt(permit, now).filter((r) => r.clock === "fx_repatriation");
    expect(fx.map((r) => r.key)).toEqual(key ? [key] : []);
  });

  it("sends only the latest alert when the case is recorded late", () => {
    const fx = remindersAt(permit, "2026-12-20T09:00:00+03:00").filter((r) => r.clock === "fx_repatriation");
    expect(fx.map((r) => r.kind)).toEqual(["warning"]);
    expect(fx[0]?.key).toBe("fx_repatriation:warn-15d:2026-12-30");
  });

  it("is met when the proceeds are settled by the last day, and late after it", () => {
    const settled = (when: string) => input([completed("STEP-048", "2026-10-01"), completed("STEP-117", when)]);
    expect(clockOf("fx_repatriation", settled("2026-12-30"), "2027-01-15T00:00:00+03:00").state).toBe("met");
    expect(clockOf("fx_repatriation", settled("2026-12-31"), "2027-01-15T00:00:00+03:00").state).toBe("met_late");
    const fx = remindersAt(settled("2026-12-30"), "2027-01-15T00:00:00+03:00").filter((r) => r.clock === "fx_repatriation");
    expect(fx).toEqual([]);
  });

  it("counts through 29 February in a leap year", () => {
    const due = (issued: string) => clockOf("fx_repatriation", input([completed("STEP-048", issued)]), NOW).due;
    expect(due("2028-01-15")).toEqual({ day: "2028-04-14" });
    expect(due("2027-01-15")).toEqual({ day: "2027-04-15" });
  });
});

describe("LC presentation (UCP 600 Art. 14(c))", () => {
  const lc: CaseFacts = { ...US_SEA, paymentTerms: ["lc"] };
  const shipped = completed("STEP-104", "2026-10-10");

  it("is due 21 days after shipment, with the shipment day excluded", () => {
    expect(clockOf("lc_presentation", input([shipped], lc), NOW).due).toEqual({ day: "2026-10-31" });
  });

  it("is met on the 21st day and late on the 22nd", () => {
    const presented = (when: string) => input([shipped, completed("STEP-110", when)], lc);
    expect(clockOf("lc_presentation", presented("2026-10-31"), NOW).state).toBe("met");
    expect(clockOf("lc_presentation", presented("2026-11-01"), NOW).state).toBe("met_late");
  });

  it("takes the credit's expiry when that comes first", () => {
    const clock = clockOf("lc_presentation", input([shipped, setInput("lcExpiry", "2026-10-25")], lc), NOW);
    expect(clock.due).toEqual({ day: "2026-10-25" });
    expect(clock.notes).toEqual(["The credit expires on 2026-10-25, before the 21 days end on 2026-10-31."]);
  });

  it("keeps the 21 days when the credit expires on that day or later", () => {
    for (const expiry of ["2026-10-31", "2026-11-15"]) {
      const clock = clockOf("lc_presentation", input([shipped, setInput("lcExpiry", expiry)], lc), NOW);
      expect(clock.due, expiry).toEqual({ day: "2026-10-31" });
      expect(clock.notes, expiry).toEqual([]);
    }
  });

  it("counts the expiry in Ethiopian time when it is given as a timestamp", () => {
    const expiry = setInput("lcExpiry", "2026-10-24T22:00:00Z"); // 01:00 on the 25th in Addis Ababa
    expect(clockOf("lc_presentation", input([shipped, expiry], lc), NOW).due).toEqual({ day: "2026-10-25" });
  });

  it("says so when the expiry is not recorded yet", () => {
    const clock = clockOf("lc_presentation", input([shipped], lc), NOW);
    expect(clock.notes).toHaveLength(1);
    expect(clock.notes[0]).toMatch(/expiry date is not recorded/);
  });

  it("uses the latest recorded expiry", () => {
    const events = [shipped, setInput("lcExpiry", "2026-10-20"), setInput("lcExpiry", "2026-11-30")];
    expect(clockOf("lc_presentation", input(events, lc), NOW).due).toEqual({ day: "2026-10-31" });
  });

  it("applies only to letters of credit", () => {
    const events = [shipped];
    expect(clockOf("lc_presentation", input(events, { ...US_SEA, paymentTerms: ["advance_tt", "cad"] }), NOW).state).toBe("not_applicable");
    expect(clockOf("lc_presentation", input(events, US_SEA), NOW).state).toBe("undetermined");
  });

  it("warns 7 days before the last day", () => {
    const i = input([shipped], lc);
    expect(remindersAt(i, "2026-10-23T23:59:59+03:00").filter((r) => r.clock === "lc_presentation")).toEqual([]);
    expect(remindersAt(i, "2026-10-24T00:00:00+03:00").map((r) => r.key)).toContain("lc_presentation:warn-7d:2026-10-31");
  });
});

describe("ISF filing (19 CFR 149.2(b))", () => {
  const loading = setInput("plannedLoading", "2026-11-10T09:00:00+03:00");

  it("is due 24 hours before loading", () => {
    const clock = clockOf("isf_filing", input([loading]), NOW);
    expect(clock.due).toEqual({ at: z("2026-11-09T09:00:00+03:00") });
    expect(clock.startedAt).toBe(z("2026-11-10T09:00:00+03:00"));
  });

  it("is on time at the exact deadline and overdue a moment later", () => {
    const i = input([loading]);
    expect(clockOf("isf_filing", i, "2026-11-09T09:00:00.000+03:00").state).toBe("running");
    expect(clockOf("isf_filing", i, "2026-11-09T09:00:00.001+03:00").state).toBe("overdue");
  });

  it("is met when filed at the deadline and late a second after", () => {
    expect(clockOf("isf_filing", input([loading, completed("STEP-097", "2026-11-09T09:00:00+03:00")]), NOW).state).toBe("met");
    expect(clockOf("isf_filing", input([loading, completed("STEP-097", "2026-11-09T09:00:01+03:00")]), NOW).state).toBe("met_late");
  });

  it("warns 24 hours before the deadline", () => {
    const i = input([loading]);
    expect(remindersAt(i, "2026-11-08T08:59:59+03:00")).toEqual([]);
    expect(remindersAt(i, "2026-11-08T09:00:00+03:00")).toMatchObject([{ clock: "isf_filing", kind: "warning" }]);
  });

  it("moves with the planned loading time", () => {
    const moved = input([loading, setInput("plannedLoading", "2026-11-12T15:00:00+03:00")]);
    expect(clockOf("isf_filing", moved, NOW).due).toEqual({ at: z("2026-11-11T15:00:00+03:00") });
  });

  it("applies only to sea cargo bound for the US", () => {
    const events = [loading];
    expect(clockOf("isf_filing", input(events, { ...US_SEA, transportMode: "air" }), NOW).state).toBe("not_applicable");
    expect(clockOf("isf_filing", input(events, { ...US_SEA, destinationCountry: "TR" }), NOW).state).toBe("not_applicable");
    expect(clockOf("isf_filing", input(events, { destinationCountry: "US" }), NOW).state).toBe("undetermined");
    expect(clockOf("isf_filing", input(events, { destinationCountry: "TR" }), NOW).state).toBe("not_applicable");
  });

  it("waits for the planned loading time", () => {
    expect(clockOf("isf_filing", input([]), NOW).state).toBe("waiting");
  });
});

describe("FDA Prior Notice (21 CFR 1.279)", () => {
  const arrival = setInput("estimatedArrival", "2026-11-20T12:00:00Z");

  it("is due 8 hours before arrival by sea and 4 hours by air", () => {
    expect(clockOf("prior_notice", input([arrival]), NOW).due).toEqual({ at: z("2026-11-20T04:00:00Z") });
    expect(clockOf("prior_notice", input([arrival], { ...US_SEA, transportMode: "air" }), NOW).due).toEqual({
      at: z("2026-11-20T08:00:00Z"),
    });
  });

  it("is on time at the exact deadline and overdue a moment later", () => {
    const i = input([arrival]);
    expect(clockOf("prior_notice", i, "2026-11-20T04:00:00.000Z").state).toBe("running");
    expect(clockOf("prior_notice", i, "2026-11-20T04:00:00.001Z").state).toBe("overdue");
  });

  it("opens 30 days before arrival through ABI/ACE and 15 through PNSI", () => {
    const opens = (system: string) =>
      clockOf("prior_notice", input([arrival, setInput("priorNoticeSystem", system)]), NOW).opensAt;
    expect(opens("ace")).toBe(z("2026-10-21T12:00:00Z"));
    expect(opens("ACE")).toBe(z("2026-10-21T12:00:00Z"));
    expect(opens("pnsi")).toBe(z("2026-11-05T12:00:00Z"));
  });

  it("assumes the stricter reading when the mode and system are not recorded", () => {
    const clock = clockOf("prior_notice", input([arrival], { destinationCountry: "US" }), NOW);
    expect(clock.due).toEqual({ at: z("2026-11-20T04:00:00Z") });
    expect(clock.opensAt).toBe(z("2026-11-05T12:00:00Z"));
    expect(clock.notes).toHaveLength(2);
  });

  it("has no notes once the mode and system are known", () => {
    const clock = clockOf("prior_notice", input([arrival, setInput("priorNoticeSystem", "ace")]), NOW);
    expect(clock.notes).toEqual([]);
  });

  it("is met when filed in time and late after the deadline", () => {
    expect(clockOf("prior_notice", input([arrival, completed("STEP-095", "2026-11-20T04:00:00Z")]), NOW).state).toBe("met");
    expect(clockOf("prior_notice", input([arrival, completed("STEP-095", "2026-11-20T04:01:00Z")]), NOW).state).toBe("met_late");
  });

  it("applies to cargo bound for the US, by sea or air, and no other", () => {
    expect(clockOf("prior_notice", input([arrival], { ...US_SEA, transportMode: "air" }), NOW).state).toBe("running");
    expect(clockOf("prior_notice", input([arrival], { ...US_SEA, destinationCountry: "DE" }), NOW).state).toBe("not_applicable");
  });
});

describe("clock states", () => {
  it("drops a clock whose step is marked not applicable with a reason, but not without one", () => {
    const events = [completed("STEP-048", "2026-10-01")];
    const marked = (reason: string | null) => ({
      ...input(events),
      steps: { "STEP-120": { status: "not_applicable" as const, reason } },
    });
    expect(clockOf("fx_repatriation", marked("Bank waived the permit"), NOW).state).toBe("not_applicable");
    expect(clockOf("fx_repatriation", marked(null), NOW).state).toBe("running");
  });

  it("leaves out a clock whose step is not in the definitions", () => {
    const without = STEPS.filter((s) => s.id !== "STEP-097");
    const ids = evaluateDeadlines(without, input([]), { now: NOW }).map((c) => c.id);
    expect(ids).not.toContain("isf_filing");
    expect(ids).toContain("permit_validity");
  });

  it("gives no reminders for clocks that are waiting, not applicable or undetermined", () => {
    expect(remindersAt(input([], { destinationCountry: "TR" }), "2030-01-01T00:00:00Z")).toEqual([]);
  });

  it("rejects dates it cannot read", () => {
    expect(() => evaluateDeadlines(STEPS, input([completed("STEP-048", "2026-02-30")]), { now: NOW })).toThrow(RangeError);
    expect(() => evaluateDeadlines(STEPS, input([completed("STEP-048", "2026-10-01T10:00:00")]), { now: NOW })).toThrow(RangeError);
    expect(() => evaluateDeadlines(STEPS, input([]), { now: "yesterday" })).toThrow(RangeError);
  });

  it("ignores events it does not use, and inputs of another key", () => {
    const noise: CaseEvent[] = [
      { type: "note_added", occurredAt: "2026-10-01" },
      { type: CLOCK_INPUT_SET, occurredAt: "2026-10-01", data: "not an object" },
      { type: CLOCK_INPUT_SET, occurredAt: "2026-10-01", data: { key: "lcExpiry", value: 5 } },
      completed("STEP-048", "2026-10-01"),
    ];
    expect(clockOf("permit_validity", input(noise), NOW).due).toEqual({ day: "2026-10-31" });
  });
});

describe("CAD cap (FXD/01/2024 Annex One 1.3.2(c))", () => {
  it("allows up to and including USD 500,000", () => {
    expect(CAD_CAP_USD).toBe(500_000);
    expect(checkCadCap(0)).toMatchObject({ withinCap: true, excessUsd: 0 });
    expect(checkCadCap(499_999.99)).toMatchObject({ withinCap: true, excessUsd: 0 });
    expect(checkCadCap(500_000)).toMatchObject({ withinCap: true, excessUsd: 0 });
  });

  it("flags anything over the cap, and says by how much", () => {
    const check = checkCadCap(500_000.01);
    expect(check).toMatchObject({ withinCap: false, capUsd: 500_000, excessUsd: 0.01 });
    expect(checkCadCap(620_000)).toMatchObject({ withinCap: false, excessUsd: 120_000 });
    expect(checkCadCap(620_000).message).toBe(
      "USD 620,000 by CAD is USD 120,000 over the USD 500,000 cap for one permit. NBE must approve it case by case.",
    );
  });

  it("cites the clause", () => {
    expect(checkCadCap(1)).toMatchObject({ clause: "Annex One 1.3.2(c), (e)", source: { title: expect.stringContaining("FXD/01/2024") } });
  });

  it("rejects an amount that is not a sum of money", () => {
    for (const bad of [-1, Number.NaN, Number.POSITIVE_INFINITY]) expect(() => checkCadCap(bad)).toThrow(RangeError);
  });
});

describe("clock rules against the canonical steps", () => {
  const byId = new Map(STEPS.map((s) => [s.id, s]));

  it("cites a source and a clause for every rule", () => {
    for (const rule of DEADLINE_CLOCKS) {
      expect(rule.source.title, rule.id).toBeTruthy();
      expect(rule.clause, rule.id).toBeTruthy();
    }
  });

  it("matches the deadline written on each step: anchor, offset and source", () => {
    for (const rule of DEADLINE_CLOCKS) {
      const deadline = byId.get(rule.stepId)?.deadline;
      expect(deadline, `${rule.stepId} has no deadline`).toBeDefined();
      expect(rule.starts, rule.id).toEqual(deadline?.starts);
      expect(rule.due, rule.id).toEqual(deadline?.due);
      expect(rule.source, rule.id).toBe(deadline?.source);
    }
  });

  it("has a rule for every step that carries a deadline", () => {
    const withDeadline = STEPS.filter((s) => s.deadline).map((s) => s.id);
    expect(DEADLINE_CLOCKS.map((r) => r.stepId).sort()).toEqual(withDeadline.sort());
  });

  it("closes on, and starts from, steps and inputs that exist", () => {
    for (const rule of DEADLINE_CLOCKS) {
      expect(byId.has(rule.closedBy), `${rule.id} closes on ${rule.closedBy}`).toBe(true);
      if ("afterStep" in rule.starts) expect(byId.has(rule.starts.afterStep), rule.id).toBe(true);
      else expect(CLOCK_INPUT_KEYS, rule.id).toContain(rule.starts.caseDate);
    }
  });
});
