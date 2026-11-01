import Link from "next/link";
import { Check, ChevronRight } from "lucide-react";
import { Card, StatusBadge, cn } from "@entrust/ui";
import { countryName, productLabel } from "@/lib/catalogue";
import { CASE_STATUSES, PHASES, ROLES } from "@/lib/statuses";
import { PHASE_NAMES, TABS, awaitingReview, caseHref, progress, type Detail, type View } from "./view";

/** The case's name and status, its seven phases, and the tabs. Shown on every view of the case. */
export function CaseHeader({ detail, view }: { detail: Detail; view: View }) {
  const status = CASE_STATUSES[detail.status];
  const openFlags = detail.flags.filter((f) => f.status === "open").length;
  const meta = [
    detail.reference,
    detail.version > 1 && `version ${detail.version}`,
    detail.rulePack && `${detail.rulePack.id} ${detail.rulePack.version}`,
  ].filter(Boolean);

  return (
    <>
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-ink-3">
        <Link href="/" className="hover:text-ink hover:underline">
          Cases
        </Link>
        <ChevronRight aria-hidden className="size-3.5" />
        <span aria-current="page" className="font-mono text-xs text-ink-2">
          {detail.reference}
        </span>
      </nav>

      <Card className="mt-3 p-4 sm:px-6 sm:pt-5 sm:pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-display text-xl font-bold sm:text-2xl">
              {productLabel(detail.product)} <span className="font-semibold text-ink-3">→</span> {countryName(detail.destinationCountry)}
            </h1>
            <p className="mt-1 text-sm text-ink-2">
              {detail.organizationName}
              {detail.contract && <> · buyer {detail.contract.buyerName}</>}
            </p>
            <p className="mt-1 font-mono text-xs text-ink-3">{meta.join(" · ")}</p>
          </div>
          <div className="flex flex-col items-start gap-2 sm:items-end">
            <div className="flex flex-wrap gap-2">
              {openFlags > 0 && <StatusBadge tone="danger">{openFlags === 1 ? "1 open flag" : `${openFlags} open flags`}</StatusBadge>}
              <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
            </div>
            <p className="text-xs text-ink-3">You: {ROLES[detail.yourRole]}</p>
          </div>
        </div>
        <PhaseTracker detail={detail} view={view} />
      </Card>

      <Tabs detail={detail} view={view} />
    </>
  );
}

/** The seven phases with each one's progress. A phase links to its steps. */
function PhaseTracker({ detail, view }: { detail: Detail; view: View }) {
  const shown = view.tab === "steps" ? (view.phase ?? detail.currentPhase) : null;
  return (
    <>
      <ol className="mt-5 grid grid-cols-7" aria-label={`Phase ${detail.currentPhase} of 7`}>
        {PHASES.map((p) => {
          const gate = detail.workflow.phases.find((g) => g.phase === p.n);
          const signed = gate?.status === "locked";
          const current = p.n === detail.currentPhase;
          const { done, total } = progress(detail, p.n);
          const lineDone = signed && p.n < 7;
          return (
            <li key={p.n} className="relative">
              {p.n < 7 && (
                <span aria-hidden className={cn("absolute top-4 left-1/2 h-0.5 w-full", lineDone ? "bg-ok" : "bg-line")} />
              )}
              <Link
                href={caseHref(detail.id, { tab: "steps", phase: p.n })}
                scroll={false}
                title={`Phase ${p.n}: ${p.title}`}
                aria-current={shown === p.n ? "true" : undefined}
                className="group relative flex flex-col items-center rounded-md px-1 pb-2 text-center"
              >
                <span
                  className={cn(
                    "grid size-8 place-items-center rounded-full font-display text-sm font-bold transition-shadow duration-150",
                    signed
                      ? "bg-ok text-white"
                      : current
                        ? "bg-product-600 text-white ring-4 ring-product/25"
                        : "bg-surface text-ink-3 ring-1 ring-line-strong ring-inset group-hover:ring-ink-3",
                  )}
                >
                  {signed ? <Check aria-hidden className="size-4 stroke-3" /> : <span aria-hidden>{p.n}</span>}
                </span>
                <span className="sr-only">
                  Phase {p.n}: {p.title}
                  {signed ? " (signed off)" : current ? " (current phase)" : ""}, {done} of {total} steps done
                </span>
                <span
                  aria-hidden
                  className={cn(
                    "mt-2 hidden text-xs leading-snug font-semibold group-hover:text-brand-700 md:block",
                    signed || current ? "text-ink" : "text-ink-3",
                  )}
                >
                  {PHASE_NAMES[p.n]}
                </span>
                <span aria-hidden className="mt-0.5 hidden font-mono text-[11px] text-ink-3 sm:block">
                  {done}/{total}
                </span>
                {shown === p.n && <span aria-hidden className="absolute -bottom-0.5 h-0.5 w-10 rounded-full bg-product-600" />}
              </Link>
            </li>
          );
        })}
      </ol>
      <p className="mt-1 text-center text-sm font-semibold md:hidden">
        Phase {shown ?? detail.currentPhase} of 7 · {PHASES.find((p) => p.n === (shown ?? detail.currentPhase))?.title}
      </p>
    </>
  );
}

function Tabs({ detail, view }: { detail: Detail; view: View }) {
  const toReview = awaitingReview(detail).length;
  const openFlags = detail.flags.filter((f) => f.status === "open").length;
  const counts: Partial<Record<View["tab"], { label: string; tone: string }>> = {
    ...(toReview ? { evidence: { label: `${toReview} to review`, tone: "bg-info-50 text-info" } } : {}),
    ...(openFlags ? { flags: { label: String(openFlags), tone: "bg-danger-50 text-danger" } } : {}),
  };
  return (
    <nav aria-label="Case views" className="mt-4 overflow-x-auto border-b border-line">
      <ul className="flex min-w-max gap-1">
        {TABS.map((t) => {
          const on = t.id === view.tab;
          const count = counts[t.id];
          return (
            <li key={t.id}>
              <Link
                href={caseHref(detail.id, { tab: t.id })}
                scroll={false}
                aria-current={on ? "page" : undefined}
                className={cn(
                  "relative flex items-center gap-2 px-3 pt-2 pb-3 text-sm font-semibold transition-colors duration-150",
                  on ? "text-ink" : "text-ink-2 hover:text-ink",
                )}
              >
                {t.label}
                {count && <span className={cn("rounded-full px-2 py-px text-xs", count.tone)}>{count.label}</span>}
                {on && <span aria-hidden className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-brand-600" />}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
