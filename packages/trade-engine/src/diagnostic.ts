import { YES, effectiveAnswers } from "@entrust/forms";
import type { Answers } from "@entrust/forms";
import type { DiagnosticTemplate, TradeRules } from "@entrust/trade-rules";
import { assignPathway } from "./pathway";
import type { PathwayAssignment, PathwayInput } from "./pathway";

export interface DiagnosticPathwayOptions {
  /** The day the diagnostic is submitted, as YYYY-MM-DD. */
  asOf: string;
  /** Staff have accepted a shipment record as evidence. Leave it out for a new submission. */
  shipmentVerified?: boolean;
}

/**
 * What the pathway rule reads from a diagnostic's answers: whether it names a latest shipment, and
 * whether a confirmed order or an active contract is in hand. Only the answers to shown questions
 * count, so a date left behind after Q135 changed to "no" is ignored.
 */
export function pathwayInputFromDiagnostic(template: DiagnosticTemplate, answers: Answers, options: DiagnosticPathwayOptions): PathwayInput {
  const effective = effectiveAnswers(template, answers);
  const { exported, lastShipment, liveOrder } = template.pathwayInputs;
  const date = effective[lastShipment];
  return {
    asOf: options.asOf,
    lastShipmentDate: effective[exported] === YES && typeof date === "string" ? date : undefined,
    shipmentVerified: options.shipmentVerified ?? false,
    liveOrder: liveOrder.some((id) => effective[id] === YES),
  };
}

/**
 * The pathway for a submitted diagnostic: B for a shipment in the rules' window before `asOf`, A for
 * everyone else. A first-time exporter with a confirmed order stays on A and is flagged, so the plan
 * moves M04, M06 and M08 forward. The date is an argument and nothing here lets AI set a pathway.
 * Check the answers with `checkAnswers` first, passing the same day as `today`: a latest shipment after
 * `asOf` throws.
 */
export function assignPathwayFromDiagnostic(
  rules: TradeRules,
  template: DiagnosticTemplate,
  answers: Answers,
  options: DiagnosticPathwayOptions,
): PathwayAssignment {
  return assignPathway(rules, pathwayInputFromDiagnostic(template, answers, options));
}
