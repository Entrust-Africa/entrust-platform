import { X } from "lucide-react";
import type { EvaluatedStep } from "@entrust/gate-engine";
import { FACTS, MASTER_CONTROLS } from "@entrust/rules";
import { StatusBadge } from "@entrust/ui";
import { askOf, storyOf, tell } from "@/lib/simulation/run";
import { CLOCK_STATES, EVIDENCE_STATUSES, OWNERS } from "@/lib/statuses";
import { Eyebrow, StepIcon } from "../cases/[id]/parts";
import { phaseTitle } from "../cases/[id]/view";
import { AskCard } from "./now";
import { countryName, evidenceIssuer, evidenceName, shownStatus, simDate } from "./parts";
import type { Simulation } from "./use-simulation";
import { ViewLink, type View } from "./view";

const factLabel = (key: string) => FACTS.find((f) => f.key === key)?.label ?? key;
const valueLabel = (key: string, value: string) =>
  key === "destinationCountry" ? countryName(value) : (FACTS.find((f) => f.key === key)?.options?.find((o) => o.value === value)?.label ?? value);

/** Everything about one step in the side panel: what happened, what it waits on and what it put on file. */
export function StepPanel({ sim, step, view }: { sim: Simulation; step: EvaluatedStep; view: View }) {
  const { scenario, run, evaluation } = sim;
  const status = shownStatus(step);
  const definition = step.definition;
  const story = storyOf(scenario, step.id);
  const ask = askOf(scenario, step.id);
  const answered = ask?.options.find((o) => o.id === run.answers[ask.id]);
  const done = step.status === "completed";
  const doneAt = run.completedAt[step.id];
  const waitsOn = step.blockedBy.flatMap((id) => evaluation.steps.find((s) => s.id === id) ?? []);
  const control = MASTER_CONTROLS.find((c) => c.id === definition.masterControl);
  const clock = sim.deadlines.find((c) => c.stepId === step.id);
  const isNext = (sim.next.kind === "step" || sim.next.kind === "ask") && sim.next.stepId === step.id;

  return (
    <>
      <div className="border-b border-line px-5 pt-5 pb-4 sm:px-7">
        <div className="flex items-center justify-between gap-3">
          <p className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-ink-3">{step.id}</span>
            <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
            {definition.milestone && <StatusBadge tone="product">Phase gate</StatusBadge>}
          </p>
          <ViewLink
            to={{ ...view, step: undefined }}
            aria-label="Close the step"
            className="-mr-2 grid size-11 place-items-center rounded-md text-ink-3 hover:bg-surface-2 hover:text-ink"
          >
            <X aria-hidden className="size-5" />
          </ViewLink>
        </div>
        <h2 className="mt-2 text-lg leading-snug font-bold sm:text-xl">{definition.name}</h2>
        <p className="mt-1 text-sm text-ink-3">
          Phase {step.phase} · {phaseTitle(step.phase)} · Who acts: {OWNERS[step.owner]}
        </p>
      </div>

      <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-5 py-5 sm:px-7">
        {ask && run.asked.includes(ask.id) && !answered && <AskCard sim={sim} ask={ask} inPanel />}

        {ask && !run.asked.includes(ask.id) && (
          <section className="rounded-lg bg-warn-50 p-4 text-sm ring-1 ring-warn/30 ring-inset">
            <h3 className="font-sans text-xs font-bold tracking-wider text-warn uppercase">The run stops here</h3>
            <p className="mt-1 font-semibold">{ask.title}</p>
            <p className="mt-1 text-ink-2">CLEAR asks when the run reaches this step, and waits for the answer.</p>
          </section>
        )}

        {done && story && (
          <section>
            <Eyebrow>What happened</Eyebrow>
            <p className="mt-2 font-semibold">{tell(story.summary, run.answers)}</p>
            <p className="mt-1.5 text-sm text-ink-2">{tell(story.detail, run.answers)}</p>
            <p className="mt-1.5 text-sm text-ink-3">
              {doneAt && simDate(doneAt)} · {story.actor}
            </p>
          </section>
        )}

        {done && answered && (
          <section className="rounded-lg bg-ok-50 p-4 text-sm ring-1 ring-ok/25 ring-inset">
            <h3 className="font-sans text-xs font-bold tracking-wider text-ok uppercase">Answer on record</h3>
            <p className="mt-1 font-semibold">
              {answered.label}
              {answered.hint && <span className="font-normal text-ink-2"> · {answered.hint}</span>}
            </p>
            <p className="mt-1 text-ink-2">{answered.response}</p>
          </section>
        )}

        {done && story?.advice && (
          <section className="rounded-lg bg-info-50 p-4 text-sm ring-1 ring-info/20 ring-inset">
            <h3 className="font-sans text-xs font-bold tracking-wider text-info uppercase">CLEAR's advice</h3>
            <p className="mt-1">{story.advice}</p>
          </section>
        )}

        {!done && step.status === "not_applicable" && step.reason && <p className="text-sm text-ink-2">{step.reason}</p>}

        {!done && step.status !== "not_applicable" && !(ask && run.asked.includes(ask.id)) && (
          <section className="flex flex-col gap-2 text-sm">
            {waitsOn.length === 0 && (
              <p className="text-ink-2">
                {step.status === "undetermined"
                  ? step.reason
                  : isNext
                    ? "This is the next step. Nothing holds it."
                    : "Nothing holds this step. It is done when the run reaches it."}
              </p>
            )}
            {waitsOn.length > 0 && (
              <div>
                <Eyebrow>Waits on</Eyebrow>
                <ul className="mt-2 overflow-hidden rounded-lg border border-line">
                  {waitsOn.map((s) => (
                    <li key={s.id} className="border-t border-line first:border-t-0">
                      <ViewLink to={{ ...view, step: s.id }} className="flex min-h-11 items-center gap-3 px-3 py-2.5 hover:bg-surface-2">
                        <StepIcon step={s} className="size-4" />
                        <span className="font-mono text-xs text-ink-3">{s.id}</span>
                        <span className="min-w-0 flex-1 truncate">{s.definition.name}</span>
                        <span className="shrink-0 text-xs text-ink-3">{shownStatus(s).label}</span>
                      </ViewLink>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}

        {done && story?.sets && (
          <section>
            <Eyebrow>Facts recorded here</Eyebrow>
            <dl className="mt-2 flex flex-col gap-1.5 text-sm">
              {Object.entries(story.sets).map(([key, value]) => (
                <div key={key} className="flex flex-wrap gap-x-2">
                  <dt className="text-ink-3">{factLabel(key)}:</dt>
                  <dd className="font-semibold">{[value].flat().map((v) => valueLabel(key, String(v))).join(", ")}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-1.5 text-xs text-ink-3">CLEAR uses the facts to decide which later steps apply.</p>
          </section>
        )}

        {step.evidence.length > 0 && (
          <section>
            <Eyebrow>Evidence this step asks for</Eyebrow>
            <ul className="mt-2 overflow-hidden rounded-lg border border-line">
              {step.evidence.map((need) => {
                const filed = run.evidence.findLast((e) => e.type === need.type);
                return (
                  <li key={need.type} className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1 border-t border-line px-3 py-2.5 text-sm first:border-t-0">
                    <span className="min-w-0">
                      <span className="block font-semibold">{evidenceName(need.type)}</span>
                      <span className="block text-xs text-ink-3">
                        {evidenceIssuer(need.type)}
                        {filed?.reference && (
                          <>
                            {" "}
                            · <span className="font-mono">{filed.reference}</span>
                          </>
                        )}
                        {filed?.validUntil && <> · valid to {simDate(filed.validUntil)}</>}
                      </span>
                    </span>
                    <StatusBadge tone={EVIDENCE_STATUSES[need.status].tone}>{EVIDENCE_STATUSES[need.status].label}</StatusBadge>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {definition.deadline && (
          <section>
            <Eyebrow>Deadline</Eyebrow>
            <p className="mt-2 text-sm">{definition.deadline.description}</p>
            {clock && (
              <p className="mt-1.5">
                <StatusBadge tone={CLOCK_STATES[clock.state].tone}>{CLOCK_STATES[clock.state].label}</StatusBadge>
              </p>
            )}
          </section>
        )}

        <section>
          <Eyebrow>About the step</Eyebrow>
          <dl className="mt-2 flex flex-col gap-1.5 text-sm">
            {definition.authority && (
              <div className="flex flex-wrap gap-x-2">
                <dt className="text-ink-3">Authority or outside party:</dt>
                <dd>{definition.authority}</dd>
              </div>
            )}
            {control && (
              <div className="flex flex-wrap gap-x-2">
                <dt className="text-ink-3">Control:</dt>
                <dd>
                  <span className="font-mono text-xs">{control.id}</span> {control.name}
                </dd>
              </div>
            )}
            {definition.raisedWhen && (
              <div className="flex flex-wrap gap-x-2">
                <dt className="text-ink-3">Raised when:</dt>
                <dd>{definition.raisedWhen}</dd>
              </div>
            )}
          </dl>
        </section>
      </div>
    </>
  );
}
