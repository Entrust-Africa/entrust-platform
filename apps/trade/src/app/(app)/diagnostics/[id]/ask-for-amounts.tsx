"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card } from "@entrust/ui";
import { tradeFetch } from "@/lib/trade-client";

const formatDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

/**
 * Until 12 November 2026 the diagnostic's amount boxes were too narrow to show what was typed, so a submission's amounts
 * may have been typed blind, or given as "I don't know" because the box seemed broken. This emails the business a new
 * private link that asks only for the amounts. The rest of the form and its avenue stay as they are.
 */
export function AskForAmounts({
  diagnosticId,
  email,
  requestedAt,
  correctedAt,
}: {
  diagnosticId: string;
  email: string;
  requestedAt: string | null;
  correctedAt: string | null;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function ask() {
    setBusy(true);
    setError(null);
    const res = await tradeFetch("POST", `/public-diagnostics/${diagnosticId}/request-amounts`);
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setConfirming(false);
    router.refresh();
  }

  const state = correctedAt
    ? `The business sent its amounts again on ${formatDate(correctedAt)}. The amounts below are the new ones.`
    : requestedAt
      ? `Asked on ${formatDate(requestedAt)}. The business hasn't sent them yet.`
      : null;

  return (
    <Card className="space-y-3 p-5">
      <h2 className="font-display text-lg font-bold text-ink">Amounts</h2>
      <p className="text-sm text-ink-2">
        Until 12 November the form&apos;s amount boxes were too narrow to show what was typed, so these amounts may be wrong or given as
        &quot;I don&apos;t know&quot;. You can email the business a new private link that asks only for the amounts. Nothing else in the
        form, and not its avenue, changes.
      </p>
      {state && <p className="text-sm font-semibold text-ink">{state}</p>}
      {confirming ? (
        <div className="space-y-3 rounded-md bg-surface-2 p-3">
          <p className="text-sm text-ink">
            This emails {email} a new private link. The link they have now stops working.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void ask()} loading={busy}>
              Send the email
            </Button>
            <Button variant="secondary" onClick={() => setConfirming(false)} disabled={busy}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="secondary" onClick={() => setConfirming(true)}>
          {requestedAt && !correctedAt ? "Ask again" : "Ask for the amounts again"}
        </Button>
      )}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </Card>
  );
}
