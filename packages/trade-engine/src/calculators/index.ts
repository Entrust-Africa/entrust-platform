import { briefDateChecks, criticalFailureCandidates } from "./brief-checks";
import { cashFlowForecast } from "./cash-flow";
import { cashSchedule } from "./cash-schedule";
import { checklistCompletion } from "./checklist";
import { etbEquivalent } from "./currency";
import { fundingGap } from "./funding-gap";
import { incomeStatement } from "./income-statement";
import { workingCapitalGap } from "./working-capital";

export type { Amount } from "./amounts";
export { OPEN_ACCOUNT, briefDateChecks, criticalFailureCandidates } from "./brief-checks";
export type { BriefDates, CriticalFailureCode, CriticalFailureInput, DateIssue, DateIssueCode } from "./brief-checks";
export { cashFlowForecast, MAX_FORECAST_MONTHS } from "./cash-flow";
export type { CashFlowForecast, CashFlowInput, CashFlowMonth, CashFlowRow } from "./cash-flow";
export { OUTLAY_STAGES, cashSchedule } from "./cash-schedule";
export type { CashSchedule, CashScheduleRow, Outlay, OutlayStage } from "./cash-schedule";
export { checklistCompletion } from "./checklist";
export type { ChecklistCompletion, ChecklistItem } from "./checklist";
export { etbEquivalent } from "./currency";
export type { EtbEquivalent, ExchangeRate } from "./currency";
export { fundingGap } from "./funding-gap";
export type { FundingGap, FundingGapInput } from "./funding-gap";
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
  cash_schedule: cashSchedule,
  funding_gap: fundingGap,
  brief_date_checks: briefDateChecks,
  critical_failure_candidates: criticalFailureCandidates,
} as const;

export type CalculatorName = keyof typeof CALCULATORS;
export const CALCULATOR_NAMES = Object.keys(CALCULATORS) as CalculatorName[];
