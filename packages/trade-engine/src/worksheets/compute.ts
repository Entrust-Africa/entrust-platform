import { isDate } from "@entrust/forms";
import {
  briefDateChecks,
  calculateBOM,
  calculateBackwardSchedule,
  calculateNetCapacity,
  cashFlowForecast,
  cashSchedule,
  checklistCompletion,
  criticalFailureCandidates,
  etbEquivalent,
  fundingGap,
  incomeStatement,
  workingCapitalGap,
  type BriefDates,
  type Outlay,
} from "../calculators";
import { INFORMATION_PACK_ITEMS, findWorksheet, packItemId } from "./definitions";
import type { ResultValue, WorksheetContext, WorksheetDefinition, WorksheetFlag, WorksheetProblem, WorksheetResult, WorksheetValues } from "./types";

// Works out a worksheet from what the learner has entered so far. It never throws and never treats a blank as zero: a result
// that depends on a missing figure is null, a figure a calculator refuses (a date that isn't real, a negative outlay) is a
// problem against its field, and a check that needs two answers waits for both. The same values always give the same result.

type Acc = {
  computed: Record<string, ResultValue>;
  rows: Record<string, Record<string, ResultValue>[]>;
  flags: WorksheetFlag[];
  problems: WorksheetProblem[];
};

const isBlank = (v: unknown): boolean => v === null || v === undefined || v === "";

/** A number the learner entered, or null while it is blank. Anything else is a problem against the field. */
function num(values: WorksheetValues, id: string, acc: Acc, label = id): number | null {
  const v = values[id];
  if (isBlank(v)) return null;
  if (typeof v !== "number" || !Number.isFinite(v)) {
    acc.problems.push({ field: id, message: `${label} must be a number.` });
    return null;
  }
  return v;
}

function text(values: WorksheetValues, id: string): string | null {
  const v = values[id];
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/** A yes/no choice as a boolean, or null while it is unanswered. */
function yes(values: WorksheetValues, id: string): boolean | null {
  const v = values[id];
  return v === "yes" ? true : v === "no" ? false : null;
}

type Row = Record<string, unknown>;
function rowsOf(values: WorksheetValues, id: string): Row[] {
  const v = values[id];
  return Array.isArray(v) ? v.filter((r): r is Row => typeof r === "object" && r !== null && !Array.isArray(r)) : [];
}

/** Runs a calculator, turning its refusal into a problem against the field it names. */
function guard<T>(acc: Acc, field: string, run: () => T): T | null {
  try {
    return run();
  } catch (error) {
    const raw = error instanceof Error ? error.message : "That figure can't be used";
    acc.problems.push({ field, message: raw.charAt(0).toUpperCase() + raw.slice(1) + (/[.!?]$/.test(raw) ? "" : ".") });
    return null;
  }
}

const flag = (acc: Acc, code: string, severity: WorksheetFlag["severity"], message: string, fields: readonly string[]) => acc.flags.push({ code, severity, message, fields });

const COMPUTE: Record<string, (v: WorksheetValues, acc: Acc, ctx: WorksheetContext) => void> = {
  "m01-export-opportunity-brief"(v, acc) {
    const brief = text(v, "brief_date");
    const rows = rowsOf(v, "actions");
    rows.forEach((row, i) => {
      const deadline = typeof row.deadline === "string" ? row.deadline : "";
      if (!brief || !deadline) return;
      // Compared as YYYY-MM-DD text, which sorts like the dates. A date that isn't real is the date field's problem, not ours.
      const days = Math.round((Date.parse(`${deadline}T00:00:00Z`) - Date.parse(`${brief}T00:00:00Z`)) / 86_400_000);
      if (Number.isNaN(days)) return;
      if (days < 0) flag(acc, "deadline_before_brief", "warning", `Action ${i + 1} has a deadline before the date of the brief.`, [`actions.${i}.deadline`]);
      else if (days > 30) flag(acc, "deadline_beyond_30_days", "warning", `Action ${i + 1} has a deadline more than 30 days after the brief. These are the next 30 days' actions.`, [`actions.${i}.deadline`]);
    });
  },

  "m03-income-statement"(v, acc) {
    const result = guard(acc, "revenue", () => incomeStatement({ revenue: num(v, "revenue", acc, "Revenue"), costOfGoodsSold: num(v, "cost_of_goods_sold", acc, "Cost of goods sold"), operatingExpenses: num(v, "operating_expenses", acc, "Operating expenses") }));
    Object.assign(acc.computed, { gross_profit: result?.grossProfit ?? null, gross_margin: result?.grossMargin ?? null, operating_profit: result?.operatingProfit ?? null, operating_margin: result?.operatingMargin ?? null });
  },

  "m03-cash-flow-forecast"(v, acc) {
    const rows = rowsOf(v, "months");
    if (rows.length === 0) {
      Object.assign(acc.computed, { lowest_closing: null, months_below_zero: null });
      return;
    }
    const months = rows.map((r, i) => ({ inflows: num(r, "inflows", acc, `Month ${i + 1} cash coming in`), outflows: num(r, "outflows", acc, `Month ${i + 1} cash going out`) }));
    const forecast = guard(acc, "months", () => cashFlowForecast({ openingBalance: num(v, "opening_balance", acc, "Opening cash"), months }));
    acc.rows.months = (forecast?.rows ?? []).map((r) => ({ opening: r.opening, net: r.net, closing: r.closing }));
    Object.assign(acc.computed, { lowest_closing: forecast?.lowest?.closing ?? null, months_below_zero: forecast ? forecast.warnings.length : null });
    for (const w of forecast?.warnings ?? []) flag(acc, "negative_closing_balance", "warning", `Month ${w.month} ends with less than no cash (${w.closing}). You would run out before the month is over.`, [`months.${w.month - 1}.outflows`]);
  },

  "m03-working-capital-brief"(v, acc) {
    const result = guard(acc, "payment_date", () =>
      workingCapitalGap({
        preShipmentOutflows: num(v, "pre_shipment_outflows", acc, "Cash out before shipping"),
        postShipmentOutflows: num(v, "post_shipment_outflows", acc, "Cash out after shipping"),
        internalCash: num(v, "internal_cash", acc, "Your own cash"),
        buyerAdvance: num(v, "buyer_advance", acc, "The buyer's advance"),
        startDate: text(v, "start_date"),
        paymentDate: text(v, "payment_date"),
      }),
    );
    Object.assign(acc.computed, {
      total_outflows: result?.totalOutflows ?? null,
      available_funds: result?.availableFunds ?? null,
      gap: result?.gap ?? null,
      funding_needed: result?.fundingNeeded ?? null,
      days_until_payment: result?.daysUntilPayment ?? null,
    });
  },

  "m03-information-pack"(v, acc) {
    const result = checklistCompletion(INFORMATION_PACK_ITEMS.map((_, i) => ({ id: packItemId(i), provided: v[packItemId(i)] === true })));
    const labels = new Map(INFORMATION_PACK_ITEMS.map((label, i) => [packItemId(i), label]));
    Object.assign(acc.computed, { provided: result.provided, completion_percent: result.percent, missing: result.missing.map((id) => labels.get(id) ?? id).join("; ") });
  },

  "m04-transaction-brief"(v, acc, ctx) {
    // D. The cash schedule.
    const outlayRows = rowsOf(v, "outlays");
    const outlays: Outlay[] = outlayRows.map((r, i) => ({ stage: r.stage as Outlay["stage"], date: typeof r.date === "string" ? r.date : null, amount: num(r, "amount", acc, `Outlay ${i + 1} amount`) }));
    const filled = outlays.filter((o, i) => o.stage || o.date || !isBlank(outlayRows[i]?.amount));
    let schedule: ReturnType<typeof cashSchedule> | null = null;
    if (filled.length > 0) {
      // An outlay with an amount and no stage can't be placed in the schedule yet.
      const placed = outlays.every((o) => typeof o.stage === "string" && o.stage);
      if (placed) schedule = guard(acc, "outlays", () => cashSchedule(outlays));
    }
    acc.rows.outlays = outlayRows.map((_, i) => ({ cumulative: schedule?.rows.find((r) => r.index === i)?.cumulative ?? null }));

    // E. The funding gap, from the schedule's total (or blank) and what the business and the buyers put in.
    const advances = rowsOf(v, "advances").map((r, i) => num(r, "amount", acc, `Advance ${i + 1}`));
    const gap = guard(acc, "internal_cash", () => fundingGap({ totalOutlay: schedule?.totalOutlay ?? null, internalCash: num(v, "internal_cash", acc, "Your own cash"), buyerAdvances: advances }));
    const peak = schedule?.peak ?? null;
    Object.assign(acc.computed, {
      total_outlay: schedule?.totalOutlay ?? null,
      peak_cumulative: peak?.cumulative ?? null,
      peak_date: peak?.date ?? null,
      available_funds: gap?.availableFunds ?? null,
      gap: gap?.gap ?? null,
      funding_needed: gap?.fundingNeeded ?? null,
      peak_gap: peak && gap?.availableFunds !== null && gap?.availableFunds !== undefined ? Math.round((peak.cumulative - gap.availableFunds + Number.EPSILON) * 100) / 100 : null,
    });

    // Date checks and the critical-failure candidates the assessor confirms.
    const dates: BriefDates = { productionStart: text(v, "production_start"), deliveryDate: text(v, "delivery_date"), repaymentDate: text(v, "repayment_date"), paymentWindowEnd: text(v, "payment_window_end") };
    const checks = guard(acc, "delivery_date", () => briefDateChecks(dates));
    const messages: Record<string, string> = {
      delivery_before_production: "Delivery comes before production starts. Check the two dates.",
      repayment_after_payment_window: "You repay after the buyer's payment window has closed. The buyer's money would arrive too late to repay on time.",
    };
    const fieldIds: Record<string, string> = { productionStart: "production_start", deliveryDate: "delivery_date", repaymentDate: "repayment_date", paymentWindowEnd: "payment_window_end" };
    for (const issue of checks?.issues ?? []) flag(acc, issue.code, "warning", messages[issue.code] ?? issue.code, issue.fields.map((f) => fieldIds[f] ?? f));

    const liveOrder = ctx.liveOrder === true || text(v, "deal_basis") === "a_live_order";
    const failures = guard(acc, "payment_method", () =>
      criticalFailureCandidates({
        paymentMethod: text(v, "payment_method") === "open_account" ? "open_account" : text(v, "payment_method"),
        buyerVerified: yes(v, "buyer_verified"),
        outlayByStage: schedule ? schedule.byStage : null,
        dates,
        pathway: ctx.pathway,
        liveOrder,
        orderDocumentVerified: yes(v, "order_document_verified"),
      }),
    );
    const critical: Record<string, { message: string; fields: string[] }> = {
      open_account_unverified_buyer: { message: "You chose open account, and you haven't verified the buyer. That is a critical failure candidate: an assessor will confirm it.", fields: ["payment_method", "buyer_verified"] },
      raw_material_missing: { message: "The cash schedule has no sourcing outlay, so raw material is missing. That is a critical failure candidate.", fields: ["outlays"] },
      freight_missing: { message: "The cash schedule has no logistics outlay, so freight is missing. That is a critical failure candidate.", fields: ["outlays"] },
      repayment_after_payment_window: { message: "Repayment falls after the buyer's payment window. That is a critical failure candidate.", fields: ["repayment_date", "payment_window_end"] },
      no_verified_order: { message: "There is no verified purchase order, contract or pro-forma, and this is a live order. That is a critical failure candidate.", fields: ["order_document_verified"] },
    };
    for (const code of failures?.candidates ?? []) flag(acc, code, "critical_candidate", critical[code]?.message ?? code, critical[code]?.fields ?? []);
  },
  "m07-order-fulfilment-plan"(v, acc) {
    const orderQty = num(v, "order_quantity", acc) ?? 0;
    const machines = num(v, "machines", acc) ?? 1;
    const workHours = num(v, "working_hours_per_day", acc) ?? 8;
    const cycleTime = num(v, "cycle_time_minutes", acc) ?? 60;
    const scrapRate = num(v, "scrap_rate", acc) ?? 0;
    const committedHours = num(v, "committed_hours_per_day", acc) ?? 0;
    const allowOvertime = yes(v, "allow_overtime") ?? false;
    const overtimeHours = num(v, "overtime_hours_per_day", acc) ?? 0;
    const outsourcedUnits = num(v, "outsourced_units", acc) ?? 0;
    const daysAvailable = num(v, "days_available", acc);

    // 1. Capacity
    const cap = calculateNetCapacity({
      orderQuantity: orderQty,
      machines,
      workingHoursPerDay: workHours,
      cycleTimeMinutes: cycleTime,
      scrapRate,
      committedHoursPerDay: committedHours,
      allowOvertime,
      overtimeHoursPerDay: overtimeHours,
      daysAvailable,
      outsourcedUnits,
    });

    acc.computed.gross_hours_per_day = cap.grossHoursPerDay;
    acc.computed.net_hours_per_day = cap.netHoursPerDay;
    acc.computed.daily_output_units = cap.dailyOutputUnits;
    acc.computed.production_days_required = cap.daysRequired;

    if (cap.isOverCapacityWithoutMitigation) {
      flag(
        acc,
        "output_exceeds_net_capacity",
        "critical_candidate",
        "Order quantity exceeds available net capacity with no overtime or outsourcing scheduled. That is a critical failure candidate.",
        ["order_quantity", "machines", "days_available"],
      );
    }

    // 2. BOM
    const rawBomRows = rowsOf(v, "bom");
    const bomInputItems = rawBomRows.map((r, i) => ({
      id: `bom-${i + 1}`,
      item: typeof r.item === "string" ? r.item : `Item ${i + 1}`,
      unit: typeof r.unit === "string" ? r.unit : "units",
      baseQuantityPerUnit: typeof r.base_qty_per_unit === "number" ? r.base_qty_per_unit : 0,
      wastePercentage: typeof r.waste_percent === "number" ? r.waste_percent : 0,
      unitCost: typeof r.unit_cost === "number" ? r.unit_cost : 0,
    }));

    const bomResult = calculateBOM({
      orderQuantity: orderQty,
      items: bomInputItems,
    });

    acc.rows.bom = bomResult.lines.map((l) => ({
      required_qty: l.requiredQuantity,
      total_cost: l.totalCost,
    }));
    acc.computed.total_materials_cost = bomResult.totalMaterialsCost;

    const laborCost = num(v, "labor_cost", acc) ?? 0;
    const overheadCost = num(v, "overhead_cost", acc) ?? 0;
    acc.computed.total_production_cost = bomResult.totalMaterialsCost + laborCost + overheadCost;

    // 3. Backward Schedule
    const leadDays = num(v, "material_lead_days", acc) ?? 0;
    const transitDays = num(v, "transit_days_to_port", acc) ?? 0;
    const packagingDays = num(v, "packaging_days", acc) ?? 1;
    const inspectionDays = num(v, "inspection_days", acc) ?? 1;
    const hasQc = yes(v, "has_qc_before_dispatch") ?? false;
    const contractDeadline = text(v, "contract_deadline");
    const handoverDate = text(v, "handover_date");
    const m04CashDate = text(v, "m04_cash_milestone_date");

    const sched = calculateBackwardSchedule({
      contractDeadline,
      handoverDate,
      productionDays: cap.daysRequired,
      materialLeadDays: leadDays,
      transitDaysToPort: transitDays,
      packagingDays,
      inspectionDays,
      hasQualityCheckpointBeforeDispatch: hasQc,
      m04CashMilestoneDate: m04CashDate,
    });

    acc.computed.procurement_start_date = sched.milestones.procurementStartDate;
    acc.computed.procurement_due_date = sched.milestones.procurementDueDate;
    acc.computed.production_start_date = sched.milestones.productionStartDate;
    acc.computed.production_end_date = sched.milestones.productionEndDate;
    acc.computed.dispatch_date = sched.milestones.dispatchDate;

    for (const issue of sched.issues) {
      flag(
        acc,
        issue.code,
        issue.severity === "critical" ? "critical_candidate" : "warning",
        issue.message,
        issue.fields,
      );
    }
  },
};

/** Whether a field should be shown, from the values so far. */
export const isShown = (showWhen: { field: string; in: readonly string[] } | undefined, values: WorksheetValues): boolean => {
  if (!showWhen) return true;
  const v = values[showWhen.field];
  return typeof v === "string" && showWhen.in.includes(v);
};

function checkInputs(def: WorksheetDefinition, values: WorksheetValues, acc: Acc): void {
  const known = new Map<string, WorksheetDefinition["fields"][number]>(def.fields.map((f) => [f.id, f]));
  for (const key of Object.keys(values)) {
    if (!known.has(key) && !def.tables.some((t) => t.id === key)) acc.problems.push({ field: key, message: "This worksheet has no such field." });
  }
  for (const field of def.fields) {
    const v = values[field.id];
    if (isBlank(v) || !isShown(field.showWhen, values)) continue;
    const bad = (message: string) => acc.problems.push({ field: field.id, message });
    switch (field.kind) {
      case "money":
      case "number":
      case "percent":
        if (typeof v !== "number" || !Number.isFinite(v)) bad(`${field.label} must be a number.`);
        else if (field.id === "exchange_rate" && v <= 0) bad("The exchange rate must be above 0.");
        break;
      case "date":
        if (typeof v !== "string" || !isDate(v)) bad(`${field.label} must be a real date.`);
        break;
      case "checkbox":
        if (typeof v !== "boolean") bad(`${field.label} must be ticked or not.`);
        break;
      case "choice":
        if (typeof v !== "string" || !field.options?.some((o) => o.value === v)) bad(`Choose one of the options for ${field.label.toLowerCase()}.`);
        break;
      default:
        if (typeof v !== "string") bad(`${field.label} must be text.`);
    }
  }
  for (const table of def.tables) {
    const rows = values[table.id];
    if (isBlank(rows)) continue;
    if (!Array.isArray(rows)) {
      acc.problems.push({ field: table.id, message: `${table.label} must be a list of rows.` });
      continue;
    }
    if (table.maxRows !== undefined && rows.length > table.maxRows) acc.problems.push({ field: table.id, message: `${table.label} has room for ${table.maxRows} rows.` });
  }
}

/** The ETB equivalent of a money result, using the rate and date the learner entered. Null while the amount or the rate is missing. */
function etbOf(def: WorksheetDefinition, values: WorksheetValues, acc: Acc): Record<string, number | null> {
  const out: Record<string, number | null> = {};
  const currency = text(values, "currency") ?? "ETB";
  if (!def.money || currency === "ETB") return out;
  const rate = typeof values.exchange_rate === "number" ? values.exchange_rate : null;
  const day = text(values, "rate_date");
  for (const c of def.computed.filter((x) => x.etb)) {
    const amount = acc.computed[c.id];
    const result = guard(acc, "exchange_rate", () => etbEquivalent({ amount: typeof amount === "number" ? amount : null, currency }, rate !== null && day ? { rate, date: day } : null));
    out[c.id] = result?.amount ?? null;
  }
  return out;
}

/** Works out a worksheet from the values entered so far. */
export function computeWorksheet(id: string, values: WorksheetValues, context: WorksheetContext = {}): WorksheetResult {
  const def = findWorksheet(id);
  if (!def) throw new RangeError(`There is no worksheet ${id}.`);
  const acc: Acc = { computed: Object.fromEntries(def.computed.map((c) => [c.id, null])), rows: {}, flags: [], problems: [] };
  checkInputs(def, values, acc);
  COMPUTE[id]?.(values, acc, context);
  const etb = etbOf(def, values, acc);
  // The same refusal can come up twice (a field read for two results): say it once.
  const seen = new Set<string>();
  const problems = acc.problems.filter((p) => !seen.has(`${p.field}|${p.message}`) && seen.add(`${p.field}|${p.message}`));
  return { computed: acc.computed, rows: acc.rows, etb, flags: acc.flags, problems };
}

/** What a new draft of a worksheet starts with, from the latest submitted version of the worksheet it builds on. */
export function prefillFrom(targetId: string, source: { id: string; values: WorksheetValues; computed: WorksheetResult["computed"] }): Record<string, unknown> {
  const target = findWorksheet(targetId);
  if (!target || target.prefillFrom !== source.id) return {};
  const out: Record<string, unknown> = {};
  const copy = (id: string) => {
    if (!isBlank(source.values[id])) out[id] = source.values[id];
  };
  // M04's funding gap starts from the working-capital brief: the same currency and rate, the cash the SME puts in, and the buyer's advance.
  for (const id of ["currency", "exchange_rate", "rate_date", "internal_cash"]) copy(id);
  if (typeof source.values.buyer_advance === "number") out.advances = [{ amount: source.values.buyer_advance }];

  // M07's fulfilment plan prefills order identity and cash milestones from M04's transaction brief
  if (targetId === "m07-order-fulfilment-plan") {
    for (const id of ["currency", "exchange_rate", "rate_date", "contract_value", "incoterm"]) copy(id);
    if (!isBlank(source.values.buyer_name)) out.customer_name = source.values.buyer_name;
    if (!isBlank(source.values.product)) out.product = source.values.product;
    if (!isBlank(source.values.delivery_date)) {
      out.contract_deadline = source.values.delivery_date;
      out.handover_date = source.values.delivery_date;
    }
    if (!isBlank(source.values.payment_method)) out.financing_source = source.values.payment_method;
    if (!isBlank(source.values.repayment_date)) out.m04_cash_milestone_date = source.values.repayment_date;
  }
  return out;
}
