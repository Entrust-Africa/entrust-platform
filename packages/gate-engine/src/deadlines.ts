import {
  CFR_19_149_2,
  CFR_21_1_279,
  FXD_01_2024,
  UCP_600,
  type Deadline,
  type SourceRef,
  type StepDefinition,
  type StepId,
} from "@entrust/rules";
import { evaluateCondition } from "./conditions";
import type { CaseState } from "./types";

// The time limits that run on a case, worked out from its events. Pure, like evaluateCase: the same
// definitions, events and time always give the same result. The worker (#16) calls dueReminders on
// a schedule and sends each reminder once, by its key.
//
// Rules counted in days use calendar days in Ethiopia (UTC+3, no daylight saving), because the
// banks and the NBE count that way: a late-evening UTC timestamp can already be tomorrow there.
// Rules counted in hours use the exact moment. Days count from the day after the start, so a
// 30-day permit issued on 1 October is valid through 31 October, as for evidence validity.

/**
 * What the clocks read from a case's history (the `case_event` rows). Other events are ignored.
 * Events are in the order they were recorded, and the latest event for a step or key wins.
 *
 * - step_completed: `stepId` is done. `occurredAt` is when the thing happened, not when it was
 *   recorded: the permit's issue date, the bill of lading's on-board date.
 * - clock_input_set: `data` is { key, value } for one of CLOCK_INPUT_KEYS. A date is an ISO date
 *   or a timestamp with an offset (2026-11-10T09:00:00+03:00); the filing system is "ace" or "pnsi".
 */
export const STEP_COMPLETED = "step_completed";
export const CLOCK_INPUT_SET = "clock_input_set";
export const CLOCK_INPUT_KEYS = ["plannedLoading", "estimatedArrival", "lcExpiry", "priorNoticeSystem"] as const;
export type ClockInputKey = (typeof CLOCK_INPUT_KEYS)[number];

export interface CaseEvent {
  type: string;
  stepId?: StepId | null;
  /** An ISO date, or an ISO timestamp with an offset. */
  occurredAt: string;
  data?: unknown;
}

export interface DeadlineInput {
  facts: CaseState["facts"];
  /** A step marked not applicable, with a reason, has no clock. */
  steps?: CaseState["steps"];
  events: readonly CaseEvent[];
}

export type ClockId = "permit_validity" | "fx_repatriation" | "lc_presentation" | "isf_filing" | "prior_notice";

/** The last day (counted in days) or the last moment (counted in hours) the obligation can be met. */
export type DueDate = { day: string } | { at: string };

/**
 * - not_applicable: the step does not apply to this case
 * - undetermined: a fact the step depends on is not known yet
 * - waiting: the date the clock runs from has not been recorded
 * - running: counting down
 * - overdue: past the deadline and not done
 * - met: done in time
 * - met_late: done after the deadline
 */
export type ClockState = "not_applicable" | "undetermined" | "waiting" | "running" | "overdue" | "met" | "met_late";

export interface ClockAlert {
  /** Stable for a rule, such as "warn-15d" or "overdue". */
  key: string;
  kind: "warning" | "overdue";
  /** ISO timestamp the alert becomes due. */
  at: string;
}

export interface DeadlineClock {
  id: ClockId;
  label: string;
  /** The step the clock belongs to. */
  stepId: StepId;
  state: ClockState;
  /** ISO timestamp the clock runs from. Null while waiting. */
  startedAt: string | null;
  due: DueDate | null;
  /** ISO timestamp before which the obligation cannot be met yet, for rules that have one. */
  opensAt: string | null;
  /** ISO timestamp the obligation was met. */
  closedAt: string | null;
  /** In time order. Empty until the clock has a due date. */
  alerts: ClockAlert[];
  /** Assumptions made where the case does not say enough yet. */
  notes: string[];
  /** The clause that sets the time limit, within the source. */
  clause: string;
  source: SourceRef;
}

export interface Reminder {
  /** Stable across runs, and changes when the due date does: send each key once. */
  key: string;
  clock: ClockId;
  stepId: StepId;
  kind: ClockAlert["kind"];
  /** ISO timestamp the reminder became due. */
  at: string;
  due: DueDate;
  message: string;
}

// ---- Time ----

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const EAT_OFFSET = 3 * HOUR;
const ISO_TIME = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2}))?$/;

const iso = (ms: number) => new Date(ms).toISOString();
const dayOf = (ms: number) => new Date(ms + EAT_OFFSET).toISOString().slice(0, 10);
const startOfDay = (day: string) => Date.parse(`${day}T00:00:00+03:00`);
const addDays = (day: string, days: number) => dayOf(startOfDay(day) + days * DAY);

function toMs(value: string): number {
  const date = value.slice(0, 10);
  // The round trip catches dates that don't exist, such as 2026-02-30.
  if (!ISO_TIME.test(value) || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) {
    throw new RangeError(`Not an ISO date or a timestamp with an offset: ${value}`);
  }
  const ms = Date.parse(value.length === 10 ? `${value}T00:00:00+03:00` : value);
  if (Number.isNaN(ms)) throw new RangeError(`Not an ISO date or a timestamp with an offset: ${value}`);
  return ms;
}

/** The last millisecond the obligation can be met in. */
const lastMoment = (due: DueDate) => ("day" in due ? startOfDay(addDays(due.day, 1)) - 1 : toMs(due.at));
const describe = (due: DueDate) => ("day" in due ? due.day : due.at);

// ---- Reading events ----

function completedAt(events: readonly CaseEvent[], stepId: StepId): string | undefined {
  return events.findLast((e) => e.type === STEP_COMPLETED && e.stepId === stepId)?.occurredAt;
}

function inputOf(events: readonly CaseEvent[], key: ClockInputKey): string | undefined {
  for (const event of events.toReversed()) {
    const data: unknown = event.data;
    if (event.type !== CLOCK_INPUT_SET || typeof data !== "object" || data === null) continue;
    if ("key" in data && "value" in data && data.key === key && typeof data.value === "string") return data.value;
  }
  return undefined;
}

/**
 * The moment an event's date or timestamp stands for; a plain date is the start of that day in
 * Ethiopia. Throws a RangeError unless it is an ISO date or a timestamp with an offset.
 */
export const parseEventTime = (value: string): Date => new Date(toMs(value));

/**
 * Check a value for one of CLOCK_INPUT_KEYS before it is recorded, and return it as the clocks read
 * it: a date as given, the filing system in lower case. Throws a RangeError if it is not valid.
 */
export function checkClockInput(key: ClockInputKey, value: string): string {
  if (key === "priorNoticeSystem") {
    const system = value.trim().toLowerCase();
    if (system !== "ace" && system !== "pnsi") throw new RangeError(`The filing system is "ace" or "pnsi", not "${value}".`);
    return system;
  }
  toMs(value);
  return value;
}

// ---- The rules ----

export interface ClockSchedule {
  /** Epoch ms the clock runs from. */
  startedAt: number;
  due: DueDate;
  opensAt: number | null;
  notes: string[];
}

export interface ClockRule {
  id: ClockId;
  label: string;
  /** Its applicability (appliesWhen) decides whether the clock runs. */
  stepId: StepId;
  /** Completing this step meets the obligation. */
  closedBy: StepId;
  /** The anchor and offset of the step's `deadline` in the canonical data. A test keeps them equal. */
  starts: Deadline["starts"];
  due: Deadline["due"];
  /**
   * Warnings before the due date: days before the last day for a rule counted in days, hours
   * before the deadline for one counted in hours. A reminder is sent once the lead time is reached.
   */
  warnLeads: readonly number[];
  clause: string;
  source: SourceRef;
  /** Adjusts the schedule for what the case says beyond the start date. */
  refine?: (schedule: ClockSchedule, context: Pick<DeadlineInput, "facts" | "events">) => ClockSchedule;
}

// UCP 600 Art. 14(c): within 21 days of shipment and not after the credit expires (Art. 6(d)(i)).
// The earlier of the two is the deadline.
function byLcExpiry(schedule: ClockSchedule, { events }: Pick<DeadlineInput, "events">): ClockSchedule {
  const expiry = inputOf(events, "lcExpiry");
  if (expiry === undefined) {
    return { ...schedule, notes: [...schedule.notes, "The LC expiry date is not recorded. The deadline moves earlier if the credit expires before the 21 days end."] };
  }
  const expiryDay = dayOf(toMs(expiry));
  if (!("day" in schedule.due) || expiryDay >= schedule.due.day) return schedule;
  return {
    ...schedule,
    due: { day: expiryDay },
    notes: [...schedule.notes, `The credit expires on ${expiryDay}, before the 21 days end on ${schedule.due.day}.`],
  };
}

// 21 CFR 1.279: no less than 8 hours before arrival by water (a)(4), 4 hours by air (a)(3), and
// no more than 30 calendar days before arrival through ABI/ACE (b)(1) or 15 through PNSI (b)(2).
// Where the case doesn't say, take the stricter reading: the 8 hours, and the 15-day window that is
// open under either system.
function byModeAndSystem(schedule: ClockSchedule, { facts, events }: Pick<DeadlineInput, "facts" | "events">): ClockSchedule {
  const notes = [...schedule.notes];
  const byAir = evaluateCondition({ fact: "transportMode", in: ["air"] }, facts);
  if (byAir === undefined) notes.push("The transport mode is not recorded, so the 8 hours that apply by sea are used (4 hours by air).");

  const system = inputOf(events, "priorNoticeSystem")?.trim().toLowerCase();
  if (system !== "ace" && system !== "pnsi") {
    notes.push("The filing system is not recorded, so Prior Notice is treated as opening 15 days before arrival (30 through ABI/ACE).");
  }
  return {
    ...schedule,
    due: byAir ? { at: iso(schedule.startedAt - 4 * HOUR) } : schedule.due,
    opensAt: schedule.startedAt - (system === "ace" ? 30 : 15) * DAY,
    notes,
  };
}

// Warning lead times are ours (Entrust to confirm), except the FX repatriation alerts at day 60 and
// day 75, which the issue sets.
export const DEADLINE_CLOCKS: readonly ClockRule[] = [
  {
    id: "permit_validity",
    label: "Export permit validity",
    stepId: "STEP-080",
    closedBy: "STEP-080",
    starts: { afterStep: "STEP-048" },
    due: { days: 30 },
    warnLeads: [7],
    clause: "Art. 7.1.6",
    source: FXD_01_2024,
  },
  {
    // Annex One 1.3.7(d) covers every payment mode (1.3.2(a) repeats it for CAD). Flowers are
    // excepted and NBE may extend for good cause (1.11(a)); neither is modelled.
    id: "fx_repatriation",
    label: "FX proceeds repatriation",
    stepId: "STEP-120",
    closedBy: "STEP-117",
    starts: { afterStep: "STEP-048" },
    due: { days: 90 },
    warnLeads: [30, 15], // day 60 and day 75 of the 90
    clause: "Annex One 1.3.7(d)",
    source: FXD_01_2024,
  },
  {
    id: "lc_presentation",
    label: "LC document presentation",
    stepId: "STEP-112",
    closedBy: "STEP-110",
    starts: { afterStep: "STEP-104" },
    due: { days: 21 },
    warnLeads: [7],
    clause: "Art. 14(c)",
    source: UCP_600,
    refine: byLcExpiry,
  },
  {
    // (b)(1) and (b)(2) are the importer elements, due before lading. The container stuffing
    // location and consolidator are due 24 hours before arrival instead, (b)(3); not modelled.
    id: "isf_filing",
    label: "ISF filing",
    stepId: "STEP-097",
    closedBy: "STEP-097",
    starts: { caseDate: "plannedLoading" },
    due: { hours: -24 },
    warnLeads: [24],
    clause: "§ 149.2(b)(1)-(2)",
    source: CFR_19_149_2,
  },
  {
    id: "prior_notice",
    label: "FDA Prior Notice",
    stepId: "STEP-095",
    closedBy: "STEP-095",
    starts: { caseDate: "estimatedArrival" },
    due: { hours: -8 }, // by sea; byModeAndSystem shortens it to 4 for air
    warnLeads: [24],
    clause: "§ 1.279(a)(3)-(4), (b)",
    source: CFR_21_1_279,
    refine: byModeAndSystem,
  },
];

/**
 * Steps whose completion date starts a clock (the permit's issue date, the shipment date). They
 * must be completed with the date the thing happened: the day it is recorded would start the clock
 * late.
 */
export const CLOCK_ANCHOR_STEPS: readonly StepId[] = [
  ...new Set(DEADLINE_CLOCKS.flatMap((r) => ("afterStep" in r.starts ? [r.starts.afterStep] : []))),
];

function scheduleOf(rule: ClockRule, context: Pick<DeadlineInput, "facts" | "events">): ClockSchedule | undefined {
  const started =
    "afterStep" in rule.starts
      ? completedAt(context.events, rule.starts.afterStep)
      : inputOf(context.events, rule.starts.caseDate);
  if (started === undefined) return undefined;
  const startedAt = toMs(started);
  const due: DueDate =
    "days" in rule.due
      ? { day: addDays(dayOf(startedAt), rule.due.days) }
      : { at: iso(startedAt + rule.due.hours * HOUR) };
  const schedule: ClockSchedule = { startedAt, due, opensAt: null, notes: [] };
  return rule.refine ? rule.refine(schedule, context) : schedule;
}

function alertsOf(rule: ClockRule, due: DueDate): ClockAlert[] {
  const warnings = rule.warnLeads.map((lead): ClockAlert => ({
    key: `warn-${lead}${"day" in due ? "d" : "h"}`,
    kind: "warning",
    at: iso("day" in due ? startOfDay(addDays(due.day, -lead)) : toMs(due.at) - lead * HOUR),
  }));
  const overdue: ClockAlert = { key: "overdue", kind: "overdue", at: iso(lastMoment(due) + 1) };
  return [...warnings, overdue].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
}

function applicabilityOf(step: StepDefinition, input: DeadlineInput): "applicable" | "not_applicable" | "undetermined" {
  const recorded = input.steps?.[step.id];
  if (recorded?.status === "not_applicable" && recorded.reason?.trim()) return "not_applicable";
  if (!step.appliesWhen) return "applicable";
  const holds = evaluateCondition(step.appliesWhen.condition, input.facts);
  if (holds === undefined) return "undetermined";
  return holds ? "applicable" : "not_applicable";
}

/**
 * Every clock that could run on the case, with its state at `now`. A clock whose step is not in
 * `definitions` is left out.
 */
export function evaluateDeadlines(
  definitions: readonly StepDefinition[],
  input: DeadlineInput,
  options: { now: string },
): DeadlineClock[] {
  const now = toMs(options.now);
  const byId = new Map(definitions.map((d) => [d.id, d]));

  return DEADLINE_CLOCKS.flatMap((rule) => {
    const step = byId.get(rule.stepId);
    if (!step) return [];
    const clock = (state: ClockState, rest: Partial<DeadlineClock> = {}): DeadlineClock => ({
      id: rule.id,
      label: rule.label,
      stepId: rule.stepId,
      state,
      startedAt: null,
      due: null,
      opensAt: null,
      closedAt: null,
      alerts: [],
      notes: [],
      clause: rule.clause,
      source: rule.source,
      ...rest,
    });

    const applicability = applicabilityOf(step, input);
    if (applicability !== "applicable") return [clock(applicability)];
    const schedule = scheduleOf(rule, input);
    if (!schedule) return [clock("waiting")];

    const dueAt = lastMoment(schedule.due);
    const closed = completedAt(input.events, rule.closedBy);
    const closedAt = closed === undefined ? undefined : toMs(closed);
    let state: ClockState;
    if (closedAt !== undefined) state = closedAt <= dueAt ? "met" : "met_late";
    else state = now > dueAt ? "overdue" : "running";

    return [
      clock(state, {
        startedAt: iso(schedule.startedAt),
        due: schedule.due,
        opensAt: schedule.opensAt === null ? null : iso(schedule.opensAt),
        closedAt: closedAt === undefined ? null : iso(closedAt),
        alerts: alertsOf(rule, schedule.due),
        notes: schedule.notes,
      }),
    ];
  });
}

/**
 * The reminders due at `now`: for each clock still open, the latest alert whose time has come. A
 * case recorded late, or a worker that was down, therefore gets one reminder per clock, not every
 * alert it missed. Clocks that are met, waiting or not applicable give none.
 */
export function dueReminders(
  definitions: readonly StepDefinition[],
  input: DeadlineInput,
  options: { now: string },
): Reminder[] {
  const now = toMs(options.now);
  return evaluateDeadlines(definitions, input, options).flatMap((clock) => {
    if ((clock.state !== "running" && clock.state !== "overdue") || !clock.due) return [];
    const latest = clock.alerts.filter((a) => Date.parse(a.at) <= now).at(-1);
    if (!latest) return [];
    const when = describe(clock.due);
    return [
      {
        key: `${clock.id}:${latest.key}:${when}`,
        clock: clock.id,
        stepId: clock.stepId,
        kind: latest.kind,
        at: latest.at,
        due: clock.due,
        message:
          latest.kind === "overdue"
            ? `${clock.label} was due ${when} and is not done.`
            : `${clock.label} is due ${when}.`,
      },
    ];
  });
}

// ---- CAD cap ----

/** Annex One 1.3.2(c): the most that can be paid by cash against documents under a single permit. */
export const CAD_CAP_USD = 500_000;

export interface CadCapCheck {
  withinCap: boolean;
  capUsd: number;
  excessUsd: number;
  message: string;
  clause: string;
  source: SourceRef;
}

/**
 * Check, at case creation, the part of the permit value to be paid by cash against documents.
 * Over the cap is not forbidden: NBE approves a larger amount case by case (1.3.2(e)), so the case
 * needs that approval before the permit. Only the CAD part counts, not an advance paid by TT.
 */
export function checkCadCap(cadAmountUsd: number): CadCapCheck {
  if (!Number.isFinite(cadAmountUsd) || cadAmountUsd < 0) {
    throw new RangeError(`Not an amount in USD: ${cadAmountUsd}`);
  }
  const excessUsd = Math.round(Math.max(0, cadAmountUsd - CAD_CAP_USD) * 100) / 100;
  const usd = (n: number) => `USD ${n.toLocaleString("en-US")}`;
  return {
    withinCap: excessUsd === 0,
    capUsd: CAD_CAP_USD,
    excessUsd,
    message:
      excessUsd === 0
        ? `${usd(cadAmountUsd)} by CAD is within the ${usd(CAD_CAP_USD)} cap for one permit.`
        : `${usd(cadAmountUsd)} by CAD is ${usd(excessUsd)} over the ${usd(CAD_CAP_USD)} cap for one permit. NBE must approve it case by case.`,
    clause: "Annex One 1.3.2(c), (e)",
    source: FXD_01_2024,
  };
}
