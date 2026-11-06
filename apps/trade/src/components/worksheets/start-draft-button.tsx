"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@entrust/ui";
import { browserApi, errorText, ok } from "@/lib/summit-api";

/** Opens a worksheet's draft: the one in progress, or a new one (the next version starts from the last submitted). */
export function StartDraftButton({ worksheetId, enrollmentId, label, variant = "primary" }: { worksheetId: string; enrollmentId?: string; label: string; variant?: "primary" | "secondary" }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  async function open() {
    setBusy(true);
    setError(undefined);
    try {
      const draft = await ok(browserApi().v1.trade.worksheets[":id"].draft.$post({ param: { id: worksheetId }, json: enrollmentId ? { enrollmentId } : {} }));
      router.push(`/worksheets/versions/${draft.id}`);
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  }
  return (
    <div className="space-y-1">
      <Button variant={variant} loading={busy} onClick={open}>
        {label}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
