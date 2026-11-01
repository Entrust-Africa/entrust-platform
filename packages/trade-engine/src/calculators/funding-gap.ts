import { figure, round2, sum } from "./amounts";
import type { Amount } from "./amounts";

export interface FundingGapInput {
  /** All the cash the deal needs: the schedule's total, or the M03 working-capital brief's total outflows. */
  totalOutlay: Amount;
  /** Cash the business can put in itself. */
  internalCash: Amount;
  /** What buyers pay up front. An empty list means none are expected, which is zero, not blank. */
  buyerAdvances: readonly Amount[];
}

export interface FundingGap {
  totalOutlay: number | null;
  internalCash: number | null;
  /** The advances added up. */
  buyerAdvances: number | null;
  /** Internal cash plus buyer advances. */
  availableFunds: number | null;
  /** Total outlay less available funds. Below zero means the business covers the deal itself. */
  gap: number | null;
  /** What has to be financed: the gap, or zero if there isn't one. */
  fundingNeeded: number | null;
}

/**
 * M04's funding gap (section E): gap = total outlay - (internal cash + buyer advances). It is the same
 * sum as M03's working-capital gap, which prefills it, but takes the total outlay as one figure and
 * lets a deal have several advances.
 */
export function fundingGap(input: FundingGapInput): FundingGap {
  const totalOutlay = figure("total outlay", input.totalOutlay);
  const internalCash = figure("internal cash", input.internalCash);
  const buyerAdvances = sum(input.buyerAdvances.map((a, i) => figure(`buyer advance ${i + 1}`, a)));
  const availableFunds = sum([internalCash, buyerAdvances]);
  const gap = totalOutlay === null || availableFunds === null ? null : round2(totalOutlay - availableFunds);
  return { totalOutlay, internalCash, buyerAdvances, availableFunds, gap, fundingNeeded: gap === null ? null : Math.max(gap, 0) };
}
