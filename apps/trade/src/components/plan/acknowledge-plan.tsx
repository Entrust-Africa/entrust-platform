"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card } from "@entrust/ui";
import { tradeFetch } from "@/lib/trade-client";

/** The SME confirms it has read its learning plan. */
export function AcknowledgePlan({ planId }: { planId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function acknowledge() {
    setBusy(true);
    setError(null);
    const result = await tradeFetch("POST", `/plans/${planId}/acknowledge`);
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? "That didn't save. Please try again.");
      return;
    }
    router.refresh();
  }

  return (
    <Card className="border-l-4 border-l-brand-600 p-5">
      <h2 className="font-display text-lg font-bold text-ink">Your learning plan is ready</h2>
      <p className="mt-1 text-sm text-ink-2">Read through the modules below and the reasons they were chosen, then confirm you've seen them.</p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button onClick={() => void acknowledge()} disabled={busy}>
          I've read my plan
        </Button>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
      </div>
    </Card>
  );
}
