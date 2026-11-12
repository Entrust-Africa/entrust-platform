import type { RatioKey } from "@entrust/mizan-rules";
import { formatAmount, roundTo } from "./format";

/**
 * One fiscal year of financial statements, in the assessment's currency. A blank field is null: unknown, never 0.
 * Inside a total (current assets, debt), a blank line counts as none as long as some line of that total is filled in;
 * the `BLANK_LINES` check says which lines that happened to.
 */
export interface FinancialYear {
  /** As the statements name it, such as "2025" or "2016 EC". Years are put in order by the digits in this label. */
  fiscalYear: string;
  revenue: number | null;
  costOfSales: number | null;
  /** Excluding depreciation and interest. */
  operatingExpenses: number | null;
  depreciation: number | null;
  interestExpense: number | null;
  taxExpense: number | null;
  /** As reported. Computed from the lines above when blank. */
  netProfit: number | null;
  cash: number | null;
  receivables: number | null;
  inventory: number | null;
  otherCurrentAssets: number | null;
  totalAssets: number | null;
  payables: number | null;
  otherCurrentLiabilities: number | null;
  /** Including the current portion of long-term debt. */
  shortTermDebt: number | null;
  longTermDebt: number | null;
  otherLongTermLiabilities: number | null;
  equity: number | null;
  /** As reported. Derived from two balance sheets when blank and the year before is given. */
  operatingCashFlow: number | null;
  capex: number | null;
  /** Principal due on existing debt in the year. */
  principalRepayments: number | null;
  /** National CPI inflation for the year, as a share (0.2 is 20%). Needed for real revenue growth. */
  cpiInflation: number | null;
}

export type FinancialField = Exclude<keyof FinancialYear, "fiscalYear">;

export const FINANCIAL_FIELDS: readonly { key: FinancialField; label: string; group: "income" | "balance" | "cash_flow" }[] = [
  { key: "revenue", label: "Revenue", group: "income" },
  { key: "costOfSales", label: "Cost of sales", group: "income" },
  { key: "operatingExpenses", label: "Operating expenses (excluding depreciation and interest)", group: "income" },
  { key: "depreciation", label: "Depreciation and amortisation", group: "income" },
  { key: "interestExpense", label: "Interest expense", group: "income" },
  { key: "taxExpense", label: "Income tax expense", group: "income" },
  { key: "netProfit", label: "Net profit (as reported)", group: "income" },
  { key: "cash", label: "Cash and bank", group: "balance" },
  { key: "receivables", label: "Trade receivables", group: "balance" },
  { key: "inventory", label: "Inventory", group: "balance" },
  { key: "otherCurrentAssets", label: "Other current assets", group: "balance" },
  { key: "totalAssets", label: "Total assets", group: "balance" },
  { key: "payables", label: "Trade payables", group: "balance" },
  { key: "otherCurrentLiabilities", label: "Other current liabilities", group: "balance" },
  { key: "shortTermDebt", label: "Short-term debt (including the current portion of long-term debt)", group: "balance" },
  { key: "longTermDebt", label: "Long-term debt", group: "balance" },
  { key: "otherLongTermLiabilities", label: "Other long-term liabilities", group: "balance" },
  { key: "equity", label: "Total equity", group: "balance" },
  { key: "operatingCashFlow", label: "Operating cash flow (as reported)", group: "cash_flow" },
  { key: "capex", label: "Capital expenditure", group: "cash_flow" },
  { key: "principalRepayments", label: "Principal repayments due on existing debt", group: "cash_flow" },
  { key: "cpiInflation", label: "National CPI inflation (a share, such as 0.15)", group: "cash_flow" },
];

export type RatioFormat = "ratio" | "percent" | "days" | "amount" | "times";

export const RATIO_INFO: Readonly<Record<RatioKey, { label: string; format: RatioFormat }>> = {
  current_ratio: { label: "Current ratio", format: "ratio" },
  quick_ratio: { label: "Quick ratio", format: "ratio" },
  gross_margin: { label: "Gross profit margin", format: "percent" },
  net_margin: { label: "Net profit margin", format: "percent" },
  roa: { label: "Return on assets", format: "percent" },
  roe: { label: "Return on equity", format: "percent" },
  debt_to_equity: { label: "Debt-to-equity", format: "ratio" },
  interest_coverage: { label: "Interest coverage", format: "times" },
  operating_cash_flow: { label: "Operating cash flow", format: "amount" },
  working_capital: { label: "Working capital", format: "amount" },
  ar_days: { label: "Receivable days", format: "days" },
  inventory_days: { label: "Inventory days", format: "days" },
  ap_days: { label: "Payable days", format: "days" },
  cash_conversion_cycle: { label: "Cash conversion cycle", format: "days" },
  dscr: { label: "Debt service coverage (existing debt)", format: "times" },
  revenue_growth: { label: "Real revenue growth", format: "percent" },
  ebitda: { label: "EBITDA", format: "amount" },
  ebitda_margin: { label: "EBITDA margin", format: "percent" },
  top_customer_share: { label: "Largest customer's share of revenue", format: "percent" },
};

/** A ratio is null when it can't be computed: an input is blank, or the denominator is zero or meaningless (negative equity). */
export type RatioSet = Record<RatioKey, number | null>;

export interface QualityCheck {
  code: "BS_NOT_BALANCED" | "CA_GT_TA" | "NP_MISMATCH" | "NEG_EQUITY" | "OCF_DERIVED" | "NO_CPI" | "BLANK_LINES";
  severity: "info" | "warning" | "error";
  message: string;
}

export interface YearAnalysis {
  fiscalYear: string;
  ratios: RatioSet;
  derived: {
    currentAssets: number | null;
    currentLiabilities: number | null;
    totalLiabilities: number | null;
    totalDebt: number | null;
    ebit: number | null;
    netProfitComputed: number | null;
    netProfitUsed: number | null;
    operatingCashFlow: number | null;
    operatingCashFlowSource: "reported" | "derived" | "unavailable";
    nominalRevenueGrowth: number | null;
    debtService: number | null;
    equity: number | null;
  };
  checks: QualityCheck[];
}

const value = (v: number | null | undefined): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** Sum of the filled-in lines, or null when every line is blank. */
const total = (...lines: (number | null)[]): number | null => (lines.every((v) => v === null) ? null : lines.reduce<number>((a, v) => a + (v ?? 0), 0));

/** a / b, or null when either is unknown or b isn't above zero. Every ratio here has a denominator that must be positive. */
const per = (a: number | null, b: number | null): number | null => (a === null || b === null || !(b > 0) ? null : a / b);

/** The digits in a fiscal-year label, for ordering: "2016 EC" gives 2016, "FY2024/25" gives 202425. */
const yearOrder = (label: string) => Number(label.replace(/\D/g, "") || Number.NaN);

/** The year's working capital excluding cash and debt, for the derived operating cash flow. */
const operatingWorkingCapital = (y: FinancialYear) =>
  (value(y.receivables) ?? 0) + (value(y.inventory) ?? 0) + (value(y.otherCurrentAssets) ?? 0) - (value(y.payables) ?? 0) - (value(y.otherCurrentLiabilities) ?? 0);

const BLANK_AS_NONE: readonly FinancialField[] = ["costOfSales", "operatingExpenses", "depreciation", "interestExpense", "taxExpense"];

/**
 * Ratios, derived figures and quality checks for each year, oldest first. A year uses the one before it for derived operating
 * cash flow and revenue growth. `topCustomerShare` (0 to 1) applies to the latest year only.
 */
export function analyseYears(years: readonly FinancialYear[], extras: { topCustomerShare?: number | null } = {}): YearAnalysis[] {
  const labels = years.map((y) => y.fiscalYear);
  if (new Set(labels).size !== labels.length) throw new Error(`The same fiscal year is given twice: ${labels.join(", ")}`);
  if (labels.some((l) => Number.isNaN(yearOrder(l)))) throw new Error(`A fiscal year needs digits to put it in order: ${labels.join(", ")}`);
  const ordered = [...years].sort((a, b) => yearOrder(a.fiscalYear) - yearOrder(b.fiscalYear));

  return ordered.map((y, i) => {
    const prior = i > 0 ? ordered[i - 1]! : null;
    const latest = i === ordered.length - 1;
    const checks: QualityCheck[] = [];

    const revenue = value(y.revenue);
    const costOfSales = value(y.costOfSales);
    const interest = value(y.interestExpense);
    const tax = value(y.taxExpense);
    const equity = value(y.equity);
    const totalAssets = value(y.totalAssets);

    const currentAssets = total(value(y.cash), value(y.receivables), value(y.inventory), value(y.otherCurrentAssets));
    const currentLiabilities = total(value(y.payables), value(y.otherCurrentLiabilities), value(y.shortTermDebt));
    const totalDebt = total(value(y.shortTermDebt), value(y.longTermDebt));
    const totalLiabilities = total(currentLiabilities, value(y.longTermDebt), value(y.otherLongTermLiabilities));

    const ebitda = revenue === null ? null : revenue - (costOfSales ?? 0) - (value(y.operatingExpenses) ?? 0);
    const ebit = ebitda === null ? null : ebitda - (value(y.depreciation) ?? 0);
    const netProfitComputed = ebit === null ? null : ebit - (interest ?? 0) - (tax ?? 0);
    const netProfitUsed = value(y.netProfit) ?? netProfitComputed;

    let operatingCashFlow = value(y.operatingCashFlow);
    let operatingCashFlowSource: YearAnalysis["derived"]["operatingCashFlowSource"] = operatingCashFlow !== null ? "reported" : "unavailable";
    if (operatingCashFlow === null && prior && netProfitUsed !== null) {
      operatingCashFlow = netProfitUsed + (value(y.depreciation) ?? 0) - (operatingWorkingCapital(y) - operatingWorkingCapital(prior));
      operatingCashFlowSource = "derived";
    }

    const debtService = total(interest, value(y.principalRepayments));
    const priorRevenue = prior ? value(prior.revenue) : null;
    const nominalRevenueGrowth = revenue === null ? null : per(revenue - (priorRevenue ?? 0), priorRevenue);
    const cpi = value(y.cpiInflation);
    const revenueGrowth = nominalRevenueGrowth === null || cpi === null || !(1 + cpi > 0) ? null : (1 + nominalRevenueGrowth) / (1 + cpi) - 1;
    const positiveEquity = equity !== null && equity > 0 ? equity : null;

    const arDays = revenue !== null && value(y.receivables) !== null ? per(value(y.receivables)! * 365, revenue) : null;
    const inventoryDays = costOfSales !== null && value(y.inventory) !== null ? per(value(y.inventory)! * 365, costOfSales) : null;
    const apDays = costOfSales !== null && value(y.payables) !== null ? per(value(y.payables)! * 365, costOfSales) : null;

    const ratios: RatioSet = {
      current_ratio: per(currentAssets, currentLiabilities),
      quick_ratio: per(total(value(y.cash), value(y.receivables)), currentLiabilities),
      gross_margin: revenue !== null && costOfSales !== null ? per(revenue - costOfSales, revenue) : null,
      net_margin: per(netProfitUsed, revenue),
      roa: per(netProfitUsed, totalAssets),
      roe: per(netProfitUsed, positiveEquity),
      debt_to_equity: positiveEquity === null ? null : per(totalDebt ?? 0, positiveEquity),
      interest_coverage: per(ebit, interest),
      operating_cash_flow: operatingCashFlow,
      working_capital: currentAssets !== null && currentLiabilities !== null ? currentAssets - currentLiabilities : null,
      ar_days: arDays,
      inventory_days: inventoryDays,
      ap_days: apDays,
      cash_conversion_cycle: arDays === null && inventoryDays === null ? null : (arDays ?? 0) + (inventoryDays ?? 0) - (apDays ?? 0),
      dscr: per(ebitda === null ? null : ebitda - (tax ?? 0), debtService),
      revenue_growth: revenueGrowth,
      ebitda,
      ebitda_margin: per(ebitda, revenue),
      top_customer_share: latest ? value(extras.topCustomerShare) : null,
    };

    if (totalAssets !== null && totalLiabilities !== null && equity !== null) {
      const gap = totalAssets - (totalLiabilities + equity);
      if (Math.abs(gap) > Math.max(1, Math.abs(totalAssets) * 0.01)) {
        checks.push({
          code: "BS_NOT_BALANCED",
          severity: "error",
          message: `The balance sheet doesn't balance: total assets differ from liabilities plus equity by ${formatAmount(gap)}.`,
        });
      }
    }
    if (currentAssets !== null && totalAssets !== null && currentAssets > totalAssets) {
      checks.push({ code: "CA_GT_TA", severity: "error", message: "Current assets are larger than total assets." });
    }
    if (value(y.netProfit) !== null && netProfitComputed !== null && revenue !== null && revenue !== 0) {
      const diff = Math.abs(value(y.netProfit)! - netProfitComputed);
      if (diff > Math.abs(revenue) * 0.02) {
        checks.push({
          code: "NP_MISMATCH",
          severity: "warning",
          message: `Reported net profit differs from the profit worked out from the lines above by ${formatAmount(diff)}, over 2% of revenue. Look for missing items such as other income.`,
        });
      }
    }
    if (equity !== null && equity <= 0) checks.push({ code: "NEG_EQUITY", severity: "warning", message: "Equity is zero or negative." });
    if (operatingCashFlowSource === "derived") {
      checks.push({
        code: "OCF_DERIVED",
        severity: "info",
        message: "Operating cash flow is worked out from the balance sheet movements, which is less reliable than a cash flow statement.",
      });
    }
    if (nominalRevenueGrowth !== null && cpi === null) {
      checks.push({ code: "NO_CPI", severity: "warning", message: "CPI inflation is missing, so real revenue growth can't be worked out." });
    }
    const blank = revenue === null ? [] : BLANK_AS_NONE.filter((k) => value(y[k]) === null);
    if (blank.length) {
      const names = blank.map((k) => FINANCIAL_FIELDS.find((f) => f.key === k)!.label.toLowerCase());
      checks.push({ code: "BLANK_LINES", severity: "info", message: `Counted as none because they were left blank: ${names.join("; ")}.` });
    }

    return {
      fiscalYear: y.fiscalYear,
      ratios,
      derived: {
        currentAssets,
        currentLiabilities,
        totalLiabilities,
        totalDebt,
        ebit,
        netProfitComputed,
        netProfitUsed,
        operatingCashFlow,
        operatingCashFlowSource,
        nominalRevenueGrowth,
        debtService,
        equity,
      },
      checks,
    };
  });
}

/** A ratio as the screens and report show it. */
export function formatRatio(key: RatioKey, v: number | null | undefined): string {
  if (v === null || v === undefined) return "n/a";
  switch (RATIO_INFO[key].format) {
    case "percent":
      return `${roundTo(v * 100, 1).toFixed(1)}%`;
    case "days":
      return `${roundTo(v, 0)} days`;
    case "times":
      return `${roundTo(v, 2).toFixed(2)}x`;
    case "amount":
      return formatAmount(v);
    default:
      return roundTo(v, 2).toFixed(2);
  }
}
