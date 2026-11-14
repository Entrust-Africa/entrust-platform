import { Check } from "lucide-react";
import { Card, StatusBadge, cn, type StatusTone } from "@entrust/ui";
import { currentPhase, progress } from "@/lib/simulation/run";
import { PHASES } from "@/lib/statuses";
import { PHASE_NAMES } from "../cases/[id]/view";
import { countryName, money, productLabel, simDate } from "./parts";
import type { Simulation } from "./use-simulation";
import { TABS, ViewLink, type View } from "./view";

function runState(sim: Simulation): { label: string; tone: StatusTone } {
  if (sim.finished) return { label: "Closed", tone: "ok" };
  if (sim.openAsks.length) return { label: "Waiting for an answer", tone: "warn" };
  if (sim.playing) return { label: "Running", tone: "info" };
  return sim.started ? { label: "Paused", tone: "idle" } : { label: "Not started", tone: "idle" };
}

/** The order's name and state, its seven phases, and the tabs: the same header a case has. */
export function SimulatorHeader({ sim, view, shownPhase }: { sim: Simulation; view: View; shownPhase: number }) {
  const { order, facts } = sim.scenario;
  const state = runState(sim);
  const { done, total } = progress(sim.evaluation);
  const asks = sim.openAsks.length;

  return (
    <Card className="p-4 sm:px-6 sm:pt-5 sm:pb-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-xl font-bold sm:text-2xl">
            {productLabel(String(facts.product))} <span className="font-semibold text-ink-3">→</span> {countryName(String(facts.destinationCountry))}
          </h1>
          <p className="mt-1 text-sm text-ink-2">
            {order.seller.company} · buyer {order.buyer.company}
          </p>
          <p className="mt-1 font-mono text-xs text-ink-3">
            {order.number} · {order.delivery.incoterm} · {money(order.value.total, order.currency)}
          </p>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <div className="flex flex-wrap gap-2">
            {asks > 0 && <StatusBadge tone="warn">{asks === 1 ? "1 open question" : `${asks} open questions`}</StatusBadge>}
            <StatusBadge tone={state.tone}>{state.label}</StatusBadge>
            <StatusBadge tone="product">Simulation</StatusBadge>
          </div>
          <p className="text-xs text-ink-3">
            {done} of {total} steps done · {simDate(sim.run.clock)}
          </p>
        </div>
      </div>
      <PhaseTracker sim={sim} shown={view.tab === "steps" ? shownPhase : null} />
    </Card>
  );
}

/** The seven phases with each one's progress. A phase links to its steps. */
function PhaseTracker({ sim, shown }: { sim: Simulation; shown: number | null }) {
  const current = currentPhase(sim.evaluation);
  return (
    <>
      <ol className="mt-5 grid grid-cols-7" aria-label={`Phase ${current} of 7`}>
        {PHASES.map((p) => {
          const signed = sim.evaluation.phases.find((g) => g.phase === p.n)?.status === "locked";
          const isCurrent = p.n === current && !sim.finished;
          const { done, total } = progress(sim.evaluation, p.n);
          return (
            <li key={p.n} className="relative">
              {p.n < 7 && <span aria-hidden className={cn("absolute top-4 left-1/2 h-0.5 w-full", signed ? "bg-ok" : "bg-line")} />}
              <ViewLink
                to={{ tab: "steps", phase: p.n }}
                title={`Phase ${p.n}: ${p.title}`}
                aria-current={shown === p.n ? "true" : undefined}
                className="group relative flex flex-col items-center rounded-md px-1 pb-2 text-center"
              >
                <span
                  className={cn(
                    "grid size-8 place-items-center rounded-full font-display text-sm font-bold transition-shadow duration-150",
                    signed
                      ? "bg-ok text-white"
                      : isCurrent
                        ? "bg-product-600 text-white ring-4 ring-product/25"
                        : "bg-surface text-ink-3 ring-1 ring-line-strong ring-inset group-hover:ring-ink-3",
                  )}
                >
                  {signed ? <Check aria-hidden className="size-4 stroke-3" /> : <span aria-hidden>{p.n}</span>}
                </span>
                <span className="sr-only">
                  Phase {p.n}: {p.title}
                  {signed ? " (signed off)" : isCurrent ? " (current phase)" : ""}, {done} of {total} steps done
                </span>
                <span
                  aria-hidden
                  className={cn(
                    "mt-2 hidden text-xs leading-snug font-semibold group-hover:text-brand-700 md:block",
                    signed || isCurrent ? "text-ink" : "text-ink-3",
                  )}
                >
                  {PHASE_NAMES[p.n]}
                </span>
                <span aria-hidden className="mt-0.5 hidden font-mono text-[11px] text-ink-3 sm:block">
                  {done}/{total}
                </span>
                {shown === p.n && <span aria-hidden className="absolute -bottom-0.5 h-0.5 w-10 rounded-full bg-product-600" />}
              </ViewLink>
            </li>
          );
        })}
      </ol>
      <p className="mt-1 text-center text-sm font-semibold md:hidden">
        Phase {shown ?? current} of 7 · {PHASES.find((p) => p.n === (shown ?? current))?.title}
      </p>
    </>
  );
}

export function SimulatorTabs({ sim, view }: { sim: Simulation; view: View }) {
  const counts: Partial<Record<View["tab"], string>> = {
    documents: sim.run.evidence.length ? String(sim.run.evidence.length) : undefined,
    activity: String(sim.run.log.length),
  };
  return (
    <nav aria-label="Simulator views" className="overflow-x-auto border-b border-line">
      <ul className="flex min-w-max gap-1">
        {TABS.map((t) => {
          const on = t.id === view.tab;
          return (
            <li key={t.id}>
              <ViewLink
                to={{ tab: t.id }}
                aria-current={on ? "page" : undefined}
                className={cn(
                  "relative flex items-center gap-2 px-3 pt-2 pb-3 text-sm font-semibold transition-colors duration-150",
                  on ? "text-ink" : "text-ink-2 hover:text-ink",
                )}
              >
                {t.label}
                {counts[t.id] && <span className="rounded-full bg-surface-2 px-2 py-px text-xs font-normal text-ink-2">{counts[t.id]}</span>}
                {on && <span aria-hidden className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-brand-600" />}
              </ViewLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
