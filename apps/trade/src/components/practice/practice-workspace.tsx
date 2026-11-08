"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, StatusBadge } from "@entrust/ui";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { humanise } from "@/lib/money";
import { tradeFetch } from "@/lib/trade-client";
import type { PracticeCase, PracticeEvent, PracticeFact, PracticeStep } from "@/lib/practice";

const INPUT = "mt-1 block w-full rounded-md border border-line-strong bg-surface px-3 py-2 text-base text-ink sm:text-sm";
const today = () => new Date().toISOString().slice(0, 10);

const NEXT_TITLES: Record<string, string> = {
  resolve_exception: "Resolve this exception",
  determine: "Answer a question about the deal",
  provide_evidence: "Provide the evidence",
  review_evidence: "Review the evidence",
  complete: "Complete this step",
  sign_off: "Sign off the phase",
};

const PARTY_NOTES: Record<string, string> = {
  reviewer: "You're taking the turn of the Entrust reviewer.",
  facilitator: "This one is done by the system. You're taking its turn.",
};

/** A case's steps belong to several parties, and a learner working alone takes each party's turn. */
function roleForNext(next: NonNullable<PracticeCase["workflow"]["nextAction"]>): string | undefined {
  if (next.kind === "sign_off" || next.kind === "review_evidence" || next.owner === "entrust") return "reviewer";
  return next.owner === "system" ? "facilitator" : undefined;
}

const stepTone = (step: PracticeStep): "ok" | "info" | "warn" | "danger" | "idle" => {
  if (step.status === "completed") return "ok";
  if (step.heldBy.length > 0) return "danger";
  if (step.status === "in_progress") return "info";
  return "idle";
};

interface Props {
  initialCase: PracticeCase;
  initialEvents: PracticeEvent[];
  label: string;
  title: string;
  facts: PracticeFact[];
}

export function PracticeWorkspace({ initialCase, initialEvents, label, title, facts }: Props) {
  const router = useRouter();
  const [detail, setDetail] = useState(initialCase);
  const [events, setEvents] = useState(initialEvents);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const [date, setDate] = useState(today);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState("");
  const [openPhase, setOpenPhase] = useState<number>(detail.currentPhase);

  const base = `/practice-cases/${detail.id}`;
  const next = detail.workflow.nextAction;
  const step = next ? detail.workflow.steps.find((s) => s.id === next.stepId) : undefined;
  const role = next ? roleForNext(next) : undefined;
  const openFlags = detail.flags.filter((f) => f.status === "open");
  const allSigned = detail.workflow.phases.every((p) => p.status === "locked");

  /** Runs calls in order and shows the case the last one returned. Stops at the first refusal and says why. */
  async function run(calls: { method: "POST" | "PUT" | "PATCH"; path: string; body?: unknown }[]) {
    setBusy(true);
    setError(null);
    for (const call of calls) {
      const result = await tradeFetch<PracticeCase>(call.method, call.path, call.body);
      if (!result.ok || !result.data) {
        setError(result.error ?? "That didn't work. Please try again.");
        setBusy(false);
        return false;
      }
      if (result.data.workflow) {
        setDetail(result.data);
        setOpenPhase(result.data.currentPhase);
      }
    }
    setBusy(false);
    return true;
  }

  const query = (as: string | undefined) => (as ? `?as=${as}` : "");

  function provideEvidence() {
    if (!step) return;
    const submitted = new Set(detail.evidence.filter((e) => e.latest && (e.status === "submitted" || e.status === "under_review" || e.status === "approved")).map((e) => e.type));
    const wanted = step.evidence.filter((need) => !need.satisfied && !submitted.has(need.type));
    void run(wanted.map((need) => ({ method: "POST", path: `${base}/evidence`, body: { type: need.type, issuedOn: date } })));
  }

  function approveEvidence() {
    if (!step) return;
    const types = new Set(step.evidence.map((need) => need.type));
    const waiting = detail.evidence.filter((e) => e.latest && types.has(e.type) && (e.status === "submitted" || e.status === "under_review"));
    void run(
      waiting.flatMap((e) => [
        ...(e.status === "submitted" ? [{ method: "POST" as const, path: `${base}/evidence/${e.id}/review?as=reviewer`, body: { to: "under_review" } }] : []),
        { method: "POST" as const, path: `${base}/evidence/${e.id}/review?as=reviewer`, body: { to: "approved" } },
      ]),
    );
  }

  function completeStep() {
    if (!next) return;
    void run([{ method: "POST", path: `${base}/steps/${next.stepId}/transition${query(role)}`, body: { to: "completed", occurredAt: date } }]);
  }

  // The questions this step settles, or if the rules name none, every question not answered yet.
  const unanswered = facts.filter((f) => detail.facts[f.key] === undefined || detail.facts[f.key] === null);
  const questions = next?.kind === "determine" ? (unanswered.some((f) => f.determinedAt === next.stepId) ? unanswered.filter((f) => f.determinedAt === next.stepId) : unanswered) : [];

  function answerQuestions() {
    const given = Object.fromEntries(Object.entries(answers).filter(([key, value]) => value && questions.some((q) => q.key === key)));
    void run([{ method: "PATCH", path: `${base}/facts`, body: { facts: given } }]);
  }

  async function playEvent(eventId: string) {
    const done = await run([{ method: "POST", path: `${base}/events/${eventId}` }]);
    if (!done) return;
    const list = await tradeFetch<{ items: PracticeEvent[] }>("GET", `${base}/events`);
    if (list.data) setEvents(list.data.items);
  }

  function savePlannedLoading() {
    if (loading) void run([{ method: "POST", path: `${base}/clock-inputs`, body: { key: "plannedLoading", value: `${loading}T09:00:00+03:00` } }]);
  }

  async function reset() {
    setBusy(true);
    const result = await tradeFetch<{ id: string }>("POST", `${base}/reset`);
    setBusy(false);
    if (!result.ok || !result.data) {
      setError(result.error ?? "The case couldn't be reset. Please try again.");
      setResetting(false);
      return;
    }
    router.replace(`/practice/${result.data.id}`);
    router.refresh();
  }

  const unplayed = events.filter((e) => !e.played);
  const documents = detail.documents.filter((d) => Object.keys(d.fields).length > 0);
  const stepsInPhase = detail.workflow.steps.filter((s) => s.phase === openPhase);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <p role="note" className="rounded-md bg-warn-50 px-4 py-2.5 text-sm font-semibold text-warn">
        {label}
      </p>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold text-ink">{title}</h1>
          <p className="mt-1 text-sm text-ink-2">
            {detail.reference} · Phase {detail.currentPhase} of {detail.workflow.phases.length}
          </p>
        </div>
        <Button variant="secondary" onClick={() => setResetting(true)} disabled={busy}>
          Start again
        </Button>
      </div>

      {error && (
        <p role="alert" className="rounded-md bg-danger-50 p-3 text-sm text-danger">
          {error}
        </p>
      )}

      {openFlags.map((flag) => (
        <Card key={flag.id} className="border-l-4 border-l-danger p-5">
          <p className="font-semibold text-danger">
            {flag.rule}: {flag.name}
          </p>
          <p className="mt-1 text-sm text-ink-2">{flag.message}</p>
        </Card>
      ))}

      <Card className="border-l-4 border-l-brand-600 p-5">
        {next && step ? (
          <div className="space-y-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-brand-700">{NEXT_TITLES[next.kind] ?? "Next step"}</p>
              <h2 className="mt-1 font-display text-lg font-bold text-ink">{step.name}</h2>
              <p className="mt-1 text-sm text-ink-2">{next.detail}</p>
              {role && <p className="mt-1 text-xs text-ink-3">{PARTY_NOTES[role]}</p>}
              {next.stepId === "STEP-099" && unplayed.some((e) => e.id === "documents-arrive") && (
                <p className="mt-2 text-sm font-medium text-ink">The documents to compare haven't arrived yet. Play "The shipping documents arrive" below first.</p>
              )}
            </div>

            {next.kind === "provide_evidence" && (
              <div className="space-y-3">
                <ul className="list-disc space-y-1 pl-5 text-sm text-ink-2">
                  {step.evidence.filter((need) => !need.satisfied).map((need) => (
                    <li key={need.type}>{humanise(need.type)}</li>
                  ))}
                </ul>
                <label className="block max-w-xs text-sm font-medium text-ink">
                  Issue date on the document
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={INPUT} />
                </label>
                <p className="text-xs text-ink-3">This is practice, so no file is needed. In a real case you would attach the document.</p>
                <Button onClick={provideEvidence} disabled={busy}>
                  Submit for review
                </Button>
              </div>
            )}

            {next.kind === "review_evidence" && (
              <Button onClick={approveEvidence} disabled={busy}>
                Approve the evidence
              </Button>
            )}

            {(next.kind === "complete" || next.kind === "sign_off" || next.kind === "resolve_exception") && (
              <div className="space-y-3">
                <label className="block max-w-xs text-sm font-medium text-ink">
                  The date it happened
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={INPUT} />
                </label>
                <Button onClick={completeStep} disabled={busy}>
                  {next.kind === "sign_off" ? `Sign off phase ${step.phase}` : "Mark complete"}
                </Button>
              </div>
            )}

            {next.kind === "determine" && (
              <div className="space-y-3">
                {questions.map((fact) => (
                  <label key={fact.key} className="block max-w-md text-sm font-medium text-ink">
                    {fact.label}
                    {fact.options ? (
                      <select value={answers[fact.key] ?? ""} onChange={(e) => setAnswers({ ...answers, [fact.key]: e.target.value })} className={INPUT}>
                        <option value="">Choose one</option>
                        {fact.options.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input value={answers[fact.key] ?? ""} onChange={(e) => setAnswers({ ...answers, [fact.key]: e.target.value })} className={INPUT} />
                    )}
                    <span className="mt-1 block text-xs font-normal text-ink-3">{fact.help}</span>
                  </label>
                ))}
                <Button onClick={answerQuestions} disabled={busy || !questions.some((q) => answers[q.key])}>
                  Save the answers
                </Button>
              </div>
            )}
          </div>
        ) : openFlags.length > 0 ? (
          <div>
            <h2 className="font-display text-lg font-bold text-ink">Deal with the problem above</h2>
            <p className="mt-1 text-sm text-ink-2">Nothing can move until it is fixed. Compare the documents below and correct the figure that is wrong.</p>
          </div>
        ) : allSigned ? (
          <div>
            <h2 className="font-display text-lg font-bold text-ink">You finished the export</h2>
            <p className="mt-1 text-sm text-ink-2">All {detail.workflow.phases.length} phases are signed off. Start again to practise with different answers.</p>
          </div>
        ) : (
          <p className="text-sm text-ink-2">Nothing is waiting on you right now. Look through the phases below.</p>
        )}
      </Card>

      {events.length > 0 && (
        <section aria-labelledby="events" className="space-y-3">
          <h2 id="events" className="font-display text-lg font-bold text-ink">
            What happens along the way
          </h2>
          {events.map((event) => (
            <Card key={event.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1 basis-64">
                  <p className="font-semibold text-ink">{event.title}</p>
                  <p className="mt-1 text-sm text-ink-2">{event.story}</p>
                </div>
                {event.played ? (
                  <StatusBadge tone="ok">Happened</StatusBadge>
                ) : (
                  <Button variant="secondary" onClick={() => void playEvent(event.id)} disabled={busy}>
                    Make it happen
                  </Button>
                )}
              </div>
              {event.id === "shipment-delay" && !event.played && (
                <div className="mt-3 flex flex-wrap items-end gap-3 border-t border-line pt-3">
                  <label className="block text-sm font-medium text-ink">
                    Planned loading date, which the delay moves
                    <input type="date" value={loading} onChange={(e) => setLoading(e.target.value)} className={INPUT} />
                  </label>
                  <Button variant="secondary" onClick={savePlannedLoading} disabled={busy || !loading}>
                    Save the date
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </section>
      )}

      {documents.length > 0 && (
        <section aria-labelledby="documents" className="space-y-3">
          <h2 id="documents" className="font-display text-lg font-bold text-ink">
            The shipping documents
          </h2>
          {documents.map((doc) => (
            <details key={doc.document} open={openFlags.length > 0} className="rounded-lg border border-line bg-surface p-4">
              <summary className="cursor-pointer font-semibold text-ink">{doc.name}</summary>
              <form
                className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  const form = new FormData(e.currentTarget);
                  const fields = Object.fromEntries(Object.keys(doc.fields).map((key) => [key, String(form.get(key) ?? "")]));
                  void run([{ method: "PUT", path: `${base}/documents/${doc.document}/fields`, body: { fields } }]);
                }}
              >
                {Object.entries(doc.fields).map(([key, value]) => (
                  <label key={`${key}-${value}`} className="block min-w-0 text-sm font-medium text-ink">
                    {humanise(key.replace(/([A-Z])/g, " $1").toLowerCase())}
                    <input name={key} defaultValue={value} className={INPUT} />
                  </label>
                ))}
                <div className="sm:col-span-2">
                  <Button type="submit" variant="secondary" disabled={busy}>
                    Save this document
                  </Button>
                </div>
              </form>
            </details>
          ))}
        </section>
      )}

      <section aria-labelledby="phases" className="space-y-3">
        <h2 id="phases" className="font-display text-lg font-bold text-ink">
          All the phases
        </h2>
        <div className="flex flex-wrap gap-2">
          {detail.workflow.phases.map((phase) => (
            <button
              key={phase.phase}
              type="button"
              aria-pressed={openPhase === phase.phase}
              onClick={() => setOpenPhase(phase.phase)}
              className={`rounded-md border px-3 py-1.5 text-sm font-medium ${openPhase === phase.phase ? "border-brand-600 bg-brand-50 text-brand-700" : "border-line text-ink-2 hover:bg-surface-2"}`}
            >
              Phase {phase.phase}
              {phase.status === "locked" ? " ✓" : ""}
            </button>
          ))}
        </div>
        <Card className="divide-y divide-line">
          {stepsInPhase.map((s) => (
            <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <p className="min-w-0 flex-1 basis-56 text-sm text-ink">
                <span className="mr-2 font-mono text-xs text-ink-3">{s.id}</span>
                {s.name}
              </p>
              <StatusBadge tone={stepTone(s)}>{humanise(s.status)}</StatusBadge>
            </div>
          ))}
        </Card>
      </section>

      <ConfirmDialog
        open={resetting}
        title="Start this practice again?"
        confirmLabel="Start again"
        tone="danger"
        busy={busy}
        onConfirm={() => void reset()}
        onCancel={() => setResetting(false)}
      >
        Everything you've done on this practice case is cleared. Nothing real is affected.
      </ConfirmDialog>
    </div>
  );
}
