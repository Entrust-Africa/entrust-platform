import { allCriteria, getMizanConfig, type EvidenceCode, type RatingScore } from "@entrust/mizan-rules";
import type { FinancialYear, ScoreInput } from "../src";

export const cfg = getMizanConfig("0.2.1-interim");
export const criteria = allCriteria(cfg).map((c) => c.criterion);
export const criterion = (id: string) => criteria.find((c) => c.id === id)!;
export const dimensionCriteria = (id: string) => cfg.dimensions.find((d) => d.id === id)!.criteria;

/** Every criterion given the same rating and evidence level. */
export function allRated(rating: RatingScore, evidence: EvidenceCode = "E3"): Record<string, ScoreInput["ratings"][string]> {
  return Object.fromEntries(criteria.map((c) => [c.id, { rating, evidence }]));
}

export const passGates = { G1: "pass", G2: "pass", G3: "pass" } as const;

/** Established business, gates passed, no overrides: change what the test is about. */
export const input = (ratings: ScoreInput["ratings"], extra: Partial<ScoreInput> = {}): ScoreInput => ({
  ratings,
  gates: passGates,
  overrides: {},
  monthsOperating: 36,
  ...extra,
});

/** A small business whose balance sheet balances (900 = 450 liabilities + 450 equity). */
export const year = (fiscalYear: string, change: Partial<FinancialYear> = {}): FinancialYear => ({
  fiscalYear,
  revenue: 1000,
  costOfSales: 600,
  operatingExpenses: 200,
  depreciation: 20,
  interestExpense: 30,
  taxExpense: 40,
  netProfit: null,
  cash: 100,
  receivables: 150,
  inventory: 120,
  otherCurrentAssets: 30,
  totalAssets: 900,
  payables: 100,
  otherCurrentLiabilities: 50,
  shortTermDebt: 100,
  longTermDebt: 200,
  otherLongTermLiabilities: 0,
  equity: 450,
  operatingCashFlow: null,
  capex: 50,
  principalRepayments: 70,
  cpiInflation: 0.2,
  ...change,
});

/** Every field blank. */
export const blankYear = (fiscalYear: string): FinancialYear =>
  Object.fromEntries(Object.keys(year(fiscalYear)).map((k) => [k, k === "fiscalYear" ? fiscalYear : null])) as unknown as FinancialYear;
