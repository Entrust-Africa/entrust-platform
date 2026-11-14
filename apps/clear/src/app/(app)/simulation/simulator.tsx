"use client";

import { STEPS } from "@entrust/rules";
import { currentPhase } from "@/lib/simulation/run";
import { Controls } from "./controls";
import { Drawer } from "./drawer";
import { SimulatorHeader, SimulatorTabs } from "./header";
import { Now } from "./now";
import { OrderTab } from "./order";
import { ActivityTab, DeadlinesTab, DocumentsTab } from "./records";
import { StepPanel } from "./step-panel";
import { StepsTab } from "./steps";
import { useSimulation } from "./use-simulation";
import { usePathname } from "next/navigation";
import { go, useView, viewHref } from "./view";

const phaseOf = (stepId: string) => STEPS.find((s) => s.id === stepId)?.phase;

/**
 * One export order played through CLEAR's steps. The page is laid out like a case page: the header
 * with the phase tracker, tabs, and a side panel per step.
 */
export function Simulator() {
  const sim = useSimulation();
  const view = useView();
  const pathname = usePathname();

  // The phase the run is in: where the next step is, or where the open question is.
  const at = sim.next.kind === "step" || sim.next.kind === "ask" ? sim.next.stepId : sim.openAsks[0]?.stepId;
  const runPhase = (at && phaseOf(at)) || currentPhase(sim.evaluation);
  const shownPhase = view.phase ?? runPhase;
  const open = view.step ? sim.evaluation.steps.find((s) => s.id === view.step) : undefined;

  const firstAsk = sim.openAsks[0];
  const announcement = firstAsk ? `CLEAR stopped to ask: ${firstAsk.title}` : sim.finished ? "The case is closed." : "";

  return (
    <>
      <SimulatorHeader sim={sim} view={view} shownPhase={shownPhase} />
      <Controls sim={sim} />
      <Now sim={sim} view={view} />
      <p role="status" className="sr-only">
        {announcement}
      </p>

      <div className="mt-5">
        <SimulatorTabs sim={sim} view={view} />
      </div>
      <div className="mt-6">
        {view.tab === "steps" && <StepsTab sim={sim} view={view} phase={shownPhase} following={shownPhase === runPhase} />}
        {view.tab === "order" && <OrderTab sim={sim} view={view} />}
        {view.tab === "documents" && <DocumentsTab sim={sim} view={view} />}
        {view.tab === "deadlines" && <DeadlinesTab sim={sim} view={view} />}
        {view.tab === "activity" && <ActivityTab sim={sim} view={view} />}
      </div>

      <p className="mt-8 max-w-3xl text-xs text-ink-3">
        A simulation. Which steps apply, what each one waits on and when a phase can be signed off come from CLEAR's own rules and engine.
        CLEAR has no rule pack for roasted coffee to the United States yet, so the regulatory detail in this story is illustrative. References
        that start with SIM- are invented, and banks, carriers and forwarders are named by role.
      </p>

      {open && (
        <Drawer key={open.id} onClose={() => go(viewHref(pathname, { ...view, step: undefined }))} label={`${open.id} ${open.definition.name}`}>
          <StepPanel sim={sim} step={open} view={view} />
        </Drawer>
      )}
    </>
  );
}
