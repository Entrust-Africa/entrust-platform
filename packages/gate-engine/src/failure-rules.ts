import {
  FACTS,
  FAILURE_RULES,
  type FailureRuleDefinition,
  type FactKey,
  type FailureRuleId,
  type FlagSeverity,
  type StepDefinition,
  type StepId,
} from "@entrust/rules";
import { evaluateCondition } from "./conditions";
import { clockInputOf, parseEventTime, type CaseEvent, type ClockId, type DeadlineClock } from "./deadlines";
import { isDone } from "./evaluate";
import type { CaseEvaluation, CaseState, EvaluatedStep, RecordedStatus } from "./types";

// The checks behind the failure rules in packages/rules. Each looks at what the engine has worked
// out about a case (step statuses, evidence, the deadline clocks) and says in words why it fired.
// Pure, like evaluateCase.
//
// The checks must run on an evaluation made without the case's flags. A flag holds steps, and
// holding a step changes its status; a rule that reads that status would see its own flag switch
// the condition off, resolve the flag, and raise it again.

export interface FailureCheckInput {
  state: CaseState;
  /** Evaluated without the case's flags. */
  evaluation: CaseEvaluation;
  clocks: readonly DeadlineClock[];
  /** The case's history, which the deadline clocks and the date-based rules read. */
  events: readonly CaseEvent[];
}

/** A rule that fired: what to raise, what it holds, and why. */
export interface TriggeredFlag {
  rule: FailureRuleId;
  severity: FlagSeverity;
  message: string;
  raises: readonly StepId[];
  blocks: readonly StepId[];
}

type Finding = string | { message: string; blocks: readonly StepId[] } | undefined;

interface Context extends FailureCheckInput {
  definitions: readonly StepDefinition[];
  now: number;
  step(id: StepId): EvaluatedStep | undefined;
  /** What a person recorded for the step, whatever the engine made of it. */
  recorded(id: StepId): RecordedStatus | undefined;
  /** Complete (or not applicable), with its evidence approved and in date. */
  verified(id: StepId): boolean;
  /** Worked on or finished: in progress, waiting on someone, or completed. */
  started(id: StepId): boolean;
  clock(id: ClockId): DeadlineClock | undefined;
}

const DAY = 86_400_000;
const STARTED: readonly RecordedStatus[] = [
  "in_progress", "awaiting_sme", "awaiting_buyer", "awaiting_bank", "awaiting_authority", "completed",
];

const holds = (state: CaseState, fact: FactKey, values: readonly string[]) =>
  evaluateCondition({ fact, in: values }, state.facts) === true;

const list = (items: readonly string[]) => items.join(", ");

// FL-01: the destination admissibility steps.
const ADMISSIBILITY: readonly StepId[] = [
  "STEP-036", "STEP-037", "STEP-038", "STEP-039", "STEP-040", "STEP-041", "STEP-042",
];
// FL-13: the steps that show goods delivered and proceeds in.
const DELIVERY_AND_PAYMENT: readonly StepId[] = ["STEP-107", "STEP-117", "STEP-119", "STEP-121"];

const CHECKS: Partial<Record<FailureRuleId, (c: Context) => Finding>> = {
  "FL-01": (c) => {
    if (c.verified("STEP-010")) return;
    const started = ADMISSIBILITY.filter((id) => c.started(id));
    if (started.length) return `The HS code (STEP-010) is not verified, but ${list(started)} ${started.length === 1 ? "has" : "have"} started.`;
  },

  "FL-02": (c) => {
    const problems: string[] = [];
    if (holds(c.state, "paymentTerms", ["lc"]) && holds(c.state, "paymentTerms", ["cad"])) {
      problems.push("a letter of credit and cash against documents are both recorded as the payment instrument");
    }
    if (holds(c.state, "incoterm", ["FOB", "CFR", "CIF"]) && holds(c.state, "transportMode", ["air"])) {
      problems.push(`${String(c.state.facts.incoterm).toUpperCase()} is an Incoterm for sea transport, but the cargo goes by air`);
    }
    if (problems.length) return `The commercial terms conflict: ${problems.join("; ")}.`;
  },

  "FL-04": (c) => {
    if (!holds(c.state, "destinationCountry", ["US"])) return;
    const problems: string[] = [];
    if (c.recorded("STEP-104") === "completed" && !c.verified("STEP-038")) {
      problems.push("the cargo has departed without the FDA food facility registration (STEP-038) verified");
    }
    const notice = c.clock("prior_notice");
    if (notice?.state === "overdue") problems.push("the Prior Notice deadline has passed and it is not filed");
    if (notice?.state === "met_late") problems.push("the Prior Notice was filed after its deadline");
    if (problems.length) return `${problems.join("; ")}.`.replace(/^./, (ch) => ch.toUpperCase());
  },

  "FL-07": (c) => {
    const haulage = clockInputOf(c.events, "plannedHaulage");
    const equipment = c.step("STEP-075");
    if (haulage === undefined || equipment?.applicability !== "applicable" || c.verified("STEP-075")) return;
    const from = parseEventTime(haulage).getTime() - 7 * DAY;
    if (c.now >= from) return `Container equipment (STEP-075) is not confirmed, and the dry port haulage is planned for ${haulage}.`;
  },

  "FL-08": (c) => lateClock(c.clock("fx_repatriation"), "The proceeds", "repatriated"),

  "FL-09": (c) => {
    if (!c.started("STEP-078") && !c.started("STEP-104")) return;
    const missing: string[] = [];
    const needs = (id: StepId, what: string) => {
      if (c.step(id)?.applicability === "applicable" && !c.verified(id)) missing.push(what);
    };
    needs("STEP-015", "the exporter's bank account for FX (STEP-015)");
    needs("STEP-025", "the payment instrument (STEP-025)");
    needs("STEP-026", "the letter of credit terms (STEP-026)");
    needs("STEP-027", "the CAD agreement and collecting bank (STEP-027)");
    if (holds(c.state, "paymentTerms", ["lc"]) && clockInputOf(c.events, "lcExpiry") === undefined) {
      missing.push("the LC expiry date, which sets the presentation deadline");
    }
    if (missing.length) return `Dispatch has started, but these are not confirmed: ${list(missing)}.`;
  },

  "FL-12": (c) => lateClock(c.clock("lc_presentation"), "The documents", "presented to the bank"),

  "FL-13": (c) => {
    const short = DELIVERY_AND_PAYMENT.flatMap((id) => {
      const step = c.step(id);
      return step?.status === "completed" && step.missingEvidence.length ? [`${id} (${list(step.missingEvidence)})`] : [];
    });
    if (short.length) return `Delivery or payment evidence is no longer approved and in date: ${list(short)}.`;
  },

  "FL-14": (c) => {
    const missing: string[] = [];
    const phases = new Set<number>();
    for (const fact of FACTS) {
      const step = fact.determinedAt && c.definitions.find((d) => d.id === fact.determinedAt);
      if (!step || c.recorded(step.id) !== "completed") continue;
      // An empty list of wanted values never matches, so only an unrecorded fact gives undefined.
      if (evaluateCondition({ fact: fact.key, in: [] }, c.state.facts) !== undefined) continue;
      missing.push(`${fact.label} (${step.id})`);
      phases.add(step.phase);
    }
    if (!missing.length) return;
    // The sign-off of each phase that depends on a missing fact stays shut until it is recorded.
    const blocks = c.definitions.filter((d) => d.milestone && phases.has(d.phase)).map((d) => d.id);
    return { message: `A step that establishes a fact is complete, but the fact is not recorded: ${list(missing)}.`, blocks };
  },
};

/** A deadline missed, whether the thing is still undone or was done late. */
function lateClock(clock: DeadlineClock | undefined, subject: string, verb: string): Finding {
  if (!clock?.due) return;
  const due = "day" in clock.due ? clock.due.day : clock.due.at;
  if (clock.state === "overdue") return `${subject} were due by ${due} and have not been ${verb}.`;
  if (clock.state === "met_late") return `${subject} were ${verb} after the ${due} deadline.`;
}

/** The rules that have a check. The others are defined but dormant until the case holds their data. */
export const CHECKED_FAILURE_RULES = Object.keys(CHECKS) as FailureRuleId[];

/**
 * Run the failure rules on a case and return the ones that fire, in rule order. A rule without a
 * check (see `waitingOn` in its definition) never fires.
 */
export function checkFailureRules(
  definitions: readonly StepDefinition[],
  input: FailureCheckInput,
  options: { now: string; rules?: readonly FailureRuleDefinition[] },
): TriggeredFlag[] {
  const byId = new Map(input.evaluation.steps.map((s) => [s.id, s]));
  const clocks = new Map<string, DeadlineClock>(input.clocks.map((c) => [c.id, c]));
  const recorded = (id: StepId) => input.state.steps[id]?.status;
  const context: Context = {
    ...input,
    definitions,
    now: parseEventTime(options.now).getTime(),
    step: (id) => byId.get(id),
    recorded,
    verified: (id) => {
      const step = byId.get(id);
      return step !== undefined && isDone(step.status) && step.missingEvidence.length === 0;
    },
    started: (id) => {
      const status = recorded(id);
      return status !== undefined && STARTED.includes(status);
    },
    clock: (id) => clocks.get(id),
  };

  return (options.rules ?? FAILURE_RULES).flatMap((rule) => {
    const found = CHECKS[rule.id]?.(context);
    if (found === undefined) return [];
    const { message, blocks } = typeof found === "string" ? { message: found, blocks: rule.blocks } : found;
    return [{ rule: rule.id, severity: rule.severity, message, raises: rule.raises, blocks }];
  });
}

/** What a case's flags need after the rules have run. */
export interface FlagChanges<T> {
  /** Fired, with no active flag yet. */
  raise: TriggeredFlag[];
  /** Active, but the rule no longer fires: the situation has cleared. */
  resolve: T[];
  /** Active and still firing with different words (the missing items changed). */
  refresh: { flag: T; message: string }[];
}

/**
 * Compare the rules that fire with the flags a case already has. An open or waived flag is active;
 * a case has at most one active flag per rule. A waived flag stays waived while its rule keeps
 * firing, so waiving it is not undone on the next check; once the rule stops firing it resolves,
 * and if it fires again later it is a new flag.
 */
export function reconcileFlags<T extends { rule: string; status: string; message: string }>(
  triggered: readonly TriggeredFlag[],
  stored: readonly T[],
): FlagChanges<T> {
  const active = new Map(stored.filter((f) => f.status !== "resolved").map((f) => [f.rule, f]));
  const firing = new Map(triggered.map((t) => [t.rule as string, t]));
  return {
    raise: triggered.filter((t) => !active.has(t.rule)),
    resolve: [...active.values()].filter((f) => !firing.has(f.rule)),
    refresh: [...active.values()].flatMap((flag) => {
      const now = firing.get(flag.rule);
      return now && now.message !== flag.message ? [{ flag, message: now.message }] : [];
    }),
  };
}
