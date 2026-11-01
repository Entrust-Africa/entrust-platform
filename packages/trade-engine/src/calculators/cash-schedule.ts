import { figure, round2, sum } from "./amounts";
import type { Amount } from "./amounts";
import { dayNumber } from "./dates";

/** The stages of the deal that cost cash, in M04's order: buying the material, making the goods, moving them, clearing them. */
export const OUTLAY_STAGES = ["sourcing", "production", "logistics", "customs"] as const;
export type OutlayStage = (typeof OUTLAY_STAGES)[number];

export interface Outlay {
  stage: OutlayStage;
  /** The day the money goes out, as YYYY-MM-DD. */
  date?: string | null | undefined;
  amount: Amount;
}

export interface CashScheduleRow {
  /** Where this outlay was in the input, so the worksheet can match the row to what the learner typed. */
  index: number;
  stage: OutlayStage;
  date: string | null;
  amount: number | null;
  /** Everything paid out up to and including this row, or null from the first row that lacks a date or an amount. */
  cumulative: number | null;
}

export interface CashSchedule {
  /** In date order. Outlays on the same day, and outlays without a date (which come last), keep the order they were entered in. */
  rows: readonly CashScheduleRow[];
  /** Every outlay added up, or null while any amount is blank or nothing is entered. */
  totalOutlay: number | null;
  /** Each stage's total. A stage with no outlay is 0, once something is entered; null while one of its amounts is blank. */
  byStage: Readonly<Record<OutlayStage, number | null>>;
  /** The most cash that has gone out at any point, and the first day that happens. Null until every outlay has a date and an amount. */
  peak: { date: string; cumulative: number } | null;
}

/**
 * M04's dated cash outlay schedule (section D). The learner lists what is paid, when and for which stage;
 * this puts it in date order with a running total and finds the peak cumulative outlay and the day it
 * happens. The sesame example peaks at 760k against 200k of cash, a 560k gap (`fundingGap`).
 */
export function cashSchedule(outlays: readonly Outlay[]): CashSchedule {
  const entered = outlays.map((o, index) => {
    if (!OUTLAY_STAGES.includes(o.stage)) throw new RangeError(`outlay ${index + 1} stage must be one of ${OUTLAY_STAGES.join(", ")}`);
    const amount = figure(`outlay ${index + 1} amount`, o.amount);
    if (amount !== null && amount < 0) throw new RangeError(`outlay ${index + 1} amount can't be negative`);
    const date = o.date === "" ? null : (o.date ?? null);
    return { index, stage: o.stage, date, day: dayNumber(`outlay ${index + 1} date`, date), amount };
  });
  const ordered = entered.slice().sort((a, b) => (a.day === b.day ? a.index - b.index : a.day === null ? 1 : b.day === null ? -1 : a.day - b.day));

  let running: number | null = 0;
  const rows: CashScheduleRow[] = ordered.map((o) => {
    running = running === null || o.amount === null || o.day === null ? null : round2(running + o.amount);
    return { index: o.index, stage: o.stage, date: o.date, amount: o.amount, cumulative: running };
  });

  return { rows, totalOutlay: totalOf(rows), byStage: byStageOf(rows), peak: peakOf(rows) };
}

function totalOf(rows: readonly CashScheduleRow[]): number | null {
  return rows.length === 0 ? null : sum(rows.map((r) => r.amount));
}

function byStageOf(rows: readonly CashScheduleRow[]): CashSchedule["byStage"] {
  const stageTotal = (stage: OutlayStage): number | null => (rows.length === 0 ? null : sum(rows.filter((r) => r.stage === stage).map((r) => r.amount)));
  return { sourcing: stageTotal("sourcing"), production: stageTotal("production"), logistics: stageTotal("logistics"), customs: stageTotal("customs") };
}

/** The peak is judged at the end of each day, so two outlays on one day count together. */
function peakOf(rows: readonly CashScheduleRow[]): CashSchedule["peak"] {
  let peak: CashSchedule["peak"] = null;
  for (const [i, r] of rows.entries()) {
    if (r.cumulative === null || r.date === null) return null;
    if (rows[i + 1]?.date !== r.date && (peak === null || r.cumulative > peak.cumulative)) peak = { date: r.date, cumulative: r.cumulative };
  }
  return peak;
}
