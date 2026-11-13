"use client";

import { useState } from "react";
import { Button, Card } from "@entrust/ui";
import { browserApi, ok } from "@/lib/summit-api";
import type { BookingDetail } from "@/lib/commerce";
import { AreaBox, Feedback, Labeled, TextBox, useRun } from "./ui";
import { staffInput } from "@/components/form-runner/styles";

/** What can be done to an exhibitor application, in the order it is done: approve, give a booth, confirm. */
export function BookingActions({ booking, zones }: { booking: BookingDetail; zones: string[] }) {
  const { run, busy, error, notice } = useRun();
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const [booth, setBooth] = useState(booking.boothNumber ?? "");
  const [zone, setZone] = useState(booking.zone ?? "");
  const [open, setOpen] = useState<"reject" | "cancel" | null>(null);
  const api = browserApi().v1.summit.commerce["exhibitor-bookings"][":id"];
  const param = { id: booking.id };
  const status = booking.status;
  const held = status === "approved" || status === "confirmed";

  return (
    <Card className="space-y-4 p-4 sm:p-5">
      <h2 className="font-display text-xl font-bold text-ink">Decision and booth</h2>

      {status === "submitted" && (
        <div className="space-y-3">
          <p className="text-sm text-ink-2">
            Approving holds one {booking.packageName} for this exhibitor and emails them the payment instructions.
            {booking.packageAvailability.soldOut && <strong className="text-danger"> This package has no booth left.</strong>}
          </p>
          <AreaBox id="approve-note" label="Message to the applicant (optional)" value={note} onChange={setNote} rows={2} />
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => run("approve", () => ok(api.approve.$post({ param, json: { note: note.trim() || undefined } })), "Approved. The exhibitor has the payment instructions.")} loading={busy === "approve"} disabled={booking.packageAvailability.soldOut}>
              Approve application
            </Button>
            <Button variant="secondary" onClick={() => setOpen(open === "reject" ? null : "reject")}>
              Reject
            </Button>
          </div>
        </div>
      )}

      {held && (
        <div className="space-y-3">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextBox id="booth-number" label="Booth number" value={booth} onChange={setBooth} placeholder="A-12" />
            {zones.length > 0 ? (
              <Labeled label="Zone" htmlFor="booth-zone">
                <select id="booth-zone" value={zone} onChange={(e) => setZone(e.target.value)} className={staffInput(false)}>
                  <option value="">No zone</option>
                  {zones.map((z) => (
                    <option key={z} value={z}>
                      {z}
                    </option>
                  ))}
                </select>
              </Labeled>
            ) : (
              <TextBox id="booth-zone" label="Zone" value={zone} onChange={setZone} placeholder="Hall A" />
            )}
          </div>
          <Button
            variant="secondary"
            onClick={() => run("allocate", () => ok(browserApi().v1.summit.commerce["exhibitor-bookings"][":id"].allocation.$put({ param, json: { boothNumber: booth.trim() || null, zone: zone.trim() || null } })), "Booth saved.")}
            loading={busy === "allocate"}
          >
            Save booth
          </Button>
        </div>
      )}

      {status === "approved" && (
        <div className="space-y-2 rounded-md bg-surface-2 p-3">
          <p className="text-sm font-semibold text-ink">Confirm the booth</p>
          {booking.blockers.length > 0 ? (
            <ul className="list-disc space-y-1 pl-5 text-sm text-ink-2">
              {booking.blockers.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-2">Everything is in place. Confirming emails the exhibitor their booking confirmation.</p>
          )}
          <Button onClick={() => run("confirm", () => ok(api.confirm.$post({ param })), "Booth confirmed. The exhibitor has their confirmation.")} loading={busy === "confirm"} disabled={booking.blockers.length > 0}>
            Confirm booth
          </Button>
        </div>
      )}

      {status === "confirmed" && <p className="text-sm text-ok">This booth is confirmed. The exhibitor has their booking confirmation.</p>}
      {(status === "rejected" || status === "cancelled") && <p className="text-sm text-ink-2">This application is {status}.{booking.decisionNote ? ` Reason: ${booking.decisionNote}` : ""}</p>}

      {(status === "approved" || status === "confirmed") && (
        <div className="border-t border-line pt-3">
          <Button variant="ghost" size="sm" onClick={() => setOpen(open === "cancel" ? null : "cancel")}>
            Cancel booking…
          </Button>
        </div>
      )}

      {open && (
        <div className="space-y-3 rounded-md border border-line p-3">
          <AreaBox id="reason" label={open === "reject" ? "Reason (sent to the applicant)" : "Reason"} value={reason} onChange={setReason} rows={2} />
          {open === "reject" ? (
            <Button variant="danger" disabled={reason.trim().length < 2} loading={busy === "reject"} onClick={() => run("reject", () => ok(api.reject.$post({ param, json: { reason: reason.trim() } })), "Rejected. The applicant has been told.")}>
              Reject application
            </Button>
          ) : (
            <Button variant="danger" disabled={reason.trim().length < 2} loading={busy === "cancel"} onClick={() => run("cancel", () => ok(api.cancel.$post({ param, json: { reason: reason.trim() } })), "Cancelled. The booth is released.")}>
              Cancel booking
            </Button>
          )}
        </div>
      )}
      <Feedback error={error} notice={notice} />
    </Card>
  );
}
