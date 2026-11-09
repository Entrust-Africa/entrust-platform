"use client";

import { useState } from "react";
import { Button, Card, StatusBadge } from "@entrust/ui";
import { tradeFetch } from "@/lib/trade-client";
import { ActionEvidence } from "./action-evidence";

interface ActionItem {
  id: string;
  description: string;
  responsible: string;
  dueDate: string | null;
  expectedResult: string | null;
  performanceIndicator: string | null;
  resources: string | null;
  evidence: string | null;
  status: string;
  milestone: number;
  overdue: boolean;
}

export interface ActionPlan {
  organizationId: string;
  items: ActionItem[];
  milestones: { day: number; total: number; completed: number; overdue: number }[];
  questions: Record<string, { id: string; text: string }[]>;
  reviews: { id: string; day: number; answers: Record<string, string>; createdAt: string }[];
}

const STATUSES = [
  ["not_started", "Not started"],
  ["in_progress", "In progress"],
  ["completed", "Completed"],
  ["delayed", "Delayed"],
  ["blocked", "Blocked"],
  ["revised", "Revised"],
  ["closed_without_completion", "Closed without completion"],
  ["cancelled", "Cancelled"],
] as const;

const field = "w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink";

export function ActionPlanBoard({ initial, organizationId, readOnly }: { initial: ActionPlan; organizationId: string; readOnly: boolean }) {
  const [plan, setPlan] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState({ description: "", responsible: "", dueDate: "", expectedResult: "" });
  const [reviewDay, setReviewDay] = useState(30);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const reload = async () => {
    const res = await tradeFetch<ActionPlan>("GET", `/action-plan?organizationId=${encodeURIComponent(organizationId)}`);
    if (res.data) setPlan(res.data);
  };

  const run = async (action: () => Promise<{ ok: boolean; error: string | null }>, done?: string) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    const res = await action();
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return false;
    }
    if (done) setNotice(done);
    await reload();
    return true;
  };

  const bringIn = () =>
    run(async () => {
      const res = await tradeFetch<{ imported: number }>("POST", "/action-plan/import", { organizationId });
      if (res.ok) setNotice(res.data?.imported ? `Brought in ${res.data.imported} actions from your register.` : "Your newest register is already here.");
      return res;
    });

  const add = async () => {
    const ok = await run(() =>
      tradeFetch("POST", "/action-plan/items", {
        organizationId,
        description: draft.description,
        responsible: draft.responsible,
        dueDate: draft.dueDate,
        ...(draft.expectedResult ? { expectedResult: draft.expectedResult } : {}),
      }),
    );
    if (ok) setDraft({ description: "", responsible: "", dueDate: "", expectedResult: "" });
  };

  const saveReview = async () => {
    const ok = await run(() => tradeFetch("POST", "/action-plan/reviews", { organizationId, day: reviewDay, answers }), `Day-${reviewDay} review saved.`);
    if (ok) setAnswers({});
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        {plan.milestones.map((m) => (
          <Card key={m.day} className="p-4">
            <p className="text-xs font-semibold text-ink-3">Day {m.day}</p>
            <p className="mt-1 font-display text-xl font-bold text-ink">
              {m.completed} of {m.total} done
            </p>
            {m.overdue > 0 && <StatusBadge tone="danger">{`${m.overdue} overdue`}</StatusBadge>}
          </Card>
        ))}
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="text-sm text-ink-2">
          {notice}
        </p>
      )}

      {plan.items.length === 0 && (
        <Card className="space-y-2 p-5">
          <p className="text-sm text-ink-2">No actions yet. Bring them in from the action register you submitted in M12, or add your first one below.</p>
        </Card>
      )}

      {!readOnly && (
        <Button type="button" variant="ghost" disabled={busy} onClick={bringIn}>
          Bring in my M12 action register
        </Button>
      )}

      {plan.milestones.map((m) => {
        const items = plan.items.filter((i) => i.milestone === m.day);
        if (items.length === 0) return null;
        return (
          <section key={m.day} className="space-y-2" aria-label={`Day ${m.day} actions`}>
            <h2 className="font-display text-lg font-bold text-ink">Day {m.day}</h2>
            {items.map((item) => (
              <Card key={item.id} className="space-y-2 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="min-w-0 break-words font-semibold text-ink">{item.description}</p>
                  {item.overdue && <StatusBadge tone="danger">Overdue</StatusBadge>}
                </div>
                <p className="text-sm text-ink-2">
                  {item.responsible}
                  {item.dueDate ? `, due ${item.dueDate}` : ""}
                </p>
                {item.expectedResult && <p className="break-words text-sm text-ink-2">Result: {item.expectedResult}</p>}
                {item.performanceIndicator && <p className="break-words text-sm text-ink-2">Measure: {item.performanceIndicator}</p>}
                <label className="block text-xs font-semibold text-ink-3">
                  Status
                  <select
                    className={`${field} mt-1`}
                    disabled={readOnly || busy}
                    value={item.status}
                    onChange={(e) => void run(() => tradeFetch("PATCH", `/action-plan/items/${item.id}`, { status: e.target.value }))}
                  >
                    {STATUSES.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-xs font-semibold text-ink-3">
                  Evidence
                  <input
                    className={`${field} mt-1`}
                    disabled={readOnly}
                    defaultValue={item.evidence ?? ""}
                    onBlur={(e) => {
                      if (e.target.value !== (item.evidence ?? "")) void run(() => tradeFetch("PATCH", `/action-plan/items/${item.id}`, { evidence: e.target.value }));
                    }}
                  />
                </label>
                <ActionEvidence itemId={item.id} organizationId={organizationId} readOnly={readOnly} />
              </Card>
            ))}
          </section>
        );
      })}

      {!readOnly && (
        <Card className="space-y-3 p-5">
          <h2 className="font-display text-lg font-bold text-ink">Add an action</h2>
          <label className="block text-xs font-semibold text-ink-3">
            What will be done
            <textarea className={`${field} mt-1`} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
          </label>
          <label className="block text-xs font-semibold text-ink-3">
            Responsible person
            <input className={`${field} mt-1`} value={draft.responsible} onChange={(e) => setDraft({ ...draft, responsible: e.target.value })} />
          </label>
          <label className="block text-xs font-semibold text-ink-3">
            Deadline
            <input type="date" className={`${field} mt-1`} value={draft.dueDate} onChange={(e) => setDraft({ ...draft, dueDate: e.target.value })} />
          </label>
          <label className="block text-xs font-semibold text-ink-3">
            Expected result
            <input className={`${field} mt-1`} value={draft.expectedResult} onChange={(e) => setDraft({ ...draft, expectedResult: e.target.value })} />
          </label>
          <Button type="button" disabled={busy || !draft.description || !draft.responsible || !draft.dueDate} onClick={add}>
            Add action
          </Button>
        </Card>
      )}

      <section className="space-y-3" aria-label="Reviews">
        <h2 className="font-display text-lg font-bold text-ink">Reviews</h2>
        {!readOnly && (
          <Card className="space-y-3 p-5">
            <label className="block text-xs font-semibold text-ink-3">
              Which review
              <select
                className={`${field} mt-1`}
                value={reviewDay}
                onChange={(e) => {
                  setReviewDay(Number(e.target.value));
                  setAnswers({});
                }}
              >
                <option value={30}>Day 30: has implementation started?</option>
                <option value={60}>Day 60: how is it progressing?</option>
                <option value={90}>Day 90: results and next priorities</option>
              </select>
            </label>
            {(plan.questions[String(reviewDay)] ?? []).map((q) => (
              <label key={q.id} className="block text-xs font-semibold text-ink-3">
                {q.text}
                <textarea className={`${field} mt-1`} value={answers[q.id] ?? ""} onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })} />
              </label>
            ))}
            <Button type="button" disabled={busy || Object.values(answers).every((a) => !a.trim())} onClick={saveReview}>
              Save review
            </Button>
          </Card>
        )}
        {plan.reviews.map((review) => (
          <Card key={review.id} className="space-y-1 p-4">
            <p className="font-semibold text-ink">
              Day {review.day}, {review.createdAt.slice(0, 10)}
            </p>
            {(plan.questions[String(review.day)] ?? [])
              .filter((q) => review.answers[q.id])
              .map((q) => (
                <p key={q.id} className="break-words text-sm text-ink-2">
                  <span className="font-medium text-ink">{q.text}</span> {review.answers[q.id]}
                </p>
              ))}
          </Card>
        ))}
        {plan.reviews.length === 0 && <p className="text-sm text-ink-2">No reviews yet.</p>}
      </section>
    </div>
  );
}
