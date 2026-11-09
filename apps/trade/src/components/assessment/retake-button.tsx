"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card } from "@entrust/ui";
import { tradeFetch } from "@/lib/trade-client";
import { KINDS, type AssessmentKind } from "./kinds";

/**
 * Starts the assessment again. The earlier one is kept with its answers and marked superseded when the new one is started, so
 * nothing about the first is lost, and the two can be compared.
 */
export function RetakeButton({ kind, organizationId }: { kind: AssessmentKind; organizationId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const info = KINDS[kind];

  async function retake() {
    setBusy(true);
    setError(null);
    const res = await tradeFetch<{ id: string }>("POST", "/assessments", { kind, organizationId, retake: true });
    if (res.data) {
      router.push(`${info.route}/${res.data.id}`);
      return;
    }
    setBusy(false);
    setError(res.error ?? "Something went wrong. Try again.");
  }

  return (
    <Card className="mx-auto max-w-xl space-y-3 p-5">
      <h2 className="text-sm font-semibold text-ink">Has something changed?</h2>
      <p className="text-sm text-ink-2">You can take this again if your business has changed. Your earlier answers are kept, and Entrust can compare the two.</p>
      {confirming ? (
        <div className="space-y-2">
          <p className="text-sm text-ink">Start a new {info.title.toLowerCase()}? Your current result stays until you submit the new one.</p>
          <div className="flex gap-2">
            <Button onClick={() => void retake()} loading={busy}>Yes, start again</Button>
            <Button variant="secondary" onClick={() => setConfirming(false)}>Not now</Button>
          </div>
        </div>
      ) : (
        <Button variant="secondary" onClick={() => setConfirming(true)}>Take it again</Button>
      )}
      {error && <p role="alert" className="text-sm font-medium text-danger">{error}</p>}
    </Card>
  );
}
