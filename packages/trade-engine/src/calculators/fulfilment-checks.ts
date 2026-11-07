import { calculateNetCapacity, type NetCapacityInput } from "./capacity";
import { calculateBackwardSchedule, type FulfilmentScheduleInput, type FulfilmentIssueCode } from "./fulfilment-schedule";

export type M07CriticalFailureCode =
  | "output_exceeds_net_capacity"
  | "material_lead_time_omitted"
  | "no_qc_before_dispatch"
  | "schedule_cash_clash";

export interface M07CriticalFailureInput {
  capacity: NetCapacityInput;
  schedule: FulfilmentScheduleInput;
}

export interface M07CriticalFailureCandidate {
  code: M07CriticalFailureCode;
  title: string;
  description: string;
}

/**
 * Assessor critical-failure candidates for M07 Order Fulfilment Plan (AT-04).
 * Evaluates the 4 critical failure rules from Issue #66:
 * 1. Output above 100% of net capacity with no overtime or outsourcing
 * 2. Material lead times left out
 * 3. No quality checkpoint before dispatch
 * 4. Schedule that clashes with the M04 cash dates
 */
export function m07CriticalFailureCandidates(input: M07CriticalFailureInput): readonly M07CriticalFailureCandidate[] {
  const candidates: M07CriticalFailureCandidate[] = [];

  // Check 1: Output above 100% of net capacity with no overtime or outsourcing
  const capResult = calculateNetCapacity(input.capacity);
  if (capResult.isOverCapacityWithoutMitigation) {
    candidates.push({
      code: "output_exceeds_net_capacity",
      title: "Output exceeds net capacity without overtime or outsourcing",
      description: `Order quantity (${capResult.orderQuantity}) exceeds available net capacity (${capResult.totalCapacityUnits}) within the delivery window with neither overtime nor subcontracting scheduled.`,
    });
  }

  // Schedule-based critical failures
  const schedResult = calculateBackwardSchedule(input.schedule);
  for (const issue of schedResult.issues) {
    if (issue.code === "material_lead_time_omitted") {
      candidates.push({
        code: "material_lead_time_omitted",
        title: "Material lead times omitted",
        description: "Procurement lead time is omitted or set to 0, risking severe line-stoppage.",
      });
    } else if (issue.code === "no_qc_before_dispatch") {
      candidates.push({
        code: "no_qc_before_dispatch",
        title: "No quality checkpoint before dispatch",
        description: "No dedicated pre-dispatch quality control inspection or tolerance sign-off is included.",
      });
    } else if (issue.code === "schedule_cash_clash") {
      candidates.push({
        code: "schedule_cash_clash",
        title: "Schedule clashes with M04 cash dates",
        description: "Material procurement must be financed before M04 trade finance cash is scheduled to be available.",
      });
    }
  }

  return candidates;
}
