import Link from "next/link";
import { ChevronRight, CircleDashed, CircleDot, Clock, FileText, Flag } from "lucide-react";
import { Card, StatusBadge, cn } from "@entrust/ui";
import { readable } from "@/lib/catalogue";
import { formatDate, formatDateTime } from "@/lib/format";
import { CLOCK_STATES, EVIDENCE_STATUSES, FLAG_SEVERITIES, NEXT_ACTIONS, OWNERS } from "@/lib/statuses";
import { CardHeading } from "./parts";
import { ContractTerms } from "./panels";
import {
  awaitingReview,
  caseHref,
  phaseSteps,
  phaseTitle,
  progress,
  shownStatus,
  stepAskingFor,
  stepFilter,
  withStep,
  type Detail,
  type View,
} from "./view";

type DeadlineClock = Detail["deadlines"][number];

/** The overview tab: what to do next, where the case stands, and what needs someone. */
export function OverviewTab({ detail, view }: { detail: Detail; view: View }) {
  return (
    <div className="flex flex-col gap-4">
      <NextStep detail={detail} view={view} />
      <Figures detail={detail} />
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,3fr)]">
        <NeedsAttention detail={detail} view={view} />
        <div className="flex flex-col gap-4">
          <DeadlinesCard detail={detail} />
          <Card>
            <CardHeading title="Sales contract" link={{ href: caseHref(detail.id, { tab: "details" }), label: "Facts & contract" }} />
            <div className="px-4 pb-4 sm:px-5">
              <ContractTerms detail={detail} />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function NextStep({ detail, view }: { detail: Detail; view: View }) {
  const next = detail.nextAction;
  const step = next && detail.workflow.steps.find((s) => s.id === next.stepId);
  // "Complete: <step name>." says nothing the heading doesn't.
  const said = next && readable(next.detail);
  if (!next) {
    return (
      <section className="rounded-lg bg-night px-5 py-5 text-on-night sm:px-7">
        <h2 className="font-sans text-xs font-bold tracking-wider text-on-night-muted uppercase">Next step</h2>
        <p className="mt-1.5 font-display text-lg font-bold text-white">
          {detail.status === "closed" ? "The case is closed." : "Nothing is waiting on anyone right now."}
        </p>
      </section>
    );
  }
  return (
    <section className="flex flex-col gap-4 rounded-lg bg-linear-to-r from-night to-night-2 px-5 py-5 text-on-night sm:flex-row sm:items-center sm:justify-between sm:px-7">
      <div className="min-w-0">
        <h2 className="flex items-center gap-2 font-sans text-xs font-bold tracking-wider text-on-night-muted uppercase">
          Next step
          <span className="rounded-sm bg-white/10 px-1.5 py-px tracking-normal text-on-night normal-case">{NEXT_ACTIONS[next.kind]}</span>
        </h2>
        <p className="mt-1.5 font-display text-lg leading-snug font-bold text-white sm:text-xl">
          <span className="mr-2 font-mono text-sm font-medium text-on-night-muted">{next.stepId}</span>
          {step?.name}
        </p>
        {said && !(step && said.includes(step.name)) && <p className="mt-1.5 max-w-3xl text-sm text-on-night">{said}</p>}
        <p className="mt-1 text-sm text-on-night-muted">
          Who acts: {OWNERS[next.owner]}
          {step && (
            <>
              {" "}
              · Phase {step.phase}, {phaseTitle(step.phase)}
            </>
          )}
        </p>
      </div>
      <Link
        href={withStep(detail.id, view, next.stepId)}
        scroll={false}
        className="inline-flex h-10 shrink-0 items-center gap-1.5 self-start rounded-md bg-on-night px-4 text-sm font-semibold text-night hover:bg-white sm:self-center"
      >
        Open step
        <ChevronRight aria-hidden className="size-4" />
      </Link>
    </section>
  );
}

function Bar({ value, total, tone }: { value: number; total: number; tone: string }) {
  return (
    <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-surface-2">
      <div className={cn("h-full rounded-full", tone)} style={{ width: `${total ? Math.round((value / total) * 100) : 0}%` }} />
    </div>
  );
}

function Figure({ label, value, unit, tone, children }: { label: string; value: number; unit: string; tone?: string; children: React.ReactNode }) {
  return (
    <Card className="p-4 sm:px-5">
      <p className="text-sm font-semibold text-ink-2">{label}</p>
      <p className={cn("mt-1 font-display text-2xl font-bold", tone)}>
        {value}
        <span className="ml-1 text-base font-semibold text-ink-3">{unit}</span>
      </p>
      {children}
    </Card>
  );
}

const dueDate = (clock: DeadlineClock) => (clock.due ? ("day" in clock.due ? formatDate(clock.due.day) : formatDateTime(clock.due.at)) : null);
const dueKey = (clock: DeadlineClock) => (clock.due ? ("day" in clock.due ? clock.due.day : clock.due.at) : "~");

function Figures({ detail }: { detail: Detail }) {
  const phase = detail.currentPhase;
  const gate = detail.workflow.phases.find((g) => g.phase === phase);
  const inPhase = progress(detail, phase);
  const whole = progress(detail);
  const latest = detail.evidence.filter((e) => e.latest);
  const approved = latest.filter((e) => e.status === "approved").length;
  const toReview = awaitingReview(detail).length;
  const sentBack = latest.filter((e) => e.status === "changes_required" || e.status === "rejected").length;
  const expired = latest.filter((e) => e.status === "expired").length;
  const evidenceNote = [
    toReview && `${toReview} waiting for review`,
    sentBack && `${sentBack} sent back`,
    expired && `${expired} expired`,
  ].filter(Boolean);
  const overdue = detail.deadlines.filter((d) => d.state === "overdue");
  const running = detail.deadlines.filter((d) => d.state === "running").sort((a, b) => dueKey(a).localeCompare(dueKey(b)));
  const nextDue = overdue[0] ?? running[0];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Figure label={`Phase ${phase} gate`} value={inPhase.done} unit={`/ ${inPhase.total} steps`}>
        <Bar value={inPhase.done} total={inPhase.total} tone="bg-product-600" />
        <p className="mt-2 text-sm text-ink-3">
          {!gate
            ? ""
            : gate.status === "locked"
              ? "Signed off"
              : gate.status === "ready"
                ? `${gate.milestoneStep} can be signed off`
                : `${gate.outstanding.length} to finish before ${gate.milestoneStep} is signed off`}
        </p>
      </Figure>
      <Figure label="Whole case" value={whole.done} unit={`/ ${whole.total} steps`}>
        <Bar value={whole.done} total={whole.total} tone="bg-ok" />
        <p className="mt-2 text-sm text-ink-3">Phase {phase} of 7</p>
      </Figure>
      <Figure label="Evidence" value={approved} unit="approved">
        <p className="mt-2.5 text-sm text-ink-3">{evidenceNote.length ? evidenceNote.join(" · ") : "Nothing waiting for review"}</p>
      </Figure>
      <Figure
        label="Deadlines"
        value={overdue.length || running.length}
        unit={overdue.length ? "overdue" : "running"}
        tone={overdue.length ? "text-danger" : undefined}
      >
        <p className="mt-2.5 text-sm text-ink-3">
          {nextDue ? `${nextDue.label}${dueDate(nextDue) ? `, due ${dueDate(nextDue)}` : ""}` : "None running"}
        </p>
      </Figure>
    </div>
  );
}

interface Attention {
  key: string;
  icon: React.ReactNode;
  title: string;
  note: string;
  ref: string;
  href: string;
}

const icon = (Icon: typeof Flag, tone: string) => (
  <span className={cn("grid size-9 shrink-0 place-items-center rounded-md", tone)}>
    <Icon aria-hidden className="size-4.5" />
  </span>
);

const LIMIT = 8;

/**
 * One list of what needs someone: open flags, evidence to review or sent back, and the current
 * phase's steps that can move or wait on someone outside CLEAR.
 */
function NeedsAttention({ detail, view }: { detail: Detail; view: View }) {
  const items: Attention[] = [];
  const covered = new Set<string>();

  for (const flag of detail.flags.filter((f) => f.status === "open")) {
    const step = flag.blocks[0];
    flag.blocks.forEach((id) => covered.add(id));
    items.push({
      key: flag.id,
      icon: icon(Flag, "bg-danger-50 text-danger"),
      title: flag.name,
      note: `${FLAG_SEVERITIES[flag.severity].label} flag${flag.blocks.length ? ` · holds ${flag.blocks.join(", ")}` : ""}`,
      ref: flag.rule,
      href: step ? withStep(detail.id, view, step) : caseHref(detail.id, { tab: "flags" }),
    });
  }

  for (const item of detail.evidence.filter((e) => e.latest)) {
    const review = item.status === "submitted" || item.status === "under_review";
    const back = item.status === "changes_required" || item.status === "rejected" || item.status === "expired";
    if (!review && !back) continue;
    const step = stepAskingFor(detail, item.type);
    if (step) covered.add(step.id);
    items.push({
      key: item.id,
      icon: icon(FileText, review ? "bg-info-50 text-info" : "bg-warn-50 text-warn"),
      title: review ? `Review: ${item.typeName}` : `${item.typeName}: ${EVIDENCE_STATUSES[item.status].label.toLowerCase()}`,
      note: review ? `Submitted ${formatDateTime(item.submittedAt)} · Entrust reviewer` : (item.reviewNote ?? "To submit again"),
      ref: step?.id ?? "",
      href: step ? withStep(detail.id, view, step.id) : caseHref(detail.id, { tab: "evidence" }),
    });
  }

  for (const step of phaseSteps(detail, detail.currentPhase)) {
    if (covered.has(step.id)) continue;
    const filter = stepFilter(step);
    const awaiting = step.status === "awaiting_buyer" || step.status === "awaiting_bank" || step.status === "awaiting_authority";
    if (filter !== "action" && !awaiting) continue;
    items.push({
      key: step.id,
      icon: awaiting
        ? icon(Clock, "bg-warn-50 text-warn")
        : step.status === "undetermined"
          ? icon(CircleDashed, "bg-surface-2 text-ink-3")
          : icon(CircleDot, "bg-info-50 text-info"),
      title: step.name,
      note: `${shownStatus(step).label} · ${step.status === "undetermined" && step.reason ? step.reason : OWNERS[step.owner]}`,
      ref: step.id,
      href: withStep(detail.id, view, step.id),
    });
  }

  const more = items.length - LIMIT;
  return (
    <Card>
      <CardHeading title="Needs attention" link={{ href: caseHref(detail.id, { tab: "steps", show: "action" }), label: "All steps" }} />
      {items.length ? (
        <ul>
          {items.slice(0, LIMIT).map((item) => (
            <li key={item.key} className="border-t border-line">
              <Link href={item.href} scroll={false} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2 sm:px-5">
                {item.icon}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{item.title}</span>
                  <span className="block truncate text-xs text-ink-3">{item.note}</span>
                </span>
                <span className="hidden font-mono text-xs text-ink-3 sm:block">{item.ref}</span>
                <ChevronRight aria-hidden className="size-4 shrink-0 text-line-strong" />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="border-t border-line px-5 py-6 text-sm text-ink-2">Nothing needs attention in phase {detail.currentPhase}.</p>
      )}
      {more > 0 && (
        <Link
          href={caseHref(detail.id, { tab: "steps", show: "action" })}
          scroll={false}
          className="block border-t border-line px-5 py-3 text-sm font-semibold text-brand-600 hover:underline"
        >
          {more === 1 ? "1 more" : `${more} more`} in the steps
        </Link>
      )}
    </Card>
  );
}

// Clocks to look at first: overdue, then running, then the rest.
const CLOCK_ORDER: Record<DeadlineClock["state"], number> = {
  overdue: 0,
  running: 1,
  waiting: 2,
  undetermined: 3,
  met_late: 4,
  met: 5,
  not_applicable: 6,
};

function DeadlinesCard({ detail }: { detail: Detail }) {
  const clocks = detail.deadlines
    .filter((d) => d.state !== "not_applicable")
    .sort((a, b) => CLOCK_ORDER[a.state] - CLOCK_ORDER[b.state] || dueKey(a).localeCompare(dueKey(b)));
  return (
    <Card>
      <CardHeading title="Deadlines" link={{ href: caseHref(detail.id, { tab: "deadlines" }), label: "All" }} />
      {clocks.length ? (
        <ul>
          {clocks.slice(0, 4).map((clock) => (
            <li key={clock.id} className="border-t border-line px-4 py-3 sm:px-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold">{clock.label}</p>
                <StatusBadge tone={CLOCK_STATES[clock.state].tone}>{CLOCK_STATES[clock.state].label}</StatusBadge>
              </div>
              <p className="mt-0.5 text-xs text-ink-3">
                {dueDate(clock) ? `Due ${dueDate(clock)}` : `Starts at ${clock.stepId}`}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="border-t border-line px-5 py-4 text-sm text-ink-2">No deadline applies to this case.</p>
      )}
    </Card>
  );
}
