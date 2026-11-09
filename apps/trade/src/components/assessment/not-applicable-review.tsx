"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card } from "@entrust/ui";
import { tradeFetch } from "@/lib/trade-client";

export interface PendingNotApplicable {
  questionId: string;
  question: string;
  reason: string;
}

/**
 * Staff: the questions a business said don't apply to it. Until staff approve one it stays in the score as unanswered; approving
 * takes it out of the denominator and scores the assessment again. Missing is never scored as zero, and nothing leaves the score on
 * the business's word alone.
 */
export function NotApplicableReview({ assessmentId, pending }: { assessmentId: string; pending: PendingNotApplicable[] }) {
  const router = useRouter();
  const [done, setDone] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function approve(questionId: string) {
    setBusy(questionId);
    setError(null);
    const res = await tradeFetch("POST", `/assessments/${assessmentId}/responses/${encodeURIComponent(questionId)}/approve`);
    setBusy(null);
    if (!res.ok) return setError(res.error);
    setDone((d) => new Set(d).add(questionId));
    router.refresh();
  }

  const waiting = pending.filter((p) => !done.has(p.questionId));
  return (
    <Card className="mx-auto max-w-xl space-y-3 p-5">
      <h2 className="text-sm font-semibold text-ink">"Does not apply" answers to approve</h2>
      {waiting.length === 0 ? (
        <p className="text-sm text-ink-2">All approved. The assessment has been scored again.</p>
      ) : (
        <ul className="divide-y divide-line">
          {waiting.map((p) => (
            <li key={p.questionId} className="space-y-1 py-3">
              <p className="text-sm font-medium text-ink">{p.question}</p>
              <p className="text-sm text-ink-2">Their reason: {p.reason || "none given"}</p>
              <Button size="sm" variant="secondary" loading={busy === p.questionId} onClick={() => void approve(p.questionId)}>
                Approve: take it out of the score
              </Button>
            </li>
          ))}
        </ul>
      )}
      {error && <p role="alert" className="text-sm font-medium text-danger">{error}</p>}
    </Card>
  );
}
