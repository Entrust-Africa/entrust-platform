import { figure, round2, sum } from "./amounts";
import type { Amount } from "./amounts";
import { dayNumber } from "./dates";

export interface WorkingCapitalInput {
  /** Cash going out before the goods ship: materials, production, packing. */
  preShipmentOutflows: Amount;
  /** Cash going out after they ship: freight, insurance, customs, agent fees. */
  postShipmentOutflows: Amount;
  /** Cash the business can put in itself. */
  internalCash: Amount;
  /** What the buyer pays up front. */
  buyerAdvance: Amount;
  /** The day the first outflow is due, and the day the buyer's payment arrives, as YYYY-MM-DD. */
  startDate?: string | null | undefined;
  paymentDate?: string | null | undefined;
}

export interface WorkingCapital {
  preShipmentOutflows: number | null;
  postShipmentOutflows: number | null;
  totalOutflows: number | null;
  /** Internal cash plus the buyer's advance. */
  availableFunds: number | null;
  /** Total outflows less available funds. Below zero means the business covers the order itself. */
  gap: number | null;
  /** What has to be financed: the gap, or zero if there isn't one. */
  fundingNeeded: number | null;
  /** Days from the first outflow until payment arrives, or null without both dates. */
  daysUntilPayment: number | null;
}

/**
 * M03's export working-capital brief (acceptance test 3): the gap is total outflows less (internal cash
 * plus the buyer's advance), with the outflows split into before and after shipment and the days until
 * the buyer pays. M04's funding gap reads this, and so will M06.
 */
export function workingCapitalGap(input: WorkingCapitalInput): WorkingCapital {
  const preShipmentOutflows = figure("pre-shipment outflows", input.preShipmentOutflows);
  const postShipmentOutflows = figure("post-shipment outflows", input.postShipmentOutflows);
  const internalCash = figure("internal cash", input.internalCash);
  const buyerAdvance = figure("buyer advance", input.buyerAdvance);

  const totalOutflows = sum([preShipmentOutflows, postShipmentOutflows]);
  const availableFunds = sum([internalCash, buyerAdvance]);
  const gap = totalOutflows === null || availableFunds === null ? null : round2(totalOutflows - availableFunds);

  const start = dayNumber("start date", input.startDate);
  const payment = dayNumber("payment date", input.paymentDate);
  if (start !== null && payment !== null && payment < start) throw new RangeError("payment can't arrive before the first outflow");
  return {
    preShipmentOutflows,
    postShipmentOutflows,
    totalOutflows,
    availableFunds,
    gap,
    fundingNeeded: gap === null ? null : Math.max(gap, 0),
    daysUntilPayment: start === null || payment === null ? null : payment - start,
  };
}
