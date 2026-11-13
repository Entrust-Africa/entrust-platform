import {
  evaluateCase,
  evaluateDeadlines,
  isDone,
  type CaseEvaluation,
  type DeadlineClock,
  type EvaluatedStep,
} from "@entrust/gate-engine";
import { EVIDENCE_TYPES, STEPS, type PhaseId, type StepDefinition, type StepId } from "@entrust/rules";
import type { Answers, Ask, FiledEvidence, LogEntry, Next, Run, Scenario, StoryStep, Told } from "./types";

// A run of the simulator. Nothing here decides what applies or what is waiting: every move is put
// to CLEAR's GATE engine first, with the same step definitions a real case uses. The scenario only
// says what happens at each step and what the user is asked.

const definitions = new Map<StepId, StepDefinition>(STEPS.map((s) => [s.id, s]));
const validity = new Map(EVIDENCE_TYPES.map((e) => [e.id, e.validity?.days]));

// ---- Simulated time ----

const DAY = 86_400_000;
const EAT = 3 * 3_600_000;

/** Milliseconds of an ISO date (taken as the start of that day in Addis Ababa) or a timestamp. */
export const toMs = (at: string) => Date.parse(at.length === 10 ? `${at}T00:00:00+03:00` : at);

/** The day in Addis Ababa, as an ISO date. */
export const dayOf = (at: string) => (at.length === 10 ? at : new Date(toMs(at) + EAT).toISOString().slice(0, 10));

const addDays = (day: string, days: number) => new Date(toMs(day) + EAT + days * DAY).toISOString().slice(0, 10);

/** The later of two moments. The simulated clock never runs backwards. */
const later = (a: string, b: string) => (toMs(b) > toMs(a) ? b : a);

export const tell = (told: Told, answers: Answers) => (typeof told === "function" ? told(answers) : told);

// ---- Reading a scenario ----

export const storyOf = (scenario: Scenario, stepId: string): StoryStep | undefined => scenario.story.find((s) => s.id === stepId);

export const askOf = (scenario: Scenario, stepId: string): Ask | undefined => scenario.asks.find((a) => a.stepId === stepId);

export const askById = (scenario: Scenario, askId: string): Ask | undefined => scenario.asks.find((a) => a.id === askId);

// ---- Evaluating ----

export function evaluateRun(run: Run): CaseEvaluation {
  return evaluateCase(
    STEPS,
    { facts: run.facts, steps: run.steps, evidence: run.evidence, raisedExceptions: [] },
    { asOf: dayOf(run.clock) },
  );
}

export function deadlinesOf(run: Run): DeadlineClock[] {
  return evaluateDeadlines(STEPS, { facts: run.facts, steps: run.steps, events: run.events }, { now: run.clock });
}

const applies = (s: EvaluatedStep) => s.applicability !== "not_applicable";

/** Steps done of the steps that apply, in one phase or (without `phase`) the whole case. */
export function progress(evaluation: CaseEvaluation, phase?: number) {
  const steps = evaluation.steps.filter((s) => applies(s) && (phase === undefined || s.phase === phase));
  return { done: steps.filter((s) => isDone(s.status)).length, total: steps.length };
}

/** The first phase whose gate is not signed off yet. */
export function currentPhase(evaluation: CaseEvaluation): PhaseId {
  return evaluation.phases.find((p) => p.status !== "locked")?.phase ?? 7;
}

/** Every step that cannot finish until this one does, directly or through other steps. */
export function holds(evaluation: CaseEvaluation, stepId: StepId): StepId[] {
  const held = new Set<StepId>();
  // The engine lists what each unfinished step waits on, so the search runs over its answer.
  let grew = true;
  while (grew) {
    grew = false;
    for (const s of evaluation.steps) {
      if (held.has(s.id) || s.id === stepId || isDone(s.status)) continue;
      if (s.blockedBy.some((id) => id === stepId || held.has(id))) {
        held.add(s.id);
        grew = true;
      }
    }
  }
  return evaluation.steps.filter((s) => held.has(s.id)).map((s) => s.id);
}

// ---- Moves ----

function entry(run: Run, values: Omit<LogEntry, "n">): LogEntry {
  return { n: run.log.length + 1, ...values };
}

const append = (run: Run, values: Omit<LogEntry, "n">): Run => ({ ...run, log: [...run.log, entry(run, values)] });

const ruledOut = (evaluation: CaseEvaluation) => evaluation.steps.filter((s) => s.status === "not_applicable");

/** "Applies only if: The cargo ships by sea in containers. That is not the case." without the wrapper. */
const condition = (reason: string | null) =>
  (reason ?? "")
    .replace(/^Applies only if: /, "")
    .replace(/ That is not the case\.$/, "")
    .replace(/\.$/, "");

export function startRun(scenario: Scenario): Run {
  const run: Run = {
    facts: { ...scenario.facts },
    steps: {},
    completedAt: {},
    evidence: [],
    events: [],
    asked: [],
    answers: {},
    refused: {},
    settled: [],
    clock: scenario.opened,
    log: [],
  };
  const out = ruledOut(evaluateRun(run));
  const exceptions = out.filter((s) => s.definition.class === "exception").length;
  return append(run, {
    kind: "opened",
    at: scenario.opened,
    phase: null,
    stepId: null,
    actor: "CLEAR",
    title: `Case opened for order ${scenario.order.number}`,
    detail:
      `${STEPS.length - out.length} of CLEAR's ${STEPS.length} steps can apply to this order. ${out.length} are ruled out from the start: ` +
      `${exceptions} exception steps that are only raised when something goes wrong, and ${out.length - exceptions} that the product and destination rule out.`,
  });
}

/** What the run does next: a step, a question, a wait for answers, or nothing more. */
export function nextMove(scenario: Scenario, run: Run, evaluation: CaseEvaluation = evaluateRun(run)): Next {
  const evaluated = new Map(evaluation.steps.map((s) => [s.id, s]));
  for (const story of scenario.story) {
    const step = evaluated.get(story.id);
    // A step whose facts are not known yet is left until the step that establishes them has run.
    if (!step || isDone(step.status) || step.applicability !== "applicable") continue;
    if (step.blockedBy.length || step.heldBy.length) continue;
    const ask = askOf(scenario, story.id);
    if (ask && !run.answers[ask.id]) {
      if (!run.asked.includes(ask.id)) return { kind: "ask", askId: ask.id, stepId: story.id };
      continue;
    }
    return { kind: "step", stepId: story.id };
  }
  const open = run.asked.filter((id) => !run.answers[id]);
  return open.length ? { kind: "waiting", askIds: open } : { kind: "finished" };
}

function raise(scenario: Scenario, run: Run, ask: Ask): Run {
  const story = storyOf(scenario, ask.stepId);
  const clock = story ? later(run.clock, story.at) : run.clock;
  const definition = definitions.get(ask.stepId);
  return append(
    { ...run, clock, asked: [...run.asked, ask.id], steps: { ...run.steps, [ask.stepId]: { status: "awaiting_sme" } } },
    {
      kind: "ask",
      at: clock,
      phase: definition?.phase ?? null,
      stepId: ask.stepId,
      actor: "CLEAR",
      title: `Stopped to ask: ${ask.title}`,
      detail: ask.context,
    },
  );
}

function complete(scenario: Scenario, run: Run, stepId: StepId): Run {
  const story = storyOf(scenario, stepId);
  const definition = definitions.get(stepId);
  if (!story || !definition) throw new Error(`${stepId} has no story in the scenario.`);

  const before = ruledOut(evaluateRun(run)).map((s) => s.id);
  const clock = later(run.clock, story.at);
  const day = dayOf(clock);
  const facts = { ...run.facts, ...story.sets };
  const inputs = Object.entries(story.clockInputs ?? {}).map(([key, value]) => ({
    type: "clock_input_set" as const,
    occurredAt: clock,
    data: { key, value },
  }));

  // What the engine still wants on file for this step, now that its facts are in.
  const wanted = evaluateCase(
    STEPS,
    { facts, steps: run.steps, evidence: run.evidence, raisedExceptions: [] },
    { asOf: day },
  ).steps.find((s) => s.id === stepId);
  if (!wanted || wanted.blockedBy.length || wanted.applicability !== "applicable") {
    throw new Error(`${stepId} is not ready: ${wanted?.reason ?? "the engine does not know it"}`);
  }
  const filed: FiledEvidence[] = wanted.evidence
    .filter((e) => !e.satisfied)
    .map((e) => {
      const days = validity.get(e.type);
      return {
        type: e.type,
        status: "approved",
        issuedOn: day,
        validUntil: days ? addDays(day, days) : null,
        stepId,
        reference: story.references?.[e.type] ?? null,
      };
    });

  let done: Run = {
    ...run,
    clock,
    facts,
    evidence: [...run.evidence, ...filed],
    steps: { ...run.steps, [stepId]: { status: "completed" } },
    completedAt: { ...run.completedAt, [stepId]: clock },
    events: [...run.events, ...inputs, { type: "step_completed", stepId, occurredAt: clock }],
    settled: [...run.settled, ...(story.settles ?? [])],
  };

  done = append(done, {
    kind: definition.milestone ? "gate" : "step",
    at: clock,
    phase: definition.phase,
    stepId,
    actor: story.actor,
    title: definition.name,
    detail: tell(story.summary, done.answers),
  });

  for (const id of story.settles ?? []) {
    const item = scenario.openItems.find((i) => i.id === id);
    if (!item?.settled) continue;
    done = append(done, {
      kind: "settled",
      at: clock,
      phase: definition.phase,
      stepId,
      actor: story.actor,
      title: `Open item settled: ${item.label}`,
      detail: item.settled,
    });
  }

  // Steps the new facts rule out, grouped by the condition that failed.
  const after = evaluateRun(done);
  const fresh = ruledOut(after).filter((s) => !before.includes(s.id));
  const byReason = new Map<string, StepId[]>();
  for (const s of fresh) byReason.set(condition(s.reason), [...(byReason.get(condition(s.reason)) ?? []), s.id]);
  for (const [reason, ids] of byReason) {
    done = append(done, {
      kind: "ruled_out",
      at: clock,
      phase: definition.phase,
      stepId,
      actor: "CLEAR",
      title: ids.length === 1 ? "1 step ruled out" : `${ids.length} steps ruled out`,
      detail: `${ids.join(", ")} would apply only if: ${reason.charAt(0).toLowerCase()}${reason.slice(1)}.`,
    });
  }

  if (after.steps.every((s) => isDone(s.status))) {
    done = append(done, {
      kind: "closed",
      at: clock,
      phase: 7,
      stepId: null,
      actor: "CLEAR",
      title: "Case closed",
      detail: `Every step that applies is done and all seven phases are signed off. ${ruledOut(after).length} steps did not apply to this order.`,
    });
  }
  return done;
}

/** Make the next move. The run comes back unchanged when it is waiting for an answer or finished. */
export function advance(scenario: Scenario, run: Run): { run: Run; move: Next } {
  const move = nextMove(scenario, run);
  if (move.kind === "step") return { run: complete(scenario, run, move.stepId), move };
  if (move.kind === "ask") {
    const ask = askById(scenario, move.askId);
    return { run: ask ? raise(scenario, run, ask) : run, move };
  }
  return { run, move };
}

/**
 * Answer a question CLEAR has asked. An answer that is not accepted is logged with the reason and
 * the question stays open; an accepted one completes the step.
 */
export function answer(scenario: Scenario, run: Run, askId: string, optionId: string): Run {
  const ask = askById(scenario, askId);
  const option = ask?.options.find((o) => o.id === optionId);
  if (!ask || !option || !run.asked.includes(askId) || run.answers[askId]) return run;
  const definition = definitions.get(ask.stepId);
  const base = { at: run.clock, phase: definition?.phase ?? null, stepId: ask.stepId, actor: ask.from };

  if (!option.accepted) {
    const tried = run.refused[askId] ?? [];
    return append(
      { ...run, refused: { ...run.refused, [askId]: tried.includes(optionId) ? tried : [...tried, optionId] } },
      { ...base, kind: "rejected", title: `Not accepted: ${option.label}`, detail: option.response },
    );
  }
  const answered = append(
    { ...run, answers: { ...run.answers, [askId]: optionId } },
    { ...base, kind: "answer", title: `Answered: ${option.label}`, detail: option.response },
  );
  return complete(scenario, answered, ask.stepId);
}

/** Play the whole scenario, giving each question its first accepted answer unless told otherwise. */
export function playThrough(scenario: Scenario, choose: Answers = {}): Run {
  let run = startRun(scenario);
  // Every step is one move and every question two, so this bound is never reached by a sound scenario.
  for (let i = 0; i < STEPS.length * 3; i++) {
    const { run: moved, move } = advance(scenario, run);
    run = moved;
    if (move.kind === "finished") break;
    if (move.kind === "ask" || move.kind === "waiting") {
      const askId = move.kind === "ask" ? move.askId : move.askIds[0];
      const ask = askId ? askById(scenario, askId) : undefined;
      const option = ask?.options.find((o) => (choose[ask.id] ? o.id === choose[ask.id] : o.accepted));
      if (!ask || !option) break;
      run = answer(scenario, run, ask.id, option.id);
    }
  }
  return run;
}
