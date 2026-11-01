import { figure, round2 } from "./amounts";
import type { Amount } from "./amounts";

/** The longest forecast a worksheet can ask for. The M03 lesson teaches three months and its pack asks for twelve (#48). */
export const MAX_FORECAST_MONTHS = 36;

export interface CashFlowMonth {
  inflows: Amount;
  outflows: Amount;
}

export interface CashFlowInput {
  /** The cash in hand at the start of the first month. It may be negative. */
  openingBalance: Amount;
  months: readonly CashFlowMonth[];
}

export interface CashFlowRow {
  /** 1 for the first month. */
  month: number;
  opening: number | null;
  inflows: number | null;
  outflows: number | null;
  /** Inflows less outflows. */
  net: number | null;
  closing: number | null;
}

export interface CashFlowForecast {
  rows: readonly CashFlowRow[];
  /** Months that close below zero. The SME's home shows a warning for each (acceptance test 12). */
  warnings: readonly { month: number; closing: number }[];
  /** The month with the lowest closing balance, or null while any closing balance is blank. */
  lowest: { month: number; closing: number } | null;
}

/**
 * M03's cash-flow forecast (acceptance test 2). Each month's closing balance is opening + inflows -
 * outflows, and it becomes the next month's opening balance, so the learner never types an opening
 * balance after the first. A blank figure leaves that month and every month after it blank.
 */
export function cashFlowForecast(input: CashFlowInput): CashFlowForecast {
  if (!input.months.length) throw new RangeError("a forecast needs at least one month");
  if (input.months.length > MAX_FORECAST_MONTHS) throw new RangeError(`a forecast covers at most ${MAX_FORECAST_MONTHS} months`);

  let opening = figure("opening balance", input.openingBalance);
  const rows: CashFlowRow[] = input.months.map((m, i) => {
    const inflows = figure(`month ${i + 1} inflows`, m.inflows);
    const outflows = figure(`month ${i + 1} outflows`, m.outflows);
    const net = inflows === null || outflows === null ? null : round2(inflows - outflows);
    const closing = opening === null || net === null ? null : round2(opening + net);
    const row: CashFlowRow = { month: i + 1, opening, inflows, outflows, net, closing };
    opening = closing;
    return row;
  });

  const closings = rows.filter((r): r is CashFlowRow & { closing: number } => r.closing !== null);
  const warnings = closings.filter((r) => r.closing < 0).map((r) => ({ month: r.month, closing: r.closing }));
  const lowest = closings.length === rows.length ? closings.reduce((low, r) => (r.closing < low.closing ? r : low)) : null;
  return { rows, warnings, lowest: lowest && { month: lowest.month, closing: lowest.closing } };
}
