"use client";

import { ChevronRight } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button, StatusBadge, cn } from "@entrust/ui";
import { STEPS } from "@entrust/rules";
import { holds, progress, storyOf, tell } from "@/lib/simulation/run";
import type { Ask } from "@/lib/simulation/types";
import { simDate } from "./parts";
import type { Simulation } from "./use-simulation";
import { ViewLink, type View } from "./view";

/** Room the app header and the control bar take at the top of the window, in pixels. */
const PINNED = 152;

const nameOf = (stepId: string) => STEPS.find((s) => s.id === stepId)?.name ?? stepId;

/**
 * What the run is doing, in one fixed place under the controls: the step just done and the one
 * after it, or the question CLEAR has stopped to ask.
 */
export function Now({ sim, view }: { sim: Simulation; view: View }) {
  if (sim.openAsks.length) {
    return (
      <div className="flex flex-col gap-3">
        {sim.openAsks.map((ask) => (
          <AskCard key={ask.id} sim={sim} ask={ask} />
        ))}
      </div>
    );
  }

  const { run, scenario, evaluation } = sim;
  const last = run.log.findLast((e) => e.kind === "step" || e.kind === "gate");
  const upcoming = sim.next.kind === "step" || sim.next.kind === "ask" ? sim.next.stepId : null;
  const strip = "flex min-h-24 flex-col justify-center gap-3 rounded-lg bg-linear-to-r from-night to-night-2 px-5 py-4 text-on-night sm:flex-row sm:items-center sm:justify-between sm:px-7";
  const eyebrow = "font-sans text-xs font-bold tracking-wider text-on-night-muted uppercase";
  const open = "inline-flex h-10 shrink-0 items-center gap-1.5 self-start rounded-md bg-on-night px-4 text-sm font-semibold text-night hover:bg-white sm:self-center";

  if (sim.finished) {
    const { done } = progress(evaluation);
    const out = evaluation.steps.length - done;
    return (
      <section className={strip}>
        <div className="min-w-0">
          <h2 className={eyebrow}>Finished</h2>
          <p className="mt-1 font-display text-base font-bold text-white sm:text-lg">The case is closed.</p>
          <p className="mt-0.5 text-sm text-on-night">
            {done} steps done between {simDate(scenario.opened)} and {simDate(run.clock)}. {out} of CLEAR's steps did not apply to this order.
          </p>
        </div>
        <ViewLink to={{ tab: "activity" }} className={open}>
          Read the activity
          <ChevronRight aria-hidden className="size-4" />
        </ViewLink>
      </section>
    );
  }

  if (!last || !last.stepId) {
    return (
      <section className={strip}>
        <div className="min-w-0">
          <h2 className={eyebrow}>Next step</h2>
          <p className="mt-1 font-display text-base leading-snug font-bold text-white sm:text-lg">
            <span className="mr-2 font-mono text-sm font-medium text-on-night-muted">{upcoming}</span>
            {upcoming && nameOf(upcoming)}
          </p>
          <p className="mt-0.5 max-w-4xl text-sm text-on-night">
            Press Play to run order {scenario.order.number} through CLEAR's steps, or Step to take them one at a time. The run stops twice to ask
            you something the order leaves open.
          </p>
        </div>
      </section>
    );
  }

  const story = storyOf(scenario, last.stepId);
  return (
    <section className={strip}>
      <div className="min-w-0">
        <h2 className={eyebrow}>
          {sim.playing ? "Just done" : "Last step done"}
          <span className="ml-2 font-medium tracking-normal normal-case">
            {simDate(last.at)} · {last.actor}
          </span>
        </h2>
        <p className="mt-1 font-display text-base leading-snug font-bold text-white sm:text-lg md:truncate">
          <span className="mr-2 font-mono text-sm font-medium text-on-night-muted">{last.stepId}</span>
          {last.title}
        </p>
        <p className="mt-0.5 max-w-4xl text-sm text-on-night md:truncate">{story ? tell(story.summary, run.answers) : last.detail}</p>
      </div>
      <ViewLink to={{ ...view, step: last.stepId }} mode="push" className={open}>
        Open step
        <ChevronRight aria-hidden className="size-4" />
      </ViewLink>
    </section>
  );
}

/** A question CLEAR has stopped to ask, with the answers the user can give. */
export function AskCard({ sim, ask, inPanel = false }: { sim: Simulation; ask: Ask; inPanel?: boolean }) {
  const [chosen, setChosen] = useState<string | null>(null);
  const card = useRef<HTMLElement>(null);
  const refused = sim.run.refused[ask.id] ?? [];
  const held = holds(sim.evaluation, ask.stepId).length;

  // The run has just stopped here, so bring the question into view. On a phone it would otherwise
  // sit below the fold with nothing on screen to say why the run halted.
  useEffect(() => {
    const box = card.current?.getBoundingClientRect();
    // Only when it is not already in full view, and then to its top, clear of the pinned bars.
    if (!inPanel && box && (box.top < PINNED || box.bottom > window.innerHeight)) {
      card.current?.scrollIntoView({ block: "start", behavior: "smooth" });
    }
  }, [inPanel]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (chosen) sim.dispatch({ type: "answer", askId: ask.id, optionId: chosen });
  };

  return (
    <section
      ref={card}
      aria-labelledby={`ask-${ask.id}${inPanel ? "-panel" : ""}`}
      className={cn("scroll-mt-40 rounded-lg bg-warn-50 ring-1 ring-warn/30 ring-inset", inPanel ? "p-4" : "p-4 sm:p-6")}
    >
      <p className="flex flex-wrap items-center gap-2">
        <span className="font-sans text-xs font-bold tracking-wider text-warn uppercase">CLEAR stopped to ask</span>
        <span className="font-mono text-xs text-ink-3">{ask.stepId}</span>
        <StatusBadge tone="warn">Awaiting SME</StatusBadge>
      </p>
      <h2 id={`ask-${ask.id}${inPanel ? "-panel" : ""}`} className={cn("mt-2 font-bold", inPanel ? "text-base" : "text-lg sm:text-xl")}>
        {ask.title}
      </h2>
      <p className="mt-2 max-w-3xl text-sm text-ink-2">{ask.context}</p>
      <p className="mt-2 max-w-3xl text-sm text-ink-2">
        <span className="font-semibold text-ink">Why CLEAR asks.</span> {ask.why}
      </p>

      <form onSubmit={submit}>
        <fieldset className="mt-4">
          <legend className="text-sm font-semibold">Answer for {ask.from}</legend>
          <div className={cn("mt-2 grid gap-2", !inPanel && "md:grid-cols-2")}>
            {ask.options.map((option) => {
              const wasRefused = refused.includes(option.id);
              return (
                <label
                  key={option.id}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-lg border bg-surface p-3 transition-colors duration-150",
                    chosen === option.id ? "border-brand-600 ring-1 ring-brand-600" : "border-line-strong hover:border-ink-3",
                  )}
                >
                  <input
                    type="radio"
                    name={`ask-${ask.id}${inPanel ? "-panel" : ""}`}
                    value={option.id}
                    checked={chosen === option.id}
                    onChange={() => setChosen(option.id)}
                    className="mt-0.5 size-4 shrink-0 accent-brand-600"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">{option.label}</span>
                    {option.hint && <span className="block text-sm text-ink-2">{option.hint}</span>}
                    {wasRefused && (
                      <span className="mt-1.5 block text-sm text-danger">
                        <span className="font-semibold">Not accepted.</span> {option.response}
                      </span>
                    )}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
          <Button type="submit" disabled={!chosen || refused.includes(chosen)} className="h-11 sm:h-10">
            Record the answer
          </Button>
          {!sim.waiting && (
            <Button variant="ghost" onClick={() => sim.dispatch({ type: "play" })} className="h-11 sm:h-10">
              Carry on without answering
            </Button>
          )}
          <p className="text-sm text-ink-2">
            {sim.waiting ? "Nothing else can move. " : ""}
            {held === 1 ? "1 step waits" : `${held} steps wait`} on this answer.
          </p>
        </div>
      </form>
    </section>
  );
}
