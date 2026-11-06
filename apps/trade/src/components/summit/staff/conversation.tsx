"use client";

import { useState } from "react";
import { Button, Card, StatusBadge } from "@entrust/ui";
import { formatDateTime } from "@/lib/summit";
import { browserApi, ok } from "@/lib/summit-api";
import type { Workspace } from "@/lib/summit-staff";
import { Outcome, TextArea, useAction } from "./use-action";

/** Requests for more information (the applicant sees these) and internal comments (they never do). */
export function Conversation({ applicationId, workspace, canEdit }: { applicationId: string; workspace: Workspace; canEdit: boolean }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Clarifications applicationId={applicationId} items={workspace.clarifications} canEdit={canEdit} />
      <Comments applicationId={applicationId} items={workspace.comments} canEdit={canEdit} />
    </div>
  );
}

function Clarifications({ applicationId, items, canEdit }: { applicationId: string; items: Workspace["clarifications"]; canEdit: boolean }) {
  const ask = useAction();
  const [message, setMessage] = useState("");
  return (
    <Card className="space-y-3 p-4 sm:p-5">
      <h2 className="font-display text-lg font-bold text-ink">Requests for more information</h2>
      <p className="text-xs text-ink-3">The applicant gets an email with your message and the application waits for their answer.</p>
      {items.length === 0 && <p className="text-sm text-ink-2">None yet.</p>}
      <ul className="space-y-3">
        {items.map((c) => (
          <li key={c.id} className="space-y-1 rounded-md bg-canvas p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-ink-3">
                {c.requestedBy?.name ?? "Entrust"} · {formatDateTime(c.requestedAt)}
              </span>
              <StatusBadge tone={c.open ? "warn" : "ok"}>{c.open ? "Waiting for the applicant" : "Answered"}</StatusBadge>
            </div>
            <p className="text-ink">{c.message}</p>
            {c.response && (
              <p className="border-l-2 border-line-strong pl-3 text-ink-2">
                {c.response}
                {c.respondedAt && <span className="block text-xs text-ink-3">{formatDateTime(c.respondedAt)}</span>}
              </p>
            )}
          </li>
        ))}
      </ul>
      {canEdit && (
        <div className="space-y-2">
          <TextArea label="Ask the applicant" value={message} onChange={(e) => setMessage(e.target.value)} maxLength={4000} />
          <Button
            size="sm"
            loading={ask.busy}
            disabled={!message.trim()}
            onClick={async () => {
              if (await ask.run(() => ok(browserApi().v1.summit.applications[":id"].clarifications.$post({ param: { id: applicationId }, json: { message } })), "Sent.")) setMessage("");
            }}
          >
            Send the request
          </Button>
          <Outcome error={ask.error} done={ask.done} />
        </div>
      )}
    </Card>
  );
}

function Comments({ applicationId, items, canEdit }: { applicationId: string; items: Workspace["comments"]; canEdit: boolean }) {
  const add = useAction();
  const [body, setBody] = useState("");
  return (
    <Card className="space-y-3 p-4 sm:p-5">
      <h2 className="font-display text-lg font-bold text-ink">Internal comments</h2>
      <p className="text-xs text-ink-3">Only Entrust staff and the committee read these.</p>
      {items.length === 0 && <p className="text-sm text-ink-2">None yet.</p>}
      <ul className="space-y-3">
        {items.map((c) => (
          <li key={c.id} className="rounded-md bg-canvas p-3 text-sm">
            <p className="text-xs text-ink-3">
              {c.by?.name ?? "Entrust"} · {formatDateTime(c.at)}
            </p>
            <p className="mt-1 whitespace-pre-wrap text-ink">{c.body}</p>
          </li>
        ))}
      </ul>
      {canEdit && (
        <div className="space-y-2">
          <TextArea label="Add a comment" value={body} onChange={(e) => setBody(e.target.value)} maxLength={4000} />
          <Button
            size="sm"
            variant="secondary"
            loading={add.busy}
            disabled={!body.trim()}
            onClick={async () => {
              if (await add.run(() => ok(browserApi().v1.summit.applications[":id"].comments.$post({ param: { id: applicationId }, json: { body } })), "Added.")) setBody("");
            }}
          >
            Add the comment
          </Button>
          <Outcome error={add.error} done={add.done} />
        </div>
      )}
    </Card>
  );
}
