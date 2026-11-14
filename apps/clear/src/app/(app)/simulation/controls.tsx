"use client";

import { Pause, Play, RotateCcw, StepForward, Undo2 } from "lucide-react";
import { Button, Card } from "@entrust/ui";
import { progress } from "@/lib/simulation/run";
import { SPEEDS, type Simulation, type Speed } from "./use-simulation";

/** Play, step, undo and restart. Stays under the app header while the page scrolls. */
export function Controls({ sim }: { sim: Simulation }) {
  const { playing, finished, started, waiting, speed, dispatch } = sim;
  const { done, total } = progress(sim.evaluation);

  return (
    <div className="sticky top-16 z-20 -mx-4 bg-canvas px-4 py-2 sm:-mx-6 sm:px-6">
      <Card className="flex items-center gap-1.5 p-2 shadow-xs sm:gap-2 sm:px-3">
        {playing ? (
          <Button onClick={() => dispatch({ type: "pause" })} className="h-11 w-28 px-3 sm:h-10 sm:w-32">
            <Pause aria-hidden className="size-4 shrink-0" /> Pause
          </Button>
        ) : finished ? (
          <Button onClick={() => dispatch({ type: "restart", play: true })} className="h-11 w-28 px-3 sm:h-10 sm:w-32">
            <Play aria-hidden className="size-4 shrink-0" /> Replay
          </Button>
        ) : (
          <Button
            onClick={() => dispatch({ type: "play" })}
            disabled={waiting}
            title={waiting ? "Nothing can move until the open question is answered" : undefined}
            className="h-11 w-28 px-3 sm:h-10 sm:w-32"
          >
            <Play aria-hidden className="size-4 shrink-0" /> {started ? "Resume" : "Play"}
          </Button>
        )}
        <Button
          variant="secondary"
          onClick={() => dispatch({ type: "step" })}
          disabled={playing || finished || waiting}
          aria-label="Do the next step"
          className="h-11 w-11 px-0 sm:h-10 sm:w-auto sm:px-3"
        >
          <StepForward aria-hidden className="size-4" />
          <span className="max-sm:hidden">Step</span>
        </Button>
        <Button
          variant="secondary"
          onClick={() => dispatch({ type: "back" })}
          disabled={!started}
          aria-label="Undo the last move"
          className="h-11 w-11 px-0 sm:h-10 sm:w-auto sm:px-3"
        >
          <Undo2 aria-hidden className="size-4" />
          <span className="max-sm:hidden">Undo</span>
        </Button>
        <Button
          variant="ghost"
          onClick={() => dispatch({ type: "restart" })}
          disabled={!started}
          aria-label="Start again from the beginning"
          className="h-11 w-11 px-0 sm:h-10 sm:w-auto sm:px-3"
        >
          <RotateCcw aria-hidden className="size-4" />
          <span className="max-sm:hidden">Start again</span>
        </Button>

        <label className="ml-auto flex items-center gap-2 text-sm text-ink-2 md:ml-2">
          <span className="max-sm:sr-only">Speed</span>
          <select
            value={speed}
            onChange={(event) => dispatch({ type: "speed", speed: Number(event.target.value) as Speed })}
            className="h-11 rounded-md border border-line-strong bg-surface px-2 text-sm font-semibold text-ink sm:h-10"
          >
            {SPEEDS.map((s) => (
              <option key={s} value={s}>
                {s}x
              </option>
            ))}
          </select>
        </label>

        <div className="ml-auto hidden items-center gap-3 md:flex">
          <div
            role="progressbar"
            aria-label="Steps done"
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={done}
            className="h-1.5 w-40 overflow-hidden rounded-full bg-surface-2"
          >
            <div className="h-full rounded-full bg-brand-600 transition-[width] duration-200" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
          </div>
          <span className="text-sm whitespace-nowrap text-ink-2 tabular-nums">
            {done} of {total} steps
          </span>
        </div>
      </Card>
    </div>
  );
}
