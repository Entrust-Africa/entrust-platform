import { ChevronRight } from "lucide-react";
import type { EvaluatedStep, PhaseGate } from "@entrust/gate-engine";
import { Card, StatusBadge, cn } from "@entrust/ui";
import { askOf, progress, storyOf, tell } from "@/lib/simulation/run";
import { GATE_STATUSES, OWNERS } from "@/lib/statuses";
import { StepIcon } from "../cases/[id]/parts";
import { phaseRange, phaseTitle } from "../cases/[id]/view";
import { shownStatus, simDate } from "./parts";
import type { Simulation } from "./use-simulation";
import { ViewLink, type View } from "./view";

/** The steps tab: one phase's steps, its gate, and the steps the facts ruled out. */
export function StepsTab({ sim, view, phase, following }: { sim: Simulation; view: View; phase: number; following: boolean }) {
  const steps = sim.evaluation.steps.filter((s) => s.phase === phase);
  const applying = steps.filter((s) => s.applicability !== "not_applicable");
  const ruledOut = steps.filter((s) => s.applicability === "not_applicable");
  const { done, total } = progress(sim.evaluation, phase);
  const gate = sim.evaluation.phases.find((g) => g.phase === phase);
  const upcoming = sim.next.kind === "step" ? sim.next.stepId : null;

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h2 className="text-lg font-bold">
            Phase {phase} · {phaseTitle(phase)}
          </h2>
          <p className="mt-0.5 text-sm text-ink-3">
            {done} of {total} steps done · {phaseRange(phase)}
            {gate && <> · {gateNote(gate)}</>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {!following && (
            <ViewLink to={{ tab: "steps" }} className="inline-flex min-h-6 items-center text-sm font-semibold text-brand-600 underline-offset-4 hover:underline">
              Follow the run
            </ViewLink>
          )}
          {gate && <StatusBadge tone={GATE_STATUSES[gate.status].tone}>{GATE_STATUSES[gate.status].label}</StatusBadge>}
        </div>
      </div>

      <Card className="mt-4 overflow-hidden">
        <ol>
          {applying.map((step) => (
            <StepRow key={step.id} step={step} sim={sim} view={view} upcoming={step.id === upcoming} />
          ))}
        </ol>
        {ruledOut.length > 0 && (
          <details className="border-t border-line px-4 py-3 text-sm sm:px-5">
            <summary className="cursor-pointer py-1 text-ink-2">
              {ruledOut.length === 1 ? "1 step doesn't apply" : `${ruledOut.length} steps don't apply`} to this order
            </summary>
            <ul className="mt-2 flex flex-col gap-2 text-ink-3">
              {ruledOut.map((s) => (
                <li key={s.id}>
                  <ViewLink to={{ ...view, step: s.id }} mode="push" className="hover:text-ink">
                    <span className="font-mono text-xs">{s.id}</span> {s.definition.name}
                  </ViewLink>
                  {s.reason && <span className="block text-xs">{s.reason}</span>}
                </li>
              ))}
            </ul>
          </details>
        )}
      </Card>
    </>
  );
}

/** Where the phase's gate stands, in a few words. */
function gateNote(gate: PhaseGate): string {
  if (gate.status === "locked") return `signed off at ${gate.milestoneStep}`;
  if (gate.status === "ready") return `${gate.milestoneStep} can be signed off now`;
  const left = gate.outstanding.length;
  return `${gate.milestoneStep} signs it off once ${left === 1 ? "1 more step is" : `${left} more steps are`} done`;
}

/** What stands out about a step, under its name: what happened, what it waits on, or what it needs. */
function stepNote(step: EvaluatedStep, sim: Simulation, upcoming: boolean): string | null {
  const story = storyOf(sim.scenario, step.id);
  if (step.status === "completed") return story ? tell(story.summary, sim.run.answers) : null;
  const ask = askOf(sim.scenario, step.id);
  if (ask && sim.run.asked.includes(ask.id)) return "CLEAR stopped here and is waiting for an answer";
  if (step.blockedBy.length > 3) return `Waits on ${step.blockedBy.length} steps`;
  if (step.blockedBy.length) return `Waits on ${step.blockedBy.join(", ")}`;
  if (step.status === "undetermined") return step.reason;
  return upcoming ? "Next in line" : null;
}

function StepRow({ step, sim, view, upcoming }: { step: EvaluatedStep; sim: Simulation; view: View; upcoming: boolean }) {
  const status = shownStatus(step);
  const note = stepNote(step, sim, upcoming);
  const selected = view.step === step.id;
  const doneAt = sim.run.completedAt[step.id];
  return (
    <li className="border-t border-line first:border-t-0">
      <ViewLink
        to={{ ...view, step: step.id }}
        mode="push"
        aria-current={selected ? "true" : undefined}
        className={cn(
          "grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-4 py-3 transition-colors duration-150 hover:bg-surface-2 sm:px-5",
          "md:grid-cols-[1.25rem_5.5rem_minmax(0,1fr)_11rem_9.5rem_1rem]",
          (selected || upcoming) && "bg-surface-2 shadow-[inset_3px_0_0_var(--color-product-600)]",
        )}
      >
        <StepIcon step={step} />
        <span className="hidden font-mono text-xs text-ink-3 md:block">{step.id}</span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold md:truncate">
            <span className="mr-2 font-mono text-xs font-normal text-ink-3 md:hidden">{step.id}</span>
            {step.definition.name}
          </span>
          {note && <span className="block text-xs text-ink-3 md:truncate">{note}</span>}
          {step.definition.milestone && <span className="mt-1 inline-block text-xs font-semibold text-product-600">Phase gate</span>}
        </span>
        <span className="hidden truncate text-sm text-ink-2 md:block">{doneAt ? simDate(doneAt) : OWNERS[step.owner]}</span>
        <StatusBadge tone={status.tone} className="justify-self-end">
          {status.label}
        </StatusBadge>
        <ChevronRight aria-hidden className="hidden size-4 text-line-strong md:block" />
      </ViewLink>
    </li>
  );
}
