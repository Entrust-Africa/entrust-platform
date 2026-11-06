"use client";

import { useState } from "react";
import { Button, Card, StatusBadge } from "@entrust/ui";
import { formatDateTime } from "@/lib/summit";
import { browserApi, ok } from "@/lib/summit-api";
import type { FinalList as FinalListView } from "@/lib/summit-staff";
import { Outcome, TextArea, useAction } from "./use-action";

/** The committee's final list for a period. Approving publishes each decision to its applicant and closes the committee's work. */
export function FinalList({ list, canApprove }: { list: FinalListView; canApprove: boolean }) {
  const approve = useAction();
  const resend = useAction();
  const [note, setNote] = useState("");
  const [confirm, setConfirm] = useState(false);
  return (
    <Card className="space-y-3 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg font-bold text-ink">Final list: {list.period.name}</h2>
        <StatusBadge tone={list.approved ? "ok" : "warn"}>{list.approved ? "Approved" : "Not approved yet"}</StatusBadge>
      </div>
      <dl className="grid grid-cols-3 gap-3 text-center">
        {[
          ["Selected", list.counts.selected],
          ["Waitlisted", list.counts.waitlisted],
          ["Not selected", list.counts.notSelected],
        ].map(([label, count]) => (
          <div key={label} className="rounded-md bg-canvas p-3">
            <dt className="text-xs text-ink-3">{label}</dt>
            <dd className="font-display text-2xl font-bold text-ink">{count}</dd>
          </div>
        ))}
      </dl>
      {list.approved ? (
        <div className="space-y-2 text-sm text-ink-2">
          <p>
            Approved by {list.approvedBy?.name ?? "the committee"}
            {list.approvedAt ? ` on ${formatDateTime(list.approvedAt)}` : ""}. Decisions can no longer change.
          </p>
          {list.note && <p className="italic">“{list.note}”</p>}
          {list.unnotified > 0 && canApprove && (
            <div className="space-y-2">
              <p className="text-warn">{list.unnotified} applicant(s) have not had their result email queued.</p>
              <Button size="sm" variant="secondary" loading={resend.busy} onClick={() => resend.run(() => ok(browserApi().v1.summit.periods[":id"]["final-list"].notifications.$post({ param: { id: list.period.id } })), "Queued again.")}>
                Send the result emails again
              </Button>
              <Outcome error={resend.error} done={resend.done} />
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {list.pending.inCommitteeReview > 0 && <p className="text-sm text-ink-2">{list.pending.inCommitteeReview} still in committee review.</p>}
          {list.pending.beforeCommittee > 0 && <p className="text-sm text-ink-3">{list.pending.beforeCommittee} are still being assessed. They stay out of this list.</p>}
          {list.blockers.length > 0 && (
            <ul className="list-disc space-y-0.5 pl-5 text-sm text-warn">
              {list.blockers.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          )}
          {canApprove && (
            <div className="space-y-2 rounded-md bg-canvas p-3">
              <TextArea label="Note to keep with the approval" value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} />
              {!confirm ? (
                <Button size="sm" disabled={!list.canApprove} onClick={() => setConfirm(true)}>
                  Approve the final list
                </Button>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-ink">This tells every decided applicant their result by email and can't be undone.</p>
                  <div className="flex gap-2">
                    <Button size="sm" loading={approve.busy} onClick={() => approve.run(() => ok(browserApi().v1.summit.periods[":id"]["final-list"].$post({ param: { id: list.period.id }, json: note.trim() ? { note } : {} })), "Final list approved.")}>
                      Yes, approve and send
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => setConfirm(false)}>
                      Not yet
                    </Button>
                  </div>
                </div>
              )}
              <Outcome error={approve.error} done={approve.done} />
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
