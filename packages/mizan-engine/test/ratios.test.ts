import { RATIO_KEYS, canonicalJson } from "@entrust/mizan-rules";
import { describe, expect, it } from "vitest";
import { analyseYears, formatAmount, formatRatio, roundTo } from "../src";
import { blankYear, year } from "./helpers";

describe("ratios, worked out by hand", () => {
  // 2025: revenue 1,320; cost of sales 600; operating expenses 200; depreciation 20; interest 30; tax 40; net profit left blank.
  //   EBITDA = 1,320 - 600 - 200 = 520. EBIT = 520 - 20 = 500. Net profit = 500 - 30 - 40 = 430.
  //   Current assets = 100 + 150 + 120 + 30 = 400. Current liabilities = 100 + 50 + 100 = 250. Debt = 100 + 200 = 300.
  //   Liabilities = 250 + 200 + 0 = 450, + equity 450 = 900 = total assets: balanced.
  //   Working capital excluding cash and debt = 150 + 120 + 30 - 100 - 50 = 150 in both years, so derived OCF = 430 + 20 - 0 = 450.
  //   Debt service = 30 + 70 = 100. DSCR = (520 - 40) / 100 = 4.8. Real growth = 1.32 / 1.2 - 1 = 0.1.
  const [y1, y2] = analyseYears([year("2024"), year("2025", { revenue: 1320 })], { topCustomerShare: 0.3 });
  const r = y2!.ratios;

  it("gives the liquidity, leverage and coverage ratios", () => {
    expect(r.current_ratio).toBe(1.6);
    expect(r.quick_ratio).toBe(1);
    expect(r.debt_to_equity).toBeCloseTo(300 / 450, 12);
    expect(r.interest_coverage).toBeCloseTo(500 / 30, 12);
    expect(r.dscr).toBe(4.8);
    expect(r.working_capital).toBe(150);
  });

  it("gives margins, returns and growth", () => {
    expect(r.ebitda).toBe(520);
    expect(r.gross_margin).toBeCloseTo(720 / 1320, 12);
    expect(r.net_margin).toBeCloseTo(430 / 1320, 12);
    expect(r.ebitda_margin).toBeCloseTo(520 / 1320, 12);
    expect(r.roa).toBeCloseTo(430 / 900, 12);
    expect(r.roe).toBeCloseTo(430 / 450, 12);
    expect(r.revenue_growth).toBeCloseTo(0.1, 12);
    expect(y2!.derived.nominalRevenueGrowth).toBeCloseTo(0.32, 12);
  });

  it("gives the working capital days", () => {
    expect(r.ar_days).toBeCloseTo((150 / 1320) * 365, 9);
    expect(r.inventory_days).toBeCloseTo(73, 9);
    expect(r.ap_days).toBeCloseTo((100 / 600) * 365, 9);
    expect(r.cash_conversion_cycle).toBeCloseTo((150 / 1320) * 365 + 73 - (100 / 600) * 365, 9);
  });

  it("derives operating cash flow from two balance sheets, and only then", () => {
    expect(y2!.derived.operatingCashFlow).toBe(450);
    expect(y2!.derived.operatingCashFlowSource).toBe("derived");
    expect(y2!.checks.map((c) => c.code)).toContain("OCF_DERIVED");
    expect(y1!.derived.operatingCashFlowSource).toBe("unavailable");
    expect(y1!.ratios.operating_cash_flow).toBeNull();
    const [, reported] = analyseYears([year("2024"), year("2025", { operatingCashFlow: 99 })]);
    expect(reported!.derived).toMatchObject({ operatingCashFlow: 99, operatingCashFlowSource: "reported" });
  });

  it("gives the largest customer's share for the latest year only", () => {
    expect(r.top_customer_share).toBe(0.3);
    expect(y1!.ratios.top_customer_share).toBeNull();
  });

  it("finds nothing wrong with a balanced year", () => {
    expect(y2!.checks.map((c) => c.code)).toEqual(["OCF_DERIVED"]);
  });
});

describe("blanks and zeros", () => {
  it("never turn a missing value into 0", () => {
    const [y] = analyseYears([blankYear("2025")]);
    for (const key of RATIO_KEYS) expect(y!.ratios[key], key).toBeNull();
    expect(y!.checks).toEqual([]);
  });

  it("give null, never Infinity or NaN, when a denominator is zero", () => {
    const zero = year("2025", { revenue: 0, costOfSales: 0, interestExpense: 0, principalRepayments: 0, payables: 0, otherCurrentLiabilities: 0, shortTermDebt: 0, totalAssets: 0 });
    const [y] = analyseYears([zero]);
    for (const key of ["current_ratio", "quick_ratio", "gross_margin", "net_margin", "roa", "interest_coverage", "ar_days", "inventory_days", "ap_days", "dscr", "ebitda_margin"] as const) {
      expect(y!.ratios[key], key).toBeNull();
    }
    expect(() => canonicalJson(y)).not.toThrow();
  });

  it("leave return on equity and debt-to-equity out when equity is zero or negative, and say so", () => {
    const [y] = analyseYears([year("2025", { equity: -50, longTermDebt: 700 })]);
    expect(y!.ratios.roe).toBeNull();
    expect(y!.ratios.debt_to_equity).toBeNull();
    expect(y!.checks.map((c) => c.code)).toContain("NEG_EQUITY");
  });

  it("say which income statement lines were counted as none", () => {
    const [y] = analyseYears([year("2025", { depreciation: null, taxExpense: null })]);
    expect(y!.checks.find((c) => c.code === "BLANK_LINES")?.message).toBe(
      "Counted as none because they were left blank: depreciation and amortisation; income tax expense.",
    );
  });

  it("need CPI for real growth", () => {
    const [, y] = analyseYears([year("2024"), year("2025", { cpiInflation: null })]);
    expect(y!.ratios.revenue_growth).toBeNull();
    expect(y!.checks.map((c) => c.code)).toContain("NO_CPI");
  });
});

describe("quality checks", () => {
  it("flag a balance sheet that doesn't balance, with the gap in a fixed format", () => {
    const [y] = analyseYears([year("2025", { totalAssets: 1_200_000 })]);
    expect(y!.checks.find((c) => c.code === "BS_NOT_BALANCED")?.message).toBe(
      "The balance sheet doesn't balance: total assets differ from liabilities plus equity by 1,199,100.",
    );
  });

  it("flag reported profit that doesn't match the lines", () => {
    const [y] = analyseYears([year("2025", { netProfit: 50 })]); // the lines give 110: a gap of 60, over 2% of revenue (20)
    expect(y!.checks.map((c) => c.code)).toContain("NP_MISMATCH");
    expect(y!.ratios.net_margin).toBe(0.05); // the reported figure is used
  });

  it("flag current assets above total assets", () => {
    const [y] = analyseYears([year("2025", { totalAssets: 300, equity: -150 })]);
    expect(y!.checks.map((c) => c.code)).toContain("CA_GT_TA");
  });
});

describe("years", () => {
  it("are put in order by the digits in their label", () => {
    const out = analyseYears([year("2016 EC", { revenue: 1200 }), year("2015 EC")]);
    expect(out.map((y) => y.fiscalYear)).toEqual(["2015 EC", "2016 EC"]);
    expect(out[1]!.derived.nominalRevenueGrowth).toBeCloseTo(0.2, 12);
  });

  it("refuse the same year twice or a label with no digits", () => {
    expect(() => analyseYears([year("2025"), year("2025")])).toThrow("The same fiscal year is given twice");
    expect(() => analyseYears([year("last year")])).toThrow("needs digits");
  });
});

describe("formatting", () => {
  it("rounds half away from zero without binary noise", () => {
    expect(roundTo(64.95, 1)).toBe(65);
    expect(roundTo(1.005, 2)).toBe(1.01);
    expect(roundTo(-2.5, 0)).toBe(-3);
    expect(roundTo(64.94, 1)).toBe(64.9);
  });

  it("formats amounts and ratios the same way everywhere", () => {
    expect(formatAmount(1234567.8)).toBe("1,234,568");
    expect(formatAmount(-1000)).toBe("-1,000");
    expect(formatRatio("net_margin", 0.12345)).toBe("12.3%");
    expect(formatRatio("dscr", 1.255)).toBe("1.26x");
    expect(formatRatio("ar_days", 41.48)).toBe("41 days");
    expect(formatRatio("current_ratio", 1.6)).toBe("1.60");
    expect(formatRatio("ebitda", null)).toBe("n/a");
  });
});
