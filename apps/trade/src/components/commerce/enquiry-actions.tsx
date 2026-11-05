"use client";

import { useState } from "react";
import { Button, Card } from "@entrust/ui";
import { browserApi, ok } from "@/lib/summit-api";
import { ENQUIRY_LOOK, ENQUIRY_ORDER, centsToInput, toCents, type EnquiryDetail } from "@/lib/commerce";
import { AreaBox, Feedback, TextBox, useRun } from "./ui";

/** Moves a sponsorship enquiry along the pipeline and records its value and the team's notes. */
export function EnquiryActions({ enquiry }: { enquiry: EnquiryDetail }) {
  const { run, busy, error, notice, setError } = useRun();
  const [value, setValue] = useState(centsToInput(enquiry.valueCents));
  const [notes, setNotes] = useState(enquiry.notes ?? "");
  const [note, setNote] = useState("");
  const api = browserApi().v1.summit.commerce["sponsor-enquiries"][":id"];
  const param = { id: enquiry.id };
  const confirmed = enquiry.status === "confirmed";

  async function saveDetails() {
    const cents = toCents(value);
    if (!confirmed && cents === null) return setError("Type the value in dollars, like 6250.");
    const json: { valueCents?: number; notes?: string | null } = { notes: notes.trim() || null };
    if (!confirmed && cents !== null) json.valueCents = cents;
    await run("save", () => ok(api.$patch({ param, json })), "Saved.");
  }

  return (
    <Card className="space-y-4 p-4 sm:p-5">
      <h2 className="font-display text-xl font-bold text-ink">Pipeline</h2>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Move this enquiry to">
        {ENQUIRY_ORDER.map((s) => {
          const current = enquiry.status === s;
          return (
            <Button
              key={s}
              variant={current ? "primary" : "secondary"}
              size="sm"
              disabled={current}
              aria-pressed={current}
              loading={busy === s}
              onClick={() => run(s, () => ok(api.status.$post({ param, json: { status: s, ...(note.trim() ? { note: note.trim() } : {}) } })), s === "confirmed" ? "Confirmed. The sponsor has the payment instructions." : "Moved.")}
            >
              {ENQUIRY_LOOK[s]?.label ?? s}
            </Button>
          );
        })}
      </div>
      <TextBox id="status-note" label="Note for this move (optional)" hint="Kept in the history." value={note} onChange={setNote} />
      <p className="text-xs text-ink-3">Confirming opens a payment for the value and emails the sponsor the payment instructions. It is refused if the level has no place left.</p>

      <div className="border-t border-line pt-4">
        <TextBox id="value" label="Value of the sponsorship (USD)" hint={confirmed ? "Confirmed: change the amount owed on the payment instead." : "Starts as the listed price; change it if the deal is negotiated."} value={value} onChange={setValue} />
        <div className="mt-3">
          <AreaBox id="notes" label="Notes (for the team only)" value={notes} onChange={setNotes} rows={3} />
        </div>
        <div className="mt-3">
          <Button variant="secondary" onClick={saveDetails} loading={busy === "save"}>
            Save value and notes
          </Button>
        </div>
      </div>
      <Feedback error={error} notice={notice} />
    </Card>
  );
}
