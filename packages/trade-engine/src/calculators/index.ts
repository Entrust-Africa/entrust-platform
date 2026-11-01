import { cashFlowForecast } from "./cash-flow";
import { checklistCompletion } from "./checklist";
import { etbEquivalent } from "./currency";
import { incomeStatement } from "./income-statement";
import { workingCapitalGap } from "./working-capital";

export type { Amount } from "./amounts";
export { cashFlowForecast, MAX_FORECAST_MONTHS } from "./cash-flow";
export type { CashFlowForecast, CashFlowInput, CashFlowMonth, CashFlowRow } from "./cash-flow";
export { checklistCompletion } from "./checklist";
export type { ChecklistCompletion, ChecklistItem } from "./checklist";
export { etbEquivalent } from "./currency";
export type { EtbEquivalent, ExchangeRate } from "./currency";
export { incomeStatement } from "./income-statement";
export type { IncomeStatement, IncomeStatementInput } from "./income-statement";
export { workingCapitalGap } from "./working-capital";
export type { WorkingCapital, WorkingCapitalInput } from "./working-capital";

/**
 * The calculators a worksheet can name in `computed[].calculator` (see @entrust/trade-content). The
 * arithmetic is always one of these, never AI. A new one is added here, so a worksheet can't name a
 * calculator that doesn't exist.
 */
export const CALCULATORS = {
  income_statement: incomeStatement,
  cash_flow_forecast: cashFlowForecast,
  working_capital_gap: workingCapitalGap,
  etb_equivalent: etbEquivalent,
  checklist_completion: checklistCompletion,
} as const;

export type CalculatorName = keyof typeof CALCULATORS;
export const CALCULATOR_NAMES = Object.keys(CALCULATORS) as CalculatorName[];
