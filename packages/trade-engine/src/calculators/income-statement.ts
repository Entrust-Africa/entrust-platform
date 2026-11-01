import { figure, percentOf, round2 } from "./amounts";
import type { Amount } from "./amounts";

export interface IncomeStatementInput {
  revenue: Amount;
  costOfGoodsSold: Amount;
  operatingExpenses: Amount;
}

export interface IncomeStatement {
  revenue: number | null;
  costOfGoodsSold: number | null;
  grossProfit: number | null;
  /** Percent of revenue. Null with no revenue. */
  grossMargin: number | null;
  operatingExpenses: number | null;
  operatingProfit: number | null;
  /** Percent of revenue. Null with no revenue. */
  operatingMargin: number | null;
}

/**
 * M03's simplified income statement (acceptance test 1): gross profit is revenue less cost of goods sold,
 * and operating profit is gross profit less operating expenses. It stops at operating profit, because the
 * module's pack has no interest or tax line (#48 lists the objective that promises net profit).
 */
export function incomeStatement(input: IncomeStatementInput): IncomeStatement {
  const revenue = figure("revenue", input.revenue);
  const costOfGoodsSold = figure("cost of goods sold", input.costOfGoodsSold);
  const operatingExpenses = figure("operating expenses", input.operatingExpenses);
  const grossProfit = revenue === null || costOfGoodsSold === null ? null : round2(revenue - costOfGoodsSold);
  const operatingProfit = grossProfit === null || operatingExpenses === null ? null : round2(grossProfit - operatingExpenses);
  return {
    revenue,
    costOfGoodsSold,
    grossProfit,
    grossMargin: percentOf(grossProfit, revenue),
    operatingExpenses,
    operatingProfit,
    operatingMargin: percentOf(operatingProfit, revenue),
  };
}
