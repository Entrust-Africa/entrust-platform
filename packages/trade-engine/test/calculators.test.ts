import { describe, expect, it } from "vitest";
import { CALCULATORS, CALCULATOR_NAMES, MAX_FORECAST_MONTHS, cashFlowForecast, checklistCompletion, etbEquivalent, incomeStatement, workingCapitalGap } from "../src";

describe("incomeStatement", () => {
  it("reproduces the spice firm: 2.4M revenue, 35% gross margin and 10% operating margin", () => {
    // 35% gross margin leaves 840,000 after 1,560,000 of cost of goods sold, and 600,000 of expenses leaves 240,000.
    expect(incomeStatement({ revenue: 2_400_000, costOfGoodsSold: 1_560_000, operatingExpenses: 600_000 })).toEqual({
      revenue: 2_400_000,
      costOfGoodsSold: 1_560_000,
      grossProfit: 840_000,
      grossMargin: 35,
      operatingExpenses: 600_000,
      operatingProfit: 240_000,
      operatingMargin: 10,
    });
  });

  it("rounds a margin to two decimals", () => {
    expect(incomeStatement({ revenue: 300, costOfGoodsSold: 200, operatingExpenses: 50 })).toMatchObject({ grossMargin: 33.33, operatingMargin: 16.67 });
  });

  it("shows a loss as negative", () => {
    expect(incomeStatement({ revenue: 1000, costOfGoodsSold: 1200, operatingExpenses: 100 })).toMatchObject({
      grossProfit: -200,
      grossMargin: -20,
      operatingProfit: -300,
      operatingMargin: -30,
    });
  });

  it("doesn't let floating point show", () => {
    expect(incomeStatement({ revenue: 0.3, costOfGoodsSold: 0.1, operatingExpenses: 0 })).toMatchObject({ grossProfit: 0.2, operatingProfit: 0.2 });
  });

  it("leaves what it can't work out blank, never zero", () => {
    expect(incomeStatement({ revenue: null, costOfGoodsSold: 100, operatingExpenses: 10 })).toMatchObject({ grossProfit: null, grossMargin: null, operatingProfit: null, operatingMargin: null });
    expect(incomeStatement({ revenue: 1000, costOfGoodsSold: 600, operatingExpenses: undefined })).toMatchObject({ grossProfit: 400, grossMargin: 40, operatingProfit: null, operatingMargin: null });
    expect(incomeStatement({ revenue: 0, costOfGoodsSold: 0, operatingExpenses: 0 })).toMatchObject({ grossProfit: 0, grossMargin: null, operatingProfit: 0, operatingMargin: null });
  });

  it("refuses a figure that isn't a number", () => {
    expect(() => incomeStatement({ revenue: Number.NaN, costOfGoodsSold: 0, operatingExpenses: 0 })).toThrow("revenue must be a finite number");
    expect(() => incomeStatement({ revenue: "100" as never, costOfGoodsSold: 0, operatingExpenses: 0 })).toThrow(RangeError);
  });
});

describe("cashFlowForecast", () => {
  it("reproduces the worked example: 120k + 400k - 510k = 10k", () => {
    const { rows } = cashFlowForecast({ openingBalance: 120_000, months: [{ inflows: 400_000, outflows: 510_000 }] });
    expect(rows).toEqual([{ month: 1, opening: 120_000, inflows: 400_000, outflows: 510_000, net: -110_000, closing: 10_000 }]);
  });

  it("carries each month's closing balance into the next month's opening", () => {
    const { rows } = cashFlowForecast({
      openingBalance: 120_000,
      months: [
        { inflows: 400_000, outflows: 510_000 },
        { inflows: 300_000, outflows: 200_000 },
        { inflows: 50_000, outflows: 40_000 },
      ],
    });
    expect(rows.map((r) => [r.opening, r.closing])).toEqual([
      [120_000, 10_000],
      [10_000, 110_000],
      [110_000, 120_000],
    ]);
  });

  it("warns for every month that closes below zero", () => {
    const forecast = cashFlowForecast({
      openingBalance: 50_000,
      months: [
        { inflows: 100_000, outflows: 200_000 },
        { inflows: 10_000, outflows: 20_000 },
        { inflows: 500_000, outflows: 100_000 },
      ],
    });
    expect(forecast.warnings).toEqual([
      { month: 1, closing: -50_000 },
      { month: 2, closing: -60_000 },
    ]);
    expect(forecast.lowest).toEqual({ month: 2, closing: -60_000 });
  });

  it("has no warnings when every month stays above zero, and a zero balance isn't one", () => {
    expect(cashFlowForecast({ openingBalance: 100, months: [{ inflows: 0, outflows: 100 }] }).warnings).toEqual([]);
  });

  it("starts from a negative opening balance", () => {
    expect(cashFlowForecast({ openingBalance: -500, months: [{ inflows: 100, outflows: 0 }] }).warnings).toEqual([{ month: 1, closing: -400 }]);
  });

  it("leaves a month and every month after it blank when a figure is missing", () => {
    const { rows, warnings, lowest } = cashFlowForecast({
      openingBalance: 1000,
      months: [{ inflows: 500, outflows: 200 }, { inflows: null, outflows: 100 }, { inflows: 50, outflows: 10 }],
    });
    expect(rows.map((r) => r.closing)).toEqual([1300, null, null]);
    expect(rows[2]).toMatchObject({ opening: null, net: 40, closing: null });
    expect(warnings).toEqual([]);
    expect(lowest).toBeNull();
  });

  it("leaves everything blank without an opening balance", () => {
    expect(cashFlowForecast({ openingBalance: undefined, months: [{ inflows: 5, outflows: 1 }] }).rows[0]).toMatchObject({ opening: null, net: 4, closing: null });
  });

  it("takes a forecast of three months, twelve, or up to the limit", () => {
    const months = (n: number) => Array.from({ length: n }, () => ({ inflows: 10, outflows: 5 }));
    expect(cashFlowForecast({ openingBalance: 0, months: months(3) }).rows.at(-1)?.closing).toBe(15);
    expect(cashFlowForecast({ openingBalance: 0, months: months(12) }).rows.at(-1)?.closing).toBe(60);
    expect(() => cashFlowForecast({ openingBalance: 0, months: months(MAX_FORECAST_MONTHS + 1) })).toThrow("at most 36 months");
    expect(() => cashFlowForecast({ openingBalance: 0, months: [] })).toThrow("at least one month");
  });

  it("rounds each balance, so the next opening is what the SME sees", () => {
    const { rows } = cashFlowForecast({ openingBalance: 0.1, months: [{ inflows: 0.2, outflows: 0 }, { inflows: 0, outflows: 0 }] });
    expect(rows.map((r) => r.closing)).toEqual([0.3, 0.3]);
  });
});

describe("workingCapitalGap", () => {
  const garment = { preShipmentOutflows: 600_000, postShipmentOutflows: 160_000, internalCash: 150_000, buyerAdvance: 200_000 };

  it("reproduces the garment case: 760k cost, 200k advance, 150k internal cash, 410k gap", () => {
    expect(workingCapitalGap(garment)).toEqual({
      preShipmentOutflows: 600_000,
      postShipmentOutflows: 160_000,
      totalOutflows: 760_000,
      availableFunds: 350_000,
      gap: 410_000,
      fundingNeeded: 410_000,
      daysUntilPayment: null,
    });
  });

  it("reproduces the sesame case: a 760k peak against 200k of cash is a 560k gap", () => {
    expect(workingCapitalGap({ preShipmentOutflows: 760_000, postShipmentOutflows: 0, internalCash: 200_000, buyerAdvance: 0 })).toMatchObject({ gap: 560_000, fundingNeeded: 560_000 });
  });

  it("needs no funding when the business covers the order itself", () => {
    expect(workingCapitalGap({ ...garment, internalCash: 700_000 })).toMatchObject({ gap: -140_000, fundingNeeded: 0 });
  });

  it("counts the days from the first outflow until payment arrives", () => {
    expect(workingCapitalGap({ ...garment, startDate: "2026-11-01", paymentDate: "2027-01-30" }).daysUntilPayment).toBe(90);
    expect(workingCapitalGap({ ...garment, startDate: "2028-02-01", paymentDate: "2028-03-01" }).daysUntilPayment).toBe(29);
    expect(workingCapitalGap({ ...garment, startDate: "2026-11-01", paymentDate: "2026-11-01" }).daysUntilPayment).toBe(0);
  });

  it("leaves the days blank without both dates", () => {
    expect(workingCapitalGap({ ...garment, startDate: "2026-11-01" }).daysUntilPayment).toBeNull();
    expect(workingCapitalGap({ ...garment, startDate: "", paymentDate: null }).daysUntilPayment).toBeNull();
  });

  it("refuses a payment before the first outflow, or a date that isn't real", () => {
    expect(() => workingCapitalGap({ ...garment, startDate: "2026-11-02", paymentDate: "2026-11-01" })).toThrow("before the first outflow");
    expect(() => workingCapitalGap({ ...garment, startDate: "2026-02-30", paymentDate: "2026-03-01" })).toThrow("start date must be a real date");
  });

  it("leaves the gap blank while a figure is missing, never zero", () => {
    expect(workingCapitalGap({ ...garment, buyerAdvance: null })).toMatchObject({ totalOutflows: 760_000, availableFunds: null, gap: null, fundingNeeded: null });
    expect(workingCapitalGap({ ...garment, postShipmentOutflows: undefined })).toMatchObject({ totalOutflows: null, gap: null });
  });

  it("counts a buyer advance of zero as zero", () => {
    expect(workingCapitalGap({ ...garment, buyerAdvance: 0 })).toMatchObject({ availableFunds: 150_000, gap: 610_000 });
  });
});

describe("etbEquivalent", () => {
  const fx = { rate: 56.5, date: "2026-10-30" };

  it("is the amount itself for ETB, with no rate", () => {
    expect(etbEquivalent({ amount: 1200.5, currency: "ETB" })).toEqual({ amount: 1200.5, currency: "ETB", rate: null, date: null });
    expect(etbEquivalent({ amount: 1200.5, currency: "ETB" }, fx)).toMatchObject({ rate: null, date: null });
  });

  it("converts USD and EUR with the rate and date the SME entered", () => {
    expect(etbEquivalent({ amount: 100, currency: "USD" }, fx)).toEqual({ amount: 5650, currency: "USD", rate: 56.5, date: "2026-10-30" });
    expect(etbEquivalent({ amount: 33.33, currency: "EUR" }, { rate: 61.2, date: "2026-10-30" }).amount).toBe(2039.8);
  });

  it("stays blank until the rate is entered, rather than guessing one", () => {
    expect(etbEquivalent({ amount: 100, currency: "USD" })).toEqual({ amount: null, currency: "USD", rate: null, date: null });
    expect(etbEquivalent({ amount: 100, currency: "USD" }, null).amount).toBeNull();
  });

  it("stays blank while the amount is", () => {
    expect(etbEquivalent({ amount: null, currency: "USD" }, fx).amount).toBeNull();
    expect(etbEquivalent({ amount: undefined, currency: "ETB" }).amount).toBeNull();
  });

  it("refuses an unknown currency, a rate that isn't above zero, and a date that isn't real", () => {
    expect(() => etbEquivalent({ amount: 1, currency: "GBP" }, fx)).toThrow("currency must be ETB, USD, EUR");
    expect(() => etbEquivalent({ amount: 1, currency: "USD" }, { rate: 0, date: "2026-10-30" })).toThrow("above 0");
    expect(() => etbEquivalent({ amount: 1, currency: "USD" }, { rate: Number.NaN, date: "2026-10-30" })).toThrow("above 0");
    expect(() => etbEquivalent({ amount: 1, currency: "USD" }, { rate: 56, date: "30/10/2026" })).toThrow("real date");
  });
});

describe("checklistCompletion", () => {
  const items = (provided: number, total = 12) => Array.from({ length: total }, (_, i) => ({ id: `item_${i + 1}`, provided: i < provided }));

  it("counts a 12-item checklist and the share provided", () => {
    expect(checklistCompletion(items(9))).toMatchObject({ provided: 9, total: 12, percent: 75, missing: ["item_10", "item_11", "item_12"] });
    expect(checklistCompletion(items(0))).toMatchObject({ provided: 0, percent: 0 });
  });

  it("reaches 100 only when every item is provided", () => {
    expect(checklistCompletion(items(11)).percent).toBe(91);
    expect(checklistCompletion(items(12))).toMatchObject({ percent: 100, missing: [] });
  });

  it("refuses an empty checklist, or one that lists an item twice", () => {
    expect(() => checklistCompletion([])).toThrow("at least one item");
    expect(() => checklistCompletion([{ id: "a", provided: true }, { id: "a", provided: false }])).toThrow("listed twice");
  });
});

describe("the calculator registry", () => {
  it("names the calculators a worksheet can use", () => {
    expect(CALCULATOR_NAMES).toEqual(["income_statement", "cash_flow_forecast", "working_capital_gap", "etb_equivalent", "checklist_completion"]);
  });

  it("maps every name to the function", () => {
    expect(CALCULATORS.income_statement).toBe(incomeStatement);
    expect(CALCULATORS.cash_flow_forecast).toBe(cashFlowForecast);
    expect(CALCULATORS.working_capital_gap).toBe(workingCapitalGap);
    expect(CALCULATORS.etb_equivalent).toBe(etbEquivalent);
    expect(CALCULATORS.checklist_completion).toBe(checklistCompletion);
  });
});
