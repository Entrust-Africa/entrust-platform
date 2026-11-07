import { describe, expect, it } from "vitest";
import {
  calculateBOM,
  calculateNetCapacity,
  calculateBackwardSchedule,
  m07CriticalFailureCandidates,
} from "../src";

describe("M07 Order Fulfilment Plan calculators (#66)", () => {
  describe("Net Capacity Calculator (AT-01)", () => {
    it("computes the 1,000-uniform case with overtime: 1,000 ÷ 55 ≈ 18.2 days", () => {
      // 1,000-uniform order with parameters yielding 55 net units/day
      // E.g. 5 machines, 9 hours/day (8 standard + 1 overtime), 45 min cycle time, scrap allowance ~8.33%
      // gross hours = 5 * 9 = 45 hrs/day
      // net hours = 45 * (1 - 0.0833333) = 41.25 hrs/day
      // daily output = 41.25 * 60 / 45 = 55 units/day
      // days required = 1000 / 55 ≈ 18.2 days
      const result = calculateNetCapacity({
        orderQuantity: 1000,
        machines: 5,
        workingHoursPerDay: 8,
        allowOvertime: true,
        overtimeHoursPerDay: 1,
        cycleTimeMinutes: 45,
        scrapRate: 8.33333,
      });

      expect(result.dailyOutputUnits).toBe(55);
      // 1,000 ÷ 55 ≈ 18.1818... which rounds to 18.2 days, not the incorrect 18.5 from the old spec answer key
      expect(result.daysRequired).toBe(18.2);
    });

    it("flags output above 100% capacity with no overtime or outsourcing as critical (AT-04)", () => {
      // Order of 1,000 units with 5 machines, 8 hrs/day, 60 min cycle, 0% scrap -> 40 units/day
      // Available window is 20 days -> 800 units capacity (utilization = 125%)
      const result = calculateNetCapacity({
        orderQuantity: 1000,
        machines: 5,
        workingHoursPerDay: 8,
        cycleTimeMinutes: 60,
        scrapRate: 0,
        daysAvailable: 20,
        allowOvertime: false,
        outsourcedUnits: 0,
      });

      expect(result.dailyOutputUnits).toBe(40);
      expect(result.daysRequired).toBe(25);
      expect(result.totalCapacityUnits).toBe(800);
      expect(result.capacityUtilizationPercentage).toBe(125);
      expect(result.isOverCapacityWithoutMitigation).toBe(true);
    });

    it("does not flag over-capacity when overtime is permitted and scheduled", () => {
      const result = calculateNetCapacity({
        orderQuantity: 1000,
        machines: 5,
        workingHoursPerDay: 8,
        cycleTimeMinutes: 60,
        scrapRate: 0,
        daysAvailable: 20,
        allowOvertime: true,
        overtimeHoursPerDay: 3, // expands daily capacity
        outsourcedUnits: 0,
      });

      expect(result.isOverCapacityWithoutMitigation).toBe(false);
    });
  });

  describe("Bill of Materials Calculator with Waste Allowance (AT-02)", () => {
    it("computes the 1,000-uniform fabric requirement: 2,625 m of fabric", () => {
      // 1,000 uniforms at 2.5 m base fabric with 5% waste allowance
      // 1,000 * 2.5 = 2,500 m base; 2,500 * 0.05 = 125 m waste; total required = 2,625 m
      const result = calculateBOM({
        orderQuantity: 1000,
        items: [
          {
            id: "fabric-cotton",
            item: "Cotton twill fabric",
            unit: "meters",
            baseQuantityPerUnit: 2.5,
            wastePercentage: 5,
            unitCost: 120, // ETB/m
          },
          {
            id: "buttons",
            item: "Buttons (set of 6)",
            unit: "sets",
            baseQuantityPerUnit: 1,
            wastePercentage: 2,
            unitCost: 15,
          },
        ],
      });

      const fabricLine = result.lines.find((l) => l.id === "fabric-cotton");
      expect(fabricLine).toBeDefined();
      expect(fabricLine?.baseTotalQuantity).toBe(2500);
      expect(fabricLine?.wasteQuantity).toBe(125);
      expect(fabricLine?.requiredQuantity).toBe(2625);
      expect(fabricLine?.totalCost).toBe(2625 * 120);

      const buttonsLine = result.lines.find((l) => l.id === "buttons");
      expect(buttonsLine?.requiredQuantity).toBe(1020);
    });
  });

  describe("Backward Milestone Scheduler (AT-03)", () => {
    it("calculates backward milestones correctly from handover date", () => {
      const schedule = calculateBackwardSchedule({
        contractDeadline: "2026-12-31",
        handoverDate: "2026-12-24",
        productionDays: 19,
        materialLeadDays: 14,
        transitDaysToPort: 2,
        packagingDays: 1,
        inspectionDays: 1,
        hasQualityCheckpointBeforeDispatch: true,
      });

      expect(schedule.milestones.handoverDate).toBe("2026-12-24");
      expect(schedule.milestones.dispatchDate).toBe("2026-12-22");
      expect(schedule.milestones.qcDate).toBe("2026-12-21");
      expect(schedule.milestones.packagingDate).toBe("2026-12-20");
      expect(schedule.milestones.productionEndDate).toBe("2026-12-20");
      expect(schedule.milestones.productionStartDate).toBe("2026-12-01");
      expect(schedule.milestones.procurementDueDate).toBe("2026-12-01");
      expect(schedule.milestones.procurementStartDate).toBe("2026-11-17");
      expect(schedule.issues).toHaveLength(0);
    });

    it("flags handover after contract deadline", () => {
      const schedule = calculateBackwardSchedule({
        contractDeadline: "2026-12-20",
        handoverDate: "2026-12-24", // later than contract deadline
        productionDays: 10,
        materialLeadDays: 7,
        hasQualityCheckpointBeforeDispatch: true,
      });

      expect(schedule.criticalFailures).toContain("handover_after_deadline");
    });

    it("flags omitted material lead times", () => {
      const schedule = calculateBackwardSchedule({
        contractDeadline: "2026-12-31",
        handoverDate: "2026-12-24",
        productionDays: 10,
        materialLeadDays: 0, // omitted
        hasQualityCheckpointBeforeDispatch: true,
      });

      expect(schedule.criticalFailures).toContain("material_lead_time_omitted");
    });

    it("flags missing quality control checkpoint before dispatch", () => {
      const schedule = calculateBackwardSchedule({
        contractDeadline: "2026-12-31",
        handoverDate: "2026-12-24",
        productionDays: 10,
        materialLeadDays: 7,
        hasQualityCheckpointBeforeDispatch: false, // missing QC
      });

      expect(schedule.criticalFailures).toContain("no_qc_before_dispatch");
    });

    it("flags schedule clash with M04 cash availability", () => {
      // Handover Dec 24, production 19 days, lead time 14 days -> procurement starts Nov 17
      // But M04 financing cash only arrives Dec 01 -> Cash clash!
      const schedule = calculateBackwardSchedule({
        contractDeadline: "2026-12-31",
        handoverDate: "2026-12-24",
        productionDays: 19,
        materialLeadDays: 14,
        transitDaysToPort: 2,
        packagingDays: 1,
        inspectionDays: 1,
        hasQualityCheckpointBeforeDispatch: true,
        m04CashMilestoneDate: "2026-12-01",
      });

      expect(schedule.criticalFailures).toContain("schedule_cash_clash");
    });
  });

  describe("Assessor Critical Failure Candidates (AT-04)", () => {
    it("detects all 4 critical failures when conditions are violated", () => {
      const failures = m07CriticalFailureCandidates({
        capacity: {
          orderQuantity: 1000,
          machines: 4,
          workingHoursPerDay: 8,
          cycleTimeMinutes: 60,
          scrapRate: 0,
          daysAvailable: 15, // capacity is 4 * 8 * 15 = 480 units < 1000
          allowOvertime: false,
          outsourcedUnits: 0,
        },
        schedule: {
          contractDeadline: "2026-12-31",
          handoverDate: "2026-12-24",
          productionDays: 15,
          materialLeadDays: 0, // failure: omitted lead time
          hasQualityCheckpointBeforeDispatch: false, // failure: no QC
          m04CashMilestoneDate: "2026-12-20", // failure: cash clash
        },
      });

      const codes = failures.map((f) => f.code);
      expect(codes).toContain("output_exceeds_net_capacity");
      expect(codes).toContain("material_lead_time_omitted");
      expect(codes).toContain("no_qc_before_dispatch");
      expect(codes).toContain("schedule_cash_clash");
      expect(failures).toHaveLength(4);
    });
  });
});
