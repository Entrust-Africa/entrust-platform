import { isDone } from "@entrust/gate-engine";
import { STEPS } from "@entrust/rules";
import { describe, expect, it } from "vitest";
import { advance, answer, deadlinesOf, evaluateRun, holds, nextMove, playThrough, progress, startRun, tell, toMs } from "../src/lib/simulation/run";
import { HANDOVER, HS_CODE, SCENARIO } from "../src/lib/simulation/scenario";
import type { Run } from "../src/lib/simulation/types";

// The simulator's story is only worth showing if CLEAR's own engine agrees with it at every step.

const statusOf = (run: Run, id: string) => evaluateRun(run).steps.find((s) => s.id === id)?.status;

/** Advance until the run stops for a question, has to wait, or finishes. */
function playUntilStop(run: Run) {
  for (let i = 0; i < 400; i++) {
    const moved = advance(SCENARIO, run);
    run = moved.run;
    if (moved.move.kind !== "step") return { run, move: moved.move };
  }
  throw new Error("The run never stopped.");
}

describe("the full run", () => {
  const run = playThrough(SCENARIO);
  const evaluation = evaluateRun(run);

  it("finishes every step that applies and signs off all seven phases", () => {
    expect(evaluation.steps.filter((s) => !isDone(s.status)).map((s) => s.id)).toEqual([]);
    expect(evaluation.phases.map((p) => p.status)).toEqual(Array(7).fill("locked"));
    expect(nextMove(SCENARIO, run)).toEqual({ kind: "finished" });
    expect(run.log.at(-1)?.kind).toBe("closed");
  });

  it("has a story for exactly the steps that apply", () => {
    const applying = evaluation.steps.filter((s) => s.status === "completed").map((s) => s.id);
    expect([...applying].sort()).toEqual(SCENARIO.story.map((s) => s.id).sort());
    expect(applying).toHaveLength(99);
    expect(STEPS.length - applying.length).toBe(26);
    expect(progress(evaluation)).toEqual({ done: 99, total: 99 });
  });

  it("plays the story in its written order, so each step was ready when its turn came", () => {
    const played = run.log.filter((e) => e.kind === "step" || e.kind === "gate").map((e) => e.stepId);
    expect(played).toEqual(SCENARIO.story.map((s) => s.id));
  });

  it("never runs the clock backwards, and does each step on its written date", () => {
    const times = run.log.map((e) => toMs(e.at));
    expect(times).toEqual([...times].sort((a, b) => a - b));
    for (const story of SCENARIO.story) expect(run.completedAt[story.id], story.id).toBe(story.at);
  });

  it("numbers the log from 1 with no gaps", () => {
    expect(run.log.map((e) => e.n)).toEqual(run.log.map((_, i) => i + 1));
  });

  it("meets the three deadlines that apply and leaves the other two out", () => {
    const clocks = Object.fromEntries(deadlinesOf(run).map((c) => [c.id, c.state]));
    expect(clocks).toEqual({
      permit_validity: "met",
      fx_repatriation: "met",
      prior_notice: "met",
      lc_presentation: "not_applicable",
      isf_filing: "not_applicable",
    });
  });

  it("settles every open item of the order", () => {
    const viaStory = SCENARIO.openItems.filter((i) => !i.askId).map((i) => i.id);
    expect([...run.settled].sort()).toEqual([...viaStory].sort());
    for (const item of SCENARIO.openItems.filter((i) => i.askId)) expect(run.answers[item.askId as string]).toBeTruthy();
    // An item is settled at the step it names.
    for (const item of SCENARIO.openItems.filter((i) => !i.askId)) {
      expect(SCENARIO.story.find((s) => s.id === item.stepId)?.settles, item.id).toContain(item.id);
    }
  });

  it("files every document the order asks for, with nothing expired", () => {
    const filed = new Set(run.evidence.map((e) => e.type));
    for (const doc of SCENARIO.order.requiredDocuments) {
      for (const type of doc.evidence) expect(filed.has(type), `${doc.label}: ${type}`).toBe(true);
      if (!doc.evidence.length) expect(run.settled).toContain(doc.openItem);
    }
    expect(evaluation.steps.flatMap((s) => s.missingEvidence)).toEqual([]);
  });

  it("marks every invented reference as simulated", () => {
    const references = run.evidence.map((e) => e.reference).filter((r): r is string => r !== null);
    expect(references.length).toBeGreaterThan(20);
    for (const r of references) expect(r === SCENARIO.order.number || r.startsWith("SIM-"), r).toBe(true);
  });
});

describe("the two stops", () => {
  it("stops at the HS code and at the handover location, and nowhere else", () => {
    const first = playUntilStop(startRun(SCENARIO));
    expect(first.move).toEqual({ kind: "ask", askId: HS_CODE.id, stepId: "STEP-008" });
    expect(statusOf(first.run, "STEP-008")).toBe("awaiting_sme");

    const second = playUntilStop(answer(SCENARIO, first.run, HS_CODE.id, "0901.21"));
    expect(second.move).toEqual({ kind: "ask", askId: HANDOVER.id, stepId: "STEP-022" });
    expect(statusOf(second.run, "STEP-022")).toBe("awaiting_sme");

    const end = playUntilStop(answer(SCENARIO, second.run, HANDOVER.id, "roastery"));
    expect(end.move).toEqual({ kind: "finished" });
  });

  it("refuses a wrong answer, says why, and keeps the question open", () => {
    const { run: stopped } = playUntilStop(startRun(SCENARIO));
    for (const option of HS_CODE.options.filter((o) => !o.accepted)) {
      const refused = answer(SCENARIO, stopped, HS_CODE.id, option.id);
      expect(refused.log.at(-1)).toMatchObject({ kind: "rejected", detail: option.response });
      expect(refused.answers[HS_CODE.id]).toBeUndefined();
      expect(statusOf(refused, "STEP-008")).toBe("awaiting_sme");
      expect(nextMove(SCENARIO, refused).kind).not.toBe("finished");
    }
    const { run: atHandover } = playUntilStop(answer(SCENARIO, stopped, HS_CODE.id, "0901.21"));
    const refused = answer(SCENARIO, atHandover, HANDOVER.id, "city");
    expect(refused.log.at(-1)?.kind).toBe("rejected");
    expect(statusOf(refused, "STEP-022")).toBe("awaiting_sme");
  });

  it("holds only the steps that depend on an unanswered question", () => {
    const { run: stopped } = playUntilStop(startRun(SCENARIO));
    const held = holds(evaluateRun(stopped), "STEP-008");
    expect(held).toContain("STEP-009");
    expect(held).toContain("STEP-018");
    expect(held).not.toContain("STEP-011");

    // Carrying on without an answer: other steps move, then the second question is asked.
    const onward = playUntilStop(stopped);
    expect(onward.move).toEqual({ kind: "ask", askId: HANDOVER.id, stepId: "STEP-022" });
    for (const id of ["STEP-011", "STEP-012", "STEP-013", "STEP-014", "STEP-015", "STEP-019", "STEP-020", "STEP-021"]) {
      expect(statusOf(onward.run, id), id).toBe("completed");
    }
    // With both unanswered, what can still move does, and then the run waits for the answers.
    const waiting = playUntilStop(onward.run);
    expect(waiting.move).toEqual({ kind: "waiting", askIds: [HS_CODE.id, HANDOVER.id] });
    const done = evaluateRun(waiting.run).steps.filter((s) => s.status === "completed").map((s) => s.id);
    for (const id of held) expect(done).not.toContain(id);
    expect(advance(SCENARIO, waiting.run).run).toBe(waiting.run);

    // Answering late still gets to the end.
    let late = answer(SCENARIO, waiting.run, HANDOVER.id, "airport");
    late = answer(SCENARIO, late, HS_CODE.id, "0901.21");
    const end = playUntilStop(late);
    expect(end.move).toEqual({ kind: "finished" });
    expect(evaluateRun(end.run).phases.every((p) => p.status === "locked")).toBe(true);
    const times = end.run.log.map((e) => toMs(e.at));
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });

  it("tells a different story for each accepted handover location", () => {
    const told = (choice: string) => {
      const run = playThrough(SCENARIO, { [HANDOVER.id]: choice });
      expect(nextMove(SCENARIO, run).kind).toBe("finished");
      const story = SCENARIO.story.find((s) => s.id === "STEP-078");
      return story ? tell(story.detail, run.answers) : "";
    };
    expect(told("roastery")).toContain("loaded the cartons");
    expect(told("airport")).toContain("before unloading");
  });

  it("ignores an answer to a question that has not been asked or is already answered", () => {
    const fresh = startRun(SCENARIO);
    expect(answer(SCENARIO, fresh, HS_CODE.id, "0901.21")).toBe(fresh);
    const { run: stopped } = playUntilStop(fresh);
    const answered = answer(SCENARIO, stopped, HS_CODE.id, "0901.21");
    expect(answer(SCENARIO, answered, HS_CODE.id, "0901.11")).toBe(answered);
  });
});

describe("what the facts rule out", () => {
  it("rules out sea, Turkey, EU and exception steps from the start", () => {
    const evaluation = evaluateRun(startRun(SCENARIO));
    const out = evaluation.steps.filter((s) => s.status === "not_applicable").map((s) => s.id);
    for (const id of ["STEP-040", "STEP-041", "STEP-075", "STEP-089", "STEP-097", "STEP-053", "STEP-122"]) expect(out).toContain(id);
    expect(out).toHaveLength(18);
  });

  it("rules out the letter of credit steps once the payment terms are recorded", () => {
    let run = playThrough(SCENARIO);
    const entry = run.log.find((e) => e.kind === "ruled_out" && e.stepId === "STEP-025");
    expect(entry?.detail).toContain("STEP-026");
    expect(entry?.detail).toContain("STEP-112");
    run = startRun(SCENARIO);
    expect(statusOf(run, "STEP-026")).not.toBe("not_applicable");
  });
});
