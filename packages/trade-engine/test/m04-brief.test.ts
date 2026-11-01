import { describe, expect, it } from "vitest";
import { OPEN_ACCOUNT, briefDateChecks, cashSchedule, criticalFailureCandidates, fundingGap, workingCapitalGap } from "../src";
import type { Outlay } from "../src";

// M04's sesame example: 760k paid out in four stages against 200k of cash.
const sesame: Outlay[] = [
  { stage: "sourcing", date: "2026-11-05", amount: 300_000 },
  { stage: "production", date: "2026-11-20", amount: 250_000 },
  { stage: "logistics", date: "2026-12-10", amount: 150_000 },
  { stage: "customs", date: "2026-12-20", amount: 60_000 },
];

describe("cashSchedule", () => {
  it("reproduces the sesame example: a 760k peak on the day of the last outlay", () => {
    const schedule = cashSchedule(sesame);
    expect(schedule.rows.map((r) => r.cumulative)).toEqual([300_000, 550_000, 700_000, 760_000]);
    expect(schedule.totalOutlay).toBe(760_000);
    expect(schedule.peak).toEqual({ date: "2026-12-20", cumulative: 760_000 });
    expect(schedule.byStage).toEqual({ sourcing: 300_000, production: 250_000, logistics: 150_000, customs: 60_000 });
  });

  it("puts the outlays in date order and says where each one was entered", () => {
    const { rows } = cashSchedule([...sesame].reverse());
    expect(rows.map((r) => [r.index, r.date, r.cumulative])).toEqual([
      [3, "2026-11-05", 300_000],
      [2, "2026-11-20", 550_000],
      [1, "2026-12-10", 700_000],
      [0, "2026-12-20", 760_000],
    ]);
  });

  it("keeps outlays on the same day in the order entered, and judges the peak at the end of the day", () => {
    const schedule = cashSchedule([
      { stage: "production", date: "2026-11-20", amount: 100 },
      { stage: "sourcing", date: "2026-11-20", amount: 200 },
    ]);
    expect(schedule.rows.map((r) => [r.stage, r.cumulative])).toEqual([["production", 100], ["sourcing", 300]]);
    expect(schedule.peak).toEqual({ date: "2026-11-20", cumulative: 300 });
  });

  it("puts the peak on the first day it is reached, so a later outlay of zero doesn't move it", () => {
    const schedule = cashSchedule([...sesame, { stage: "customs", date: "2026-12-30", amount: 0 }]);
    expect(schedule.peak).toEqual({ date: "2026-12-20", cumulative: 760_000 });
  });

  it("totals a stage with no outlay as zero once something is entered", () => {
    expect(cashSchedule(sesame.slice(0, 3)).byStage).toEqual({ sourcing: 300_000, production: 250_000, logistics: 150_000, customs: 0 });
  });

  it("leaves everything blank until an outlay is entered", () => {
    expect(cashSchedule([])).toEqual({ rows: [], totalOutlay: null, byStage: { sourcing: null, production: null, logistics: null, customs: null }, peak: null });
  });

  it("blanks the running total from a blank amount on, and the total and peak with it, never taking it as zero", () => {
    const schedule = cashSchedule([sesame[0]!, { ...sesame[1]!, amount: null }, sesame[2]!, sesame[3]!]);
    expect(schedule.rows.map((r) => r.cumulative)).toEqual([300_000, null, null, null]);
    expect(schedule.totalOutlay).toBeNull();
    expect(schedule.peak).toBeNull();
    expect(schedule.byStage).toEqual({ sourcing: 300_000, production: null, logistics: 150_000, customs: 60_000 });
  });

  it("puts an outlay with no date last and leaves the peak blank, though the total is known", () => {
    const schedule = cashSchedule([{ ...sesame[0]!, date: null }, sesame[1]!, { ...sesame[2]!, date: "" }]);
    expect(schedule.rows.map((r) => [r.index, r.date, r.cumulative])).toEqual([
      [1, "2026-11-20", 250_000],
      [0, null, null],
      [2, null, null],
    ]);
    expect(schedule.totalOutlay).toBe(700_000);
    expect(schedule.peak).toBeNull();
  });

  it("doesn't let floating point show", () => {
    expect(cashSchedule([{ stage: "sourcing", date: "2026-11-05", amount: 0.1 }, { stage: "production", date: "2026-11-06", amount: 0.2 }]).peak).toEqual({ date: "2026-11-06", cumulative: 0.3 });
  });

  it("refuses an amount that is negative or isn't a number, a stage that isn't one, and a date that isn't real", () => {
    expect(() => cashSchedule([{ ...sesame[0]!, amount: -1 }])).toThrow("outlay 1 amount can't be negative");
    expect(() => cashSchedule([sesame[0]!, { ...sesame[1]!, amount: Number.NaN }])).toThrow("outlay 2 amount must be a finite number");
    expect(() => cashSchedule([{ ...sesame[0]!, stage: "packing" as never }])).toThrow("stage must be one of sourcing, production, logistics, customs");
    expect(() => cashSchedule([{ ...sesame[0]!, date: "2026-02-30" }])).toThrow("outlay 1 date must be a real date");
  });
});

describe("fundingGap", () => {
  it("reproduces the garment case: 760k cost, 200k advance and 150k internal cash leave a 410k gap", () => {
    expect(fundingGap({ totalOutlay: 760_000, internalCash: 150_000, buyerAdvances: [200_000] })).toEqual({
      totalOutlay: 760_000,
      internalCash: 150_000,
      buyerAdvances: 200_000,
      availableFunds: 350_000,
      gap: 410_000,
      fundingNeeded: 410_000,
    });
  });

  it("reproduces the sesame case from the schedule: 760k against 200k of cash is a 560k gap", () => {
    expect(fundingGap({ totalOutlay: cashSchedule(sesame).totalOutlay, internalCash: 200_000, buyerAdvances: [] })).toMatchObject({ buyerAdvances: 0, gap: 560_000, fundingNeeded: 560_000 });
  });

  it("agrees with the M03 working-capital brief that prefills it", () => {
    const wc = workingCapitalGap({ preShipmentOutflows: 600_000, postShipmentOutflows: 160_000, internalCash: 150_000, buyerAdvance: 200_000 });
    expect(fundingGap({ totalOutlay: wc.totalOutflows, internalCash: 150_000, buyerAdvances: [200_000] }).gap).toBe(wc.gap);
  });

  it("adds up more than one advance", () => {
    expect(fundingGap({ totalOutlay: 760_000, internalCash: 150_000, buyerAdvances: [100_000, 100_000] })).toMatchObject({ buyerAdvances: 200_000, gap: 410_000 });
  });

  it("needs no funding when the business covers the deal itself", () => {
    expect(fundingGap({ totalOutlay: 500_000, internalCash: 700_000, buyerAdvances: [] })).toMatchObject({ gap: -200_000, fundingNeeded: 0 });
  });

  it("leaves the gap blank while a figure is missing, but counts no advances as zero", () => {
    expect(fundingGap({ totalOutlay: null, internalCash: 150_000, buyerAdvances: [] })).toMatchObject({ gap: null, fundingNeeded: null });
    expect(fundingGap({ totalOutlay: 760_000, internalCash: undefined, buyerAdvances: [] })).toMatchObject({ availableFunds: null, gap: null });
    expect(fundingGap({ totalOutlay: 760_000, internalCash: 150_000, buyerAdvances: [200_000, null] })).toMatchObject({ buyerAdvances: null, gap: null });
    expect(fundingGap({ totalOutlay: 760_000, internalCash: 150_000, buyerAdvances: [] })).toMatchObject({ buyerAdvances: 0, gap: 610_000 });
  });

  it("refuses a figure that isn't a number", () => {
    expect(() => fundingGap({ totalOutlay: Number.POSITIVE_INFINITY, internalCash: 0, buyerAdvances: [] })).toThrow("total outlay must be a finite number");
    expect(() => fundingGap({ totalOutlay: 1, internalCash: 0, buyerAdvances: [Number.NaN] })).toThrow("buyer advance 1 must be a finite number");
  });
});

describe("briefDateChecks", () => {
  it("flags delivery before production starts", () => {
    expect(briefDateChecks({ productionStart: "2026-11-20", deliveryDate: "2026-11-19" }).issues).toEqual([
      { code: "delivery_before_production", fields: ["productionStart", "deliveryDate"] },
    ]);
  });

  it("flags repayment after the buyer's payment window", () => {
    expect(briefDateChecks({ repaymentDate: "2027-02-01", paymentWindowEnd: "2027-01-31" }).issues).toEqual([
      { code: "repayment_after_payment_window", fields: ["repaymentDate", "paymentWindowEnd"] },
    ]);
  });

  it("passes the same day on both checks", () => {
    expect(briefDateChecks({ productionStart: "2026-11-20", deliveryDate: "2026-11-20", repaymentDate: "2027-01-31", paymentWindowEnd: "2027-01-31" }).issues).toEqual([]);
  });

  it("reports both when both are wrong", () => {
    const { issues } = briefDateChecks({ productionStart: "2026-11-20", deliveryDate: "2026-11-01", repaymentDate: "2027-03-01", paymentWindowEnd: "2027-01-31" });
    expect(issues.map((i) => i.code)).toEqual(["delivery_before_production", "repayment_after_payment_window"]);
  });

  it("waits until both dates of a check are entered", () => {
    expect(briefDateChecks({}).issues).toEqual([]);
    expect(briefDateChecks({ deliveryDate: "2026-11-01", repaymentDate: "", paymentWindowEnd: null }).issues).toEqual([]);
  });

  it("refuses a date that isn't real", () => {
    expect(() => briefDateChecks({ deliveryDate: "01/11/2026" })).toThrow("delivery date must be a real date");
  });
});

describe("criticalFailureCandidates", () => {
  const complete = cashSchedule(sesame).byStage;

  it("raises open account with an unverified buyer as soon as that combination is chosen", () => {
    expect(criticalFailureCandidates({ paymentMethod: OPEN_ACCOUNT, buyerVerified: false }).candidates).toEqual(["open_account_unverified_buyer"]);
  });

  it("raises nothing for open account until the buyer question is answered, or once the buyer is verified", () => {
    expect(criticalFailureCandidates({ paymentMethod: OPEN_ACCOUNT }).candidates).toEqual([]);
    expect(criticalFailureCandidates({ paymentMethod: OPEN_ACCOUNT, buyerVerified: null }).candidates).toEqual([]);
    expect(criticalFailureCandidates({ paymentMethod: OPEN_ACCOUNT, buyerVerified: true }).candidates).toEqual([]);
  });

  it("raises nothing for an unverified buyer on another payment method", () => {
    expect(criticalFailureCandidates({ paymentMethod: "letter_of_credit", buyerVerified: false }).candidates).toEqual([]);
  });

  it("raises raw material or freight missing from the outlays", () => {
    expect(criticalFailureCandidates({ outlayByStage: { ...complete, sourcing: 0 } }).candidates).toEqual(["raw_material_missing"]);
    expect(criticalFailureCandidates({ outlayByStage: { ...complete, logistics: 0 } }).candidates).toEqual(["freight_missing"]);
    expect(criticalFailureCandidates({ outlayByStage: cashSchedule(sesame.slice(1, 2)).byStage }).candidates).toEqual(["raw_material_missing", "freight_missing"]);
  });

  it("raises nothing about outlays while the schedule is empty or a stage's amount is blank", () => {
    expect(criticalFailureCandidates({ outlayByStage: cashSchedule([]).byStage }).candidates).toEqual([]);
    expect(criticalFailureCandidates({ outlayByStage: { ...complete, sourcing: null } }).candidates).toEqual([]);
    expect(criticalFailureCandidates({ outlayByStage: complete }).candidates).toEqual([]);
    expect(criticalFailureCandidates({ outlayByStage: null }).candidates).toEqual([]);
  });

  it("raises repayment after the payment window, but not delivery before production", () => {
    expect(criticalFailureCandidates({ dates: { repaymentDate: "2027-02-01", paymentWindowEnd: "2027-01-31" } }).candidates).toEqual(["repayment_after_payment_window"]);
    expect(criticalFailureCandidates({ dates: { productionStart: "2026-11-20", deliveryDate: "2026-11-01" } }).candidates).toEqual([]);
  });

  it("counts a missing verified order only on Pathway B or when the SME says it has a live order", () => {
    expect(criticalFailureCandidates({ pathway: "B", orderDocumentVerified: false }).candidates).toEqual(["no_verified_order"]);
    expect(criticalFailureCandidates({ pathway: "A", liveOrder: true, orderDocumentVerified: false }).candidates).toEqual(["no_verified_order"]);
    expect(criticalFailureCandidates({ pathway: "A", liveOrder: false, orderDocumentVerified: false }).candidates).toEqual([]);
    expect(criticalFailureCandidates({ pathway: "A", orderDocumentVerified: false }).candidates).toEqual([]);
    expect(criticalFailureCandidates({ orderDocumentVerified: false }).candidates).toEqual([]);
  });

  it("raises nothing for a missing order until the learner answers, or once it is verified", () => {
    expect(criticalFailureCandidates({ pathway: "B" }).candidates).toEqual([]);
    expect(criticalFailureCandidates({ pathway: "B", orderDocumentVerified: null }).candidates).toEqual([]);
    expect(criticalFailureCandidates({ pathway: "B", orderDocumentVerified: true }).candidates).toEqual([]);
  });

  it("lists every candidate, in the order the brief reaches them", () => {
    expect(
      criticalFailureCandidates({
        paymentMethod: OPEN_ACCOUNT,
        buyerVerified: false,
        outlayByStage: { ...complete, logistics: 0 },
        dates: { repaymentDate: "2027-02-01", paymentWindowEnd: "2027-01-31" },
        pathway: "B",
        orderDocumentVerified: false,
      }).candidates,
    ).toEqual(["open_account_unverified_buyer", "freight_missing", "repayment_after_payment_window", "no_verified_order"]);
  });

  it("raises nothing for a clean brief", () => {
    expect(
      criticalFailureCandidates({
        paymentMethod: "letter_of_credit",
        buyerVerified: true,
        outlayByStage: complete,
        dates: { productionStart: "2026-11-20", deliveryDate: "2026-12-30", repaymentDate: "2027-01-20", paymentWindowEnd: "2027-01-31" },
        pathway: "B",
        orderDocumentVerified: true,
      }).candidates,
    ).toEqual([]);
  });
});
