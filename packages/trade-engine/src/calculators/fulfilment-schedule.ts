import { dayNumber } from "./dates";

const DAY_MS = 24 * 60 * 60 * 1000;

function toIsoString(dayCount: number): string {
  const d = new Date(dayCount * DAY_MS);
  return d.toISOString().slice(0, 10);
}

export interface FulfilmentScheduleInput {
  /** Contract delivery deadline (YYYY-MM-DD) */
  contractDeadline?: string | null;
  /** Agreed handover date to freight forwarder or buyer (YYYY-MM-DD) */
  handoverDate?: string | null;
  /** Production duration in days */
  productionDays: number;
  /** Material procurement lead time in days */
  materialLeadDays: number;
  /** Transit days to port or handover location (default 0) */
  transitDaysToPort?: number | null;
  /** Packaging and export preparation duration in days (default 1) */
  packagingDays?: number | null;
  /** Final quality control inspection duration in days (default 1) */
  inspectionDays?: number | null;
  /** Whether a pre-dispatch QC checkpoint is explicitly configured */
  hasQualityCheckpointBeforeDispatch?: boolean | null;
  /** M04 cash disbursement or funding date (YYYY-MM-DD) if available */
  m04CashMilestoneDate?: string | null;
}

export type FulfilmentIssueCode =
  | "handover_after_deadline"
  | "production_after_handover"
  | "material_lead_time_omitted"
  | "no_qc_before_dispatch"
  | "schedule_cash_clash";

export interface FulfilmentIssue {
  code: FulfilmentIssueCode;
  severity: "critical" | "warning";
  message: string;
  fields: readonly string[];
}

export interface BackwardMilestones {
  contractDeadline: string | null;
  handoverDate: string | null;
  dispatchDate: string | null;
  qcDate: string | null;
  packagingDate: string | null;
  productionEndDate: string | null;
  productionStartDate: string | null;
  procurementDueDate: string | null;
  procurementStartDate: string | null;
}

export interface FulfilmentScheduleResult {
  milestones: BackwardMilestones;
  issues: readonly FulfilmentIssue[];
  criticalFailures: readonly FulfilmentIssueCode[];
}

/**
 * Backward schedule from the handover date (M07 AT-03).
 * Works out critical production and procurement milestones backwards from the handover date.
 * Flags:
 * - Production that finishes after handover
 * - Handover after the contract deadline
 * - Material lead times left out
 * - No quality checkpoint before dispatch
 * - Schedule that clashes with M04 cash dates
 */
export function calculateBackwardSchedule(input: FulfilmentScheduleInput): FulfilmentScheduleResult {
  const contractDeadlineDay = dayNumber("contract deadline", input.contractDeadline);
  const handoverDay = dayNumber("handover date", input.handoverDate);
  const m04CashDay = dayNumber("M04 cash date", input.m04CashMilestoneDate);

  const productionDays = Math.max(0, Math.ceil(input.productionDays || 0));
  const materialLeadDays = Math.max(0, Math.ceil(input.materialLeadDays || 0));
  const transitDays = Math.max(0, Math.ceil(input.transitDaysToPort || 0));
  const packagingDays = Math.max(0, Math.ceil(input.packagingDays !== undefined && input.packagingDays !== null ? input.packagingDays : 1));
  const inspectionDays = Math.max(0, Math.ceil(input.inspectionDays !== undefined && input.inspectionDays !== null ? input.inspectionDays : 1));
  const hasQC = Boolean(input.hasQualityCheckpointBeforeDispatch);

  const issues: FulfilmentIssue[] = [];

  // Check 1: Handover after contract deadline
  if (handoverDay !== null && contractDeadlineDay !== null && handoverDay > contractDeadlineDay) {
    issues.push({
      code: "handover_after_deadline",
      severity: "critical",
      message: "Handover date is after the contract deadline.",
      fields: ["handoverDate", "contractDeadline"],
    });
  }

  // Check 2: Material lead times left out
  if (materialLeadDays <= 0) {
    issues.push({
      code: "material_lead_time_omitted",
      severity: "critical",
      message: "Material procurement lead times are missing or zero.",
      fields: ["materialLeadDays"],
    });
  }

  // Check 3: Quality control checkpoint missing
  if (!hasQC || inspectionDays <= 0) {
    issues.push({
      code: "no_qc_before_dispatch",
      severity: "critical",
      message: "No quality control inspection checkpoint is scheduled before dispatch.",
      fields: ["hasQualityCheckpointBeforeDispatch", "inspectionDays"],
    });
  }

  let milestones: BackwardMilestones = {
    contractDeadline: contractDeadlineDay !== null ? toIsoString(contractDeadlineDay) : null,
    handoverDate: handoverDay !== null ? toIsoString(handoverDay) : null,
    dispatchDate: null,
    qcDate: null,
    packagingDate: null,
    productionEndDate: null,
    productionStartDate: null,
    procurementDueDate: null,
    procurementStartDate: null,
  };

  if (handoverDay !== null) {
    const dispatchDay = handoverDay - transitDays;
    const qcDay = dispatchDay - inspectionDays;
    const packagingDay = qcDay - packagingDays;
    const productionEndDay = packagingDay;
    const productionStartDay = productionEndDay - productionDays;
    const procurementDueDay = productionStartDay;
    const procurementStartDay = procurementDueDay - materialLeadDays;

    milestones = {
      ...milestones,
      dispatchDate: toIsoString(dispatchDay),
      qcDate: toIsoString(qcDay),
      packagingDate: toIsoString(packagingDay),
      productionEndDate: toIsoString(productionEndDay),
      productionStartDate: toIsoString(productionStartDay),
      procurementDueDate: toIsoString(procurementDueDay),
      procurementStartDate: toIsoString(procurementStartDay),
    };

    // Check 4: Production finishes after handover
    if (productionEndDay > handoverDay) {
      issues.push({
        code: "production_after_handover",
        severity: "critical",
        message: "Production finishes after the agreed handover date.",
        fields: ["productionDays", "handoverDate"],
      });
    }

    // Check 5: Clash with M04 cash dates
    // If procurement must start before cash is disbursed from M04, the order faces a liquidity clash
    if (m04CashDay !== null && procurementStartDay < m04CashDay) {
      issues.push({
        code: "schedule_cash_clash",
        severity: "critical",
        message: "Procurement start date clashes with M04 cash availability (cash arrives after procurement must start).",
        fields: ["m04CashMilestoneDate", "materialLeadDays"],
      });
    }
  }

  const criticalFailures = issues.filter((i) => i.severity === "critical").map((i) => i.code);

  return {
    milestones,
    issues,
    criticalFailures,
  };
}
