"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@entrust/ui";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { textArea } from "@/components/form-runner/styles";
import { browserApi, errorText, ok } from "@/lib/summit-api";

/** Withdraws the application after the person confirms. It cannot be undone. */
export function WithdrawButton({ applicationId }: { applicationId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  async function withdraw() {
    setPending(true);
    setError(undefined);
    try {
      await ok(
        browserApi().v1.summit.applications[":id"].withdraw.$post({
          param: { id: applicationId },
          json: reason.trim() ? { reason: reason.trim() } : {},
        }),
      );
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Button variant="secondary" size="lg" className="w-full text-danger sm:w-auto" onClick={() => setOpen(true)}>
        Withdraw my application
      </Button>
      <ConfirmDialog
        open={open}
        title="Withdraw your application?"
        confirmLabel="Yes, withdraw it"
        tone="danger"
        busy={pending}
        error={error}
        onConfirm={() => void withdraw()}
        onCancel={() => setOpen(false)}
      >
        <p>This cannot be undone. Your application will be taken out of the Summit selection. You can start a new one while applications are open.</p>
        <label htmlFor="withdraw-reason" className="block pt-2 text-sm font-semibold text-ink">
          Why are you withdrawing? (optional)
        </label>
        <textarea id="withdraw-reason" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={1000} rows={3} className={textArea(false)} />
      </ConfirmDialog>
    </>
  );
}
