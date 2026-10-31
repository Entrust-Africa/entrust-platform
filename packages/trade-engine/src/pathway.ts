import type { Pathway, ReasonCode, TradeRules } from "@entrust/trade-rules";
import { planningRules } from "./rules";

export interface PathwayInput {
  /** The day the assessment or diagnostic is submitted, as YYYY-MM-DD. */
  asOf: string;
  /** The date of the latest completed shipment, as YYYY-MM-DD. Leave it out if the SME has never shipped. */
  lastShipmentDate?: string | undefined;
  /** Staff have accepted a shipment record as evidence. */
  shipmentVerified: boolean;
  /** A confirmed order, or a shipment underway or awaiting payment. */
  liveOrder: boolean;
}

export interface PathwayAssignment {
  rulesVersion: string;
  pathway: Pathway;
  /** Pathway B on the SME's word alone, until staff accept a shipment record. Needs a staff review. */
  provisional: boolean;
  liveOrder: boolean;
  reasonCodes: readonly ReasonCode[];
}

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseDate(label: string, value: string): { year: number; month: number; day: number } {
  const match = DATE.exec(value);
  const [year, month, day] = [Number(match?.[1]), Number(match?.[2]), Number(match?.[3])];
  const real = new Date(Date.UTC(year, month - 1, day));
  if (!match || real.getUTCFullYear() !== year || real.getUTCMonth() !== month - 1 || real.getUTCDate() !== day) {
    throw new RangeError(`${label} must be a real date as YYYY-MM-DD, not "${value}"`);
  }
  return { year, month, day };
}

/** The date this many months before `date`, or the month's last day if it has none that day (29 February). */
export function monthsBefore(date: string, months: number): string {
  const { year, month, day } = parseDate("date", date);
  const total = year * 12 + (month - 1) - months;
  const [y, m] = [Math.floor(total / 12), (total % 12) + 1];
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(Math.min(day, lastDay)).padStart(2, "0")}`;
}

/**
 * Pathway B is a shipment within the rules' window before `asOf`, and Pathway A is everyone else, including
 * an SME whose only shipment is older. A shipment that staff haven't accepted yet gives a provisional B.
 * A first-time exporter with a live order stays on A. The date is an argument, so the same input always
 * gives the same answer, and nothing here lets AI set a pathway.
 */
export function assignPathway(rules: TradeRules, input: PathwayInput): PathwayAssignment {
  const { pathway: pathwayRules } = planningRules(rules);
  parseDate("asOf", input.asOf);
  if (input.lastShipmentDate !== undefined) {
    parseDate("lastShipmentDate", input.lastShipmentDate);
    if (input.lastShipmentDate > input.asOf) throw new RangeError("lastShipmentDate can't be after asOf");
  }

  const recent = input.lastShipmentDate !== undefined && input.lastShipmentDate >= monthsBefore(input.asOf, pathwayRules.shipmentWindowMonths);
  const pathway: Pathway = recent ? "B" : "A";
  const provisional = recent && !input.shipmentVerified;
  const reasonCodes: ReasonCode[] = recent ? ["PATHWAY_RECENT_SHIPMENT"] : ["PATHWAY_NO_RECENT_SHIPMENT"];
  if (provisional) reasonCodes.push("PATHWAY_SHIPMENT_UNVERIFIED");
  if (input.liveOrder && pathway === "A") reasonCodes.push("PATHWAY_ORDER_PRIORITY");
  return { rulesVersion: rules.version, pathway, provisional, liveOrder: input.liveOrder, reasonCodes };
}
