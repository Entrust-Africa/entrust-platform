import { figure, round2 } from "./amounts";

export interface NetCapacityInput {
  /** Total units in the production order (e.g. 1000 uniforms) */
  orderQuantity: number;
  /** Number of operational machines available for this production line */
  machines: number;
  /** Standard shift working hours per day per machine (e.g. 8) */
  workingHoursPerDay: number;
  /** Cycle time per single unit in minutes (e.g. 45 or 60) */
  cycleTimeMinutes: number;
  /** Scrap or rework allowance rate (percentage 0-100 or decimal 0-1, e.g. 5 or 0.05) */
  scrapRate: number;
  /** Existing machine commitments in hours per day (optional) */
  committedHoursPerDay?: number | null;
  /** Whether overtime is approved/scheduled */
  allowOvertime?: boolean | null;
  /** Additional overtime hours per day per machine (optional) */
  overtimeHoursPerDay?: number | null;
  /** Production delivery window in working days (optional) */
  daysAvailable?: number | null;
  /** Units outsourced to approved subcontractors (optional) */
  outsourcedUnits?: number | null;
}

export interface NetCapacityResult {
  orderQuantity: number;
  machines: number;
  workingHoursPerDay: number;
  cycleTimeMinutes: number;
  scrapPercentage: number;
  grossHoursPerDay: number;
  netHoursPerDay: number;
  dailyOutputUnits: number;
  daysRequired: number;
  daysAvailable: number | null;
  totalCapacityUnits: number | null;
  capacityUtilizationPercentage: number | null;
  isOverCapacityWithoutMitigation: boolean;
}

/**
 * Net capacity calculator (M07 AT-01).
 * Works out effective productive hours and daily output from machines, standard hours,
 * cycle time per unit, scrap allowance and existing commitments.
 *
 * In the 1,000-uniform test case: 1,000 ÷ 55 ≈ 18.2 days with overtime.
 */
export function calculateNetCapacity(input: NetCapacityInput): NetCapacityResult {
  const orderQuantity = figure("order quantity", input.orderQuantity) ?? 0;
  const machines = Math.max(1, figure("machines", input.machines) ?? 1);
  const workingHoursPerDay = Math.max(0, figure("working hours per day", input.workingHoursPerDay) ?? 8);
  const cycleTimeMinutes = Math.max(0.1, figure("cycle time in minutes", input.cycleTimeMinutes) ?? 60);

  // Normalize scrap rate (accept 5 or 0.05 as 5%)
  const rawScrap = figure("scrap rate", input.scrapRate) ?? 0;
  const scrapPercentage = rawScrap > 1 ? rawScrap : rawScrap * 100;
  const scrapFactor = Math.max(0, Math.min(1, scrapPercentage / 100));

  const committedHours = Math.max(0, figure("committed hours per day", input.committedHoursPerDay) ?? 0);
  const allowOvertime = Boolean(input.allowOvertime);
  const overtimeHours = allowOvertime ? Math.max(0, figure("overtime hours per day", input.overtimeHoursPerDay) ?? 0) : 0;
  const outsourcedUnits = Math.max(0, figure("outsourced units", input.outsourcedUnits) ?? 0);
  const daysAvailable = input.daysAvailable ? Math.max(1, figure("days available", input.daysAvailable) ?? 1) : null;

  // Gross machine hours per day
  const effectiveHoursPerMachine = workingHoursPerDay + overtimeHours;
  const grossHoursPerDay = machines * effectiveHoursPerMachine;

  // Net productive hours per day after deducting existing commitments and scrap allowance
  const uncommittedHours = Math.max(0, grossHoursPerDay - committedHours);
  const netHoursPerDay = round2(uncommittedHours * (1 - scrapFactor));

  // Daily output in units: (net hours * 60 minutes) / cycle time in minutes
  const rawDailyOutput = (netHoursPerDay * 60) / cycleTimeMinutes;
  const dailyOutputUnits = round2(rawDailyOutput);

  // Days required to complete remaining units
  const unitsToProduce = Math.max(0, orderQuantity - outsourcedUnits);
  const rawDaysRequired = dailyOutputUnits > 0 ? unitsToProduce / dailyOutputUnits : Infinity;
  // Round to 1 decimal place (e.g. 1,000 / 55 ≈ 18.2 days)
  const daysRequired = Number.isFinite(rawDaysRequired) ? Math.round(rawDaysRequired * 10) / 10 : 0;

  let totalCapacityUnits: number | null = null;
  let capacityUtilizationPercentage: number | null = null;
  let isOverCapacityWithoutMitigation = false;

  if (daysAvailable !== null) {
    totalCapacityUnits = Math.floor(dailyOutputUnits * daysAvailable) + outsourcedUnits;
    if (totalCapacityUnits > 0) {
      capacityUtilizationPercentage = round2((orderQuantity / totalCapacityUnits) * 100);
    }
    // Output above 100% of net capacity with no overtime or outsourcing (AT-04)
    if (daysRequired > daysAvailable && !allowOvertime && outsourcedUnits === 0) {
      isOverCapacityWithoutMitigation = true;
    }
  }

  return {
    orderQuantity,
    machines,
    workingHoursPerDay,
    cycleTimeMinutes,
    scrapPercentage,
    grossHoursPerDay: round2(grossHoursPerDay),
    netHoursPerDay,
    dailyOutputUnits,
    daysRequired,
    daysAvailable,
    totalCapacityUnits,
    capacityUtilizationPercentage,
    isOverCapacityWithoutMitigation,
  };
}
