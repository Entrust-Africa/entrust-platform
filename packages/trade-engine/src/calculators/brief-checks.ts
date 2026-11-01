import type { Pathway } from "@entrust/trade-rules";
import { dayNumber } from "./dates";
import type { OutlayStage } from "./cash-schedule";

/** The payment method that leaves the SME unpaid until the buyer chooses to pay. It is the key the M04 payment table uses. */
export const OPEN_ACCOUNT = "open_account";

export interface BriefDates {
  /** The day production starts, as YYYY-MM-DD. */
  productionStart?: string | null | undefined;
  deliveryDate?: string | null | undefined;
  /** The day the SME repays the financing. */
  repaymentDate?: string | null | undefined;
  /** The last day the buyer's payment terms allow it to pay. */
  paymentWindowEnd?: string | null | undefined;
}

export type DateIssueCode = "delivery_before_production" | "repayment_after_payment_window";

export interface DateIssue {
  code: DateIssueCode;
  /** The fields to mark on the worksheet. */
  fields: readonly (keyof BriefDates)[];
}

/**
 * M04's date checks. Delivery can't come before production starts (acceptance test 2), and repayment
 * can't fall after the buyer's payment window. The same day passes both. A check waits until both of its
 * dates are entered.
 */
export function briefDateChecks(dates: BriefDates): { issues: readonly DateIssue[] } {
  const productionStart = dayNumber("production start", dates.productionStart);
  const deliveryDate = dayNumber("delivery date", dates.deliveryDate);
  const repaymentDate = dayNumber("repayment date", dates.repaymentDate);
  const paymentWindowEnd = dayNumber("payment window end", dates.paymentWindowEnd);

  const issues: DateIssue[] = [];
  if (productionStart !== null && deliveryDate !== null && deliveryDate < productionStart) {
    issues.push({ code: "delivery_before_production", fields: ["productionStart", "deliveryDate"] });
  }
  if (repaymentDate !== null && paymentWindowEnd !== null && repaymentDate > paymentWindowEnd) {
    issues.push({ code: "repayment_after_payment_window", fields: ["repaymentDate", "paymentWindowEnd"] });
  }
  return { issues };
}

/** What the assessor is asked to confirm. The module's rubric decides whether any of them is a critical failure. */
export type CriticalFailureCode =
  | "open_account_unverified_buyer"
  | "raw_material_missing"
  | "freight_missing"
  | "repayment_after_payment_window"
  | "no_verified_order";

export interface CriticalFailureInput {
  paymentMethod?: string | null | undefined;
  /** Whether the buyer's identity and standing have been checked. Leave it out until the learner answers. */
  buyerVerified?: boolean | null | undefined;
  /** The cash schedule's totals by stage. */
  outlayByStage?: Readonly<Partial<Record<OutlayStage, number | null>>> | null | undefined;
  dates?: BriefDates | undefined;
  pathway?: Pathway | undefined;
  /** The SME says it has a live order. */
  liveOrder?: boolean | undefined;
  /** Whether the brief has a verified purchase order, contract or pro-forma. Leave it out until the learner answers. */
  orderDocumentVerified?: boolean | null | undefined;
}

/**
 * M04's critical-failure candidates, which the assessor confirms (they are never decided by code):
 *
 * - open account with a buyer that isn't verified (acceptance test 3), as soon as that combination is chosen;
 * - no raw material (a sourcing outlay) or no freight (a logistics outlay) in the schedule, once the schedule has anything in it;
 * - repayment after the buyer's payment window;
 * - no verified purchase order, contract or pro-forma, but only on Pathway B or when the SME says it has a
 *   live order. On Pathway A the brief runs on a target deal, so there is no order to verify (#48).
 *
 * A question that hasn't been answered raises nothing.
 */
export function criticalFailureCandidates(input: CriticalFailureInput): { candidates: readonly CriticalFailureCode[] } {
  const candidates: CriticalFailureCode[] = [];
  if (input.paymentMethod === OPEN_ACCOUNT && input.buyerVerified === false) candidates.push("open_account_unverified_buyer");

  const byStage = input.outlayByStage;
  if (byStage && Object.values(byStage).some((v) => v !== null && v !== undefined)) {
    if (byStage.sourcing === 0) candidates.push("raw_material_missing");
    if (byStage.logistics === 0) candidates.push("freight_missing");
  }

  if (input.dates && briefDateChecks(input.dates).issues.some((i) => i.code === "repayment_after_payment_window")) {
    candidates.push("repayment_after_payment_window");
  }

  if ((input.pathway === "B" || input.liveOrder === true) && input.orderDocumentVerified === false) candidates.push("no_verified_order");
  return { candidates };
}
