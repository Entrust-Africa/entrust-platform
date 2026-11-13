"use client";

import { useEffect, useMemo, useReducer } from "react";
import { advance, answer, askById, deadlinesOf, evaluateRun, nextMove, startRun } from "@/lib/simulation/run";
import { SCENARIO } from "@/lib/simulation/scenario";
import type { Run } from "@/lib/simulation/types";

export const SPEEDS = [0.5, 1, 2, 5] as const;
export type Speed = (typeof SPEEDS)[number];

/** How long a step stays on screen at 1x. */
const STEP_MS = 800;

interface State {
  /** Every state the run has been in. Stepping back drops the last one, so it undoes everything. */
  history: readonly Run[];
  playing: boolean;
  /** Whether to carry on playing once the question that stopped the run is answered. */
  resume: boolean;
  speed: Speed;
}

type Action =
  | { type: "tick" }
  | { type: "step" }
  | { type: "back" }
  | { type: "restart"; play?: boolean }
  | { type: "play" }
  | { type: "pause" }
  | { type: "speed"; speed: Speed }
  | { type: "answer"; askId: string; optionId: string };

const fresh = (): State => ({ history: [startRun(SCENARIO)], playing: false, resume: false, speed: 1 });

const last = (state: State) => state.history[state.history.length - 1] as Run;

function reducer(state: State, action: Action): State {
  const run = last(state);
  switch (action.type) {
    case "tick":
    case "step": {
      // A tick that was already on its way when the run was paused changes nothing.
      if (action.type === "tick" && !state.playing) return state;
      const { run: moved, move } = advance(SCENARIO, run);
      // A question, a wait for answers and the end all stop the run.
      const goesOn = action.type === "tick" && state.playing && move.kind === "step";
      const resume = action.type === "tick" && state.playing && move.kind !== "step" && move.kind !== "finished";
      return { ...state, history: moved === run ? state.history : [...state.history, moved], playing: goesOn, resume };
    }
    case "answer": {
      const moved = answer(SCENARIO, run, action.askId, action.optionId);
      if (moved === run) return state;
      const accepted = Boolean(moved.answers[action.askId]);
      return { ...state, history: [...state.history, moved], playing: accepted ? state.resume : false, resume: accepted ? false : state.resume };
    }
    case "back":
      return state.history.length > 1 ? { ...state, history: state.history.slice(0, -1), playing: false, resume: false } : state;
    case "restart":
      return { ...fresh(), speed: state.speed, playing: Boolean(action.play) };
    case "play":
      return { ...state, playing: true };
    case "pause":
      return { ...state, playing: false, resume: false };
    case "speed":
      return { ...state, speed: action.speed };
  }
}

export function useSimulation() {
  const [state, dispatch] = useReducer(reducer, undefined, fresh);
  const run = last(state);

  useEffect(() => {
    if (!state.playing) return;
    const timer = setInterval(() => dispatch({ type: "tick" }), STEP_MS / state.speed);
    return () => clearInterval(timer);
  }, [state.playing, state.speed]);

  return useMemo(() => {
    const evaluation = evaluateRun(run);
    const next = nextMove(SCENARIO, run, evaluation);
    const openAsks = run.asked.filter((id) => !run.answers[id]).flatMap((id) => askById(SCENARIO, id) ?? []);
    return {
      scenario: SCENARIO,
      run,
      evaluation,
      next,
      deadlines: deadlinesOf(run),
      /** Questions CLEAR has asked that are still unanswered. */
      openAsks,
      playing: state.playing,
      speed: state.speed,
      started: state.history.length > 1,
      finished: next.kind === "finished",
      /** True when nothing can move until a question is answered. */
      waiting: next.kind === "waiting",
      dispatch,
    };
  }, [run, state.playing, state.speed, state.history.length]);
}

export type Simulation = ReturnType<typeof useSimulation>;
