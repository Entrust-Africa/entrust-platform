"use client";

import { useState } from "react";
import { Button, Card } from "@entrust/ui";
import { browserApi, ok } from "@/lib/summit-api";
import { when, type DelegateDetail } from "@/lib/commerce";
import { AreaBox, Feedback, TextBox, useRun } from "./ui";

/** What the desk and the office can do for a delegate: correct the details, resend the badge, check in, cancel. */
export function DelegateActions({ delegate }: { delegate: DelegateDetail }) {
  const { run, busy, error, notice } = useRun();
  const [name, setName] = useState(delegate.fullName);
  const [organisation, setOrganisation] = useState(delegate.organisation);
  const [jobTitle, setJobTitle] = useState(delegate.jobTitle);
  const [reason, setReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const api = browserApi().v1.summit.commerce.delegates[":id"];
  const param = { id: delegate.id };
  const live = delegate.status === "registered";
  const { badge } = delegate;

  return (
    <Card className="space-y-4 p-4 sm:p-5">
      <h2 className="font-display text-xl font-bold text-ink">Badge and attendance</h2>
      <div className={`rounded-md px-3 py-2 text-sm font-semibold ${badge.state === "valid" ? "bg-ok-50 text-ok" : badge.state === "already_checked_in" ? "bg-info-50 text-info" : "bg-danger-50 text-danger"}`}>
        {badge.state === "valid" && "The badge is valid."}
        {badge.state === "already_checked_in" && `Checked in${delegate.checkedInAt ? ` at ${when(delegate.checkedInAt)}` : ""}${delegate.checkedInBy ? ` by ${delegate.checkedInBy.name}` : ""}.`}
        {badge.state === "not_valid" && badge.problems.join(" ")}
      </div>
      {badge.url && (
        <p className="text-sm text-ink-2">
          Badge page:{" "}
          <a href={badge.url} target="_blank" rel="noopener noreferrer" className="font-semibold break-all text-brand-700 underline underline-offset-2">
            {badge.url}
          </a>
        </p>
      )}
      {live && (
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => run("checkin", () => ok(api["check-in"].$post({ param })), "Checked in.")} loading={busy === "checkin"} disabled={badge.state !== "valid"}>
            Check in
          </Button>
          <Button variant="secondary" onClick={() => run("resend", () => ok(api.resend.$post({ param })), "The confirmation was sent again.")} loading={busy === "resend"}>
            Resend confirmation
          </Button>
        </div>
      )}

      {live && (
        <div className="space-y-3 border-t border-line pt-4">
          <h3 className="text-sm font-bold tracking-wide text-ink-2 uppercase">Correct the details</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextBox id="d-name" label="Name on the badge" value={name} onChange={setName} />
            <TextBox id="d-org" label="Organisation" value={organisation} onChange={setOrganisation} />
            <TextBox id="d-title" label="Job title" value={jobTitle} onChange={setJobTitle} />
          </div>
          <Button
            variant="secondary"
            onClick={() => run("save", () => ok(api.$patch({ param, json: { fullName: name.trim(), organisation: organisation.trim(), jobTitle: jobTitle.trim() } })), "Saved.")}
            loading={busy === "save"}
          >
            Save details
          </Button>
        </div>
      )}

      {live && !delegate.checkedInAt && (
        <div className="border-t border-line pt-3">
          <Button variant="ghost" size="sm" onClick={() => setCancelling(!cancelling)}>
            Cancel registration…
          </Button>
          {cancelling && (
            <div className="mt-3 space-y-3 rounded-md border border-line p-3">
              <AreaBox id="d-reason" label="Reason" value={reason} onChange={setReason} rows={2} />
              <Button variant="danger" disabled={reason.trim().length < 2} loading={busy === "cancel"} onClick={() => run("cancel", () => ok(api.cancel.$post({ param, json: { reason: reason.trim() } })), "Cancelled.")}>
                Cancel registration
              </Button>
              <p className="text-xs text-ink-3">An unpaid payment is cancelled with it. A verified payment stays, for you to refund.</p>
            </div>
          )}
        </div>
      )}
      <Feedback error={error} notice={notice} />
    </Card>
  );
}
