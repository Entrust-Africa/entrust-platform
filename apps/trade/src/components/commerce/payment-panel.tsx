"use client";

import { useState } from "react";
import { ExternalLink, Paperclip } from "lucide-react";
import { Button, Card, uploadFile } from "@entrust/ui";
import { staffInput } from "@/components/form-runner/styles";
import { apiUrl, browserApi, errorText, ok } from "@/lib/summit-api";
import { PAYMENT_LOOK, centsToInput, toCents, usd, when, type Payment } from "@/lib/commerce";
import { Feedback, KeyValues, Labeled, Pill, TextBox, useRun } from "./ui";
import { openInNewTab } from "@/lib/upload";

export interface PaymentPanelProps {
  payment: Payment;
  /** The edition's payment methods, to choose from. */
  methods: { id: string; label: string }[];
  /** Entrust's own organisation: proof of payment is a file kept there. */
  entrustOrganizationId: string | null;
  /** Only an administrator changes what is owed. */
  isAdmin: boolean;
}

const ACCEPT = "application/pdf,image/jpeg,image/png";

/**
 * A payment: what is owed, what arrived, the reference and the proof, and the moves open to it. A payment is marked paid
 * only here, by a person, after looking at the proof; nothing else in the system does it.
 */
export function PaymentPanel({ payment, methods, entrustOrganizationId, isAdmin }: PaymentPanelProps) {
  const { run, busy, error, notice } = useRun();
  const [reference, setReference] = useState(payment.reference ?? "");
  const [method, setMethod] = useState(payment.method ?? "");
  const [received, setReceived] = useState(payment.amountReceivedCents === null ? "" : centsToInput(payment.amountReceivedCents));
  const [due, setDue] = useState(centsToInput(payment.amountDueCents));
  const [note, setNote] = useState(payment.note ?? "");
  const [localError, setLocalError] = useState<string>();
  const [uploading, setUploading] = useState<number | null>(null);

  const api = browserApi().v1.summit.commerce.payments[":id"];
  const status = payment.status;
  const locked = status === "refunded";

  function body() {
    const out: Record<string, unknown> = {};
    if (reference.trim() !== (payment.reference ?? "")) out.reference = reference.trim() || null;
    if (method !== (payment.method ?? "")) out.method = method || null;
    if (note.trim() !== (payment.note ?? "")) out.note = note.trim() || null;
    if (received.trim() !== (payment.amountReceivedCents === null ? "" : centsToInput(payment.amountReceivedCents))) {
      const cents = received.trim() === "" ? null : toCents(received);
      if (received.trim() !== "" && cents === null) throw new Error("Type the amount received in dollars, like 500 or 62.50.");
      out.amountReceivedCents = cents;
    }
    if (isAdmin && due.trim() !== centsToInput(payment.amountDueCents)) {
      const cents = toCents(due);
      if (cents === null) throw new Error("Type the amount due in dollars, like 500 or 62.50.");
      out.amountDueCents = cents;
    }
    return out;
  }

  async function save(to?: "confirmed" | "cancelled" | "refunded" | "pending") {
    setLocalError(undefined);
    let json: Record<string, unknown>;
    try {
      json = { ...body(), ...(to ? { status: to } : {}) };
    } catch (e) {
      return setLocalError(errorText(e));
    }
    if (Object.keys(json).length === 0) return setLocalError("Nothing has changed.");
    await run(to ?? "save", () => ok(api.$patch({ param: { id: payment.id }, json: json as never })), to === "confirmed" ? "Payment verified." : "Saved.");
  }

  async function attach(file: File) {
    if (!entrustOrganizationId) return setLocalError("Your account isn't in the Entrust organisation, so it can't store proof of payment.");
    setLocalError(undefined);
    setUploading(0);
    try {
      const uploaded = await uploadFile(file, {
        apiUrl,
        organizationId: entrustOrganizationId,
        onProgress: (p) => setUploading(Math.round(p)),
        fetchFn: (input, init) => fetch(input, { ...init, credentials: "include" }),
      });
      await run("evidence", () => ok(api.$patch({ param: { id: payment.id }, json: { evidenceFileId: uploaded.id } })), "Proof attached.");
    } catch (e) {
      setLocalError(errorText(e));
    } finally {
      setUploading(null);
    }
  }

  async function open() {
    setLocalError(undefined);
    const problem = await openInNewTab(async () => {
      try {
        const link = await ok(browserApi().v1.summit.commerce.payments[":id"]["evidence-url"].$get({ param: { id: payment.id } }));
        return { url: link.downloadUrl };
      } catch (e) {
        return { error: errorText(e) };
      }
    });
    if (problem) setLocalError(problem);
  }

  return (
    <Card className="space-y-4 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-xl font-bold text-ink">Payment</h2>
        <Pill look={PAYMENT_LOOK[status]} />
      </div>
      <KeyValues
        rows={[
          ["Amount due (USD)", usd(payment.amountDueCents)],
          ["Amount received", payment.amountReceivedCents === null ? "Not recorded" : usd(payment.amountReceivedCents)],
          ["Verified", payment.verifiedBy ? `${payment.verifiedBy.name}, ${when(payment.verifiedAt)}` : null],
        ]}
      />

      {!locked && (
        <div className="grid gap-4 sm:grid-cols-2">
          <TextBox id={`pay-ref-${payment.id}`} label="Payment reference" hint="The bank or transaction reference the payer gave." value={reference} onChange={setReference} />
          <Labeled label="Payment method" htmlFor={`pay-method-${payment.id}`}>
            <select id={`pay-method-${payment.id}`} value={method} onChange={(e) => setMethod(e.target.value)} className={staffInput(false)}>
              <option value="">Not recorded</option>
              {methods.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
              {method && !methods.some((m) => m.id === method) && <option value={method}>{method}</option>}
            </select>
          </Labeled>
          <TextBox id={`pay-recv-${payment.id}`} label="Amount received (USD)" hint="What actually arrived." value={received} onChange={setReceived} />
          {isAdmin && <TextBox id={`pay-due-${payment.id}`} label="Amount due (USD)" hint="Administrators only." value={due} onChange={setDue} />}
          <div className="sm:col-span-2">
            <TextBox id={`pay-note-${payment.id}`} label="Note" value={note} onChange={setNote} />
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {payment.evidence ? (
          <Button variant="secondary" size="sm" onClick={open}>
            <ExternalLink aria-hidden className="size-4" /> View proof: {payment.evidence.name}
          </Button>
        ) : (
          <span className="text-sm text-ink-3">No proof attached.</span>
        )}
        {!locked && (
          <label className="inline-flex h-8 cursor-pointer items-center gap-2 rounded-md border border-line-strong bg-surface px-3 text-sm font-semibold text-ink hover:bg-surface-2">
            <Paperclip aria-hidden className="size-4" />
            {uploading === null ? (payment.evidence ? "Replace proof" : "Attach proof") : `Uploading ${uploading}%`}
            <input
              type="file"
              accept={ACCEPT}
              className="sr-only"
              disabled={uploading !== null}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) void attach(file);
              }}
            />
          </label>
        )}
      </div>

      <Feedback error={localError ?? error} notice={notice} />

      {!locked && (
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => save()} loading={busy === "save"}>
            Save details
          </Button>
          {(status === "pending" || status === "awaiting_verification") && (
            <Button onClick={() => save("confirmed")} loading={busy === "confirmed"}>
              Verify and confirm payment
            </Button>
          )}
          {status === "confirmed" && (
            <Button variant="danger" onClick={() => save("refunded")} loading={busy === "refunded"}>
              Mark as refunded
            </Button>
          )}
          {(status === "pending" || status === "awaiting_verification") && (
            <Button variant="ghost" onClick={() => save("cancelled")} loading={busy === "cancelled"}>
              Cancel payment
            </Button>
          )}
          {status === "cancelled" && (
            <Button variant="secondary" onClick={() => save("pending")} loading={busy === "pending"}>
              Reopen
            </Button>
          )}
        </div>
      )}
      <p className="text-xs text-ink-3">Confirming needs a reference or proof, and an amount received that covers the amount due. Nothing marks a payment as paid except this button.</p>
    </Card>
  );
}
