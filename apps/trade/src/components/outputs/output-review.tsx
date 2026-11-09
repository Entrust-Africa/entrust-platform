"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, StatusBadge } from "@entrust/ui";
import { tradeFetch } from "@/lib/trade-client";

export interface OutputDetails {
  versionId: string;
  status: string;
  attachments: { id: string; description: string | null; file: { name: string } }[];
  review: { status: "pending" | "under_review" | "reviewed" | "changes_requested"; comments: string | null; reviewedAt: string | null };
}

const STATUS: Record<OutputDetails["review"]["status"], { label: string; tone: "idle" | "info" | "ok" | "warn" }> = {
  pending: { label: "Waiting for review", tone: "idle" },
  under_review: { label: "Being reviewed", tone: "info" },
  reviewed: { label: "Reviewed", tone: "ok" },
  changes_requested: { label: "Changes asked for", tone: "warn" },
};

/** Where a submitted output stands with Entrust, what they said, and, for staff who can review, the buttons to move it on. */
export function OutputReview({ details, canReview }: { details: OutputDetails; canReview: boolean }) {
  const router = useRouter();
  const [comments, setComments] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const status = STATUS[details.review.status];

  async function review(next: "under_review" | "reviewed" | "changes_requested") {
    setBusy(true);
    setError(null);
    const res = await tradeFetch("POST", `/worksheet-versions/${details.versionId}/review`, { status: next, comments: comments.trim() || null });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setComments("");
    router.refresh();
  }

  return (
    <Card className="space-y-3 p-4 print:hidden">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold text-ink">Entrust's review</h2>
        <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
      </div>
      {details.review.comments && <p className="text-sm text-ink-2">{details.review.comments}</p>}
      {details.attachments.length > 0 && (
        <ul className="text-sm text-ink-2">
          {details.attachments.map((a) => <li key={a.id}>{a.file.name}{a.description ? `: ${a.description}` : ""}</li>)}
        </ul>
      )}
      {canReview && (
        <div className="space-y-2 border-t border-line pt-3">
          <label className="block text-xs font-semibold text-ink-3">
            Comments (needed to send it back)
            <textarea className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink" value={comments} onChange={(e) => setComments(e.target.value)} />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => void review("under_review")}>Start reviewing</Button>
            <Button size="sm" disabled={busy} onClick={() => void review("reviewed")}>Mark reviewed</Button>
            <Button size="sm" variant="secondary" disabled={busy || !comments.trim()} onClick={() => void review("changes_requested")}>Send back</Button>
          </div>
        </div>
      )}
      {error && <p role="alert" className="text-sm font-medium text-danger">{error}</p>}
    </Card>
  );
}
