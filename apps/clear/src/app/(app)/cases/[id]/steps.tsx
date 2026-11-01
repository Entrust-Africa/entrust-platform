import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Card, StatusBadge, cn } from "@entrust/ui";
import { evidenceName } from "@/lib/catalogue";
import { GATE_STATUSES, OWNERS } from "@/lib/statuses";
import { FilterChips, StepIcon } from "./parts";
import {
  STEP_FILTERS,
  caseHref,
  phaseRange,
  phaseTitle,
  progress,
  shownStatus,
  stepFilter,
  withStep,
  type Detail,
  type Step,
  type View,
} from "./view";

/** The steps tab: one phase's steps, its gate, and the steps the facts ruled out. */
export function StepsTab({ detail, view, phase }: { detail: Detail; view: View; phase: number }) {
  const steps = detail.workflow.steps.filter((s) => s.phase === phase);
  const applying = steps.filter((s) => s.applicability !== "not_applicable");
  const ruledOut = steps.filter((s) => s.applicability === "not_applicable");
  const filter = STEP_FILTERS.find((f) => f.id === view.show);
  const shown = filter ? applying.filter((s) => stepFilter(s) === filter.id) : applying;
  const { done, total } = progress(detail, phase);
  const gate = detail.workflow.phases.find((g) => g.phase === phase);
  const base = { tab: "steps" as const, phase: view.phase };

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-bold">
            Phase {phase} · {phaseTitle(phase)}
          </h2>
          <p className="mt-0.5 text-sm text-ink-3">
            {done} of {total} steps done · {phaseRange(phase)}
          </p>
        </div>
        <FilterChips
          label="Filter steps"
          current={filter?.id ?? "all"}
          options={[
            { id: "all", label: "All", count: applying.length, href: caseHref(detail.id, base) },
            ...STEP_FILTERS.map((f) => ({
              id: f.id,
              label: f.label,
              count: applying.filter((s) => stepFilter(s) === f.id).length,
              href: caseHref(detail.id, { ...base, show: f.id }),
            })),
          ]}
        />
      </div>

      {gate && (
        <p className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-product-50 px-4 py-3 text-sm text-ink-2 ring-1 ring-product/30 ring-inset">
          <StatusBadge tone={GATE_STATUSES[gate.status].tone}>{GATE_STATUSES[gate.status].label}</StatusBadge>
          <span>
            {gate.status === "locked" ? (
              <>
                The phase was signed off at <span className="font-semibold text-ink">{gate.milestoneStep}</span>.
              </>
            ) : gate.status === "ready" ? (
              <>
                <span className="font-semibold text-ink">{gate.milestoneStep}</span> can be signed off now.
              </>
            ) : (
              <>
                <span className="font-semibold text-ink">{gate.milestoneStep}</span> can be signed off once{" "}
                {gate.outstanding.length === 1 ? "1 more step is" : `${gate.outstanding.length} more steps are`} done.
              </>
            )}
          </span>
        </p>
      )}

      <Card className="mt-4 overflow-hidden">
        {shown.length ? (
          <ol>
            {shown.map((step) => (
              <StepRow key={step.id} step={step} detail={detail} view={view} />
            ))}
          </ol>
        ) : (
          <p className="px-5 py-8 text-center text-sm text-ink-2">
            {applying.length ? `No step in this phase is under “${filter?.label}”.` : "No step in this phase applies to the case."}
          </p>
        )}
        {ruledOut.length > 0 && (
          <details className="border-t border-line px-4 py-3 text-sm sm:px-5">
            <summary className="cursor-pointer text-ink-2">
              {ruledOut.length === 1 ? "1 step doesn't apply" : `${ruledOut.length} steps don't apply`} to this case
            </summary>
            <ul className="mt-2 flex flex-col gap-1.5 text-ink-3">
              {ruledOut.map((s) => (
                <li key={s.id}>
                  <Link href={withStep(detail.id, view, s.id)} scroll={false} className="hover:text-ink">
                    <span className="font-mono text-xs">{s.id}</span> {s.name}
                  </Link>
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

/** What stands out about a step, under its name: what holds it, what it waits on, or what it needs. */
function stepNote(step: Step, detail: Detail): string | null {
  if (step.heldBy.length) {
    const names = step.heldBy.map((rule) => {
      const flag = detail.flags.find((f) => f.status === "open" && f.rule === rule);
      return flag ? `${rule}, ${flag.name.toLowerCase()}` : rule;
    });
    return `Held by ${names.join("; ")}`;
  }
  if (step.status === "completed" || step.status === "not_applicable") return step.reason;
  if (step.blockedBy.length) return `Waits on ${step.blockedBy.join(", ")}`;
  if (step.reason) return step.reason;
  if (step.evidence.some((e) => e.status === "submitted" || e.status === "under_review")) return "Evidence under review";
  if (step.missingEvidence.length) return `Evidence to provide: ${step.missingEvidence.map(evidenceName).join(", ")}`;
  return null;
}

function StepRow({ step, detail, view }: { step: Step; detail: Detail; view: View }) {
  const status = shownStatus(step);
  const note = stepNote(step, detail);
  const selected = view.step === step.id;
  return (
    <li className="border-t border-line first:border-t-0">
      <Link
        href={withStep(detail.id, view, step.id)}
        scroll={false}
        aria-current={selected ? "true" : undefined}
        className={cn(
          "grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-4 py-3 transition-colors duration-150 hover:bg-surface-2 sm:px-5",
          "md:grid-cols-[1.25rem_5.5rem_minmax(0,1fr)_11rem_9.5rem_1rem]",
          selected && "bg-surface-2 shadow-[inset_3px_0_0_var(--color-product-600)]",
        )}
      >
        <StepIcon step={step} />
        <span className="hidden font-mono text-xs text-ink-3 md:block">{step.id}</span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold md:truncate">
            <span className="mr-2 font-mono text-xs font-normal text-ink-3 md:hidden">{step.id}</span>
            {step.name}
          </span>
          {note && <span className="block text-xs text-ink-3 md:truncate">{note}</span>}
          {step.milestone && <span className="mt-1 inline-block text-xs font-semibold text-product-600">Phase gate</span>}
        </span>
        <span className="hidden truncate text-sm text-ink-2 md:block">{OWNERS[step.owner]}</span>
        <StatusBadge tone={status.tone} className="justify-self-end">
          {status.label}
        </StatusBadge>
        <ChevronRight aria-hidden className="hidden size-4 text-line-strong md:block" />
      </Link>
    </li>
  );
}
