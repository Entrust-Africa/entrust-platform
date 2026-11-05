"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card } from "@entrust/ui";
import { tradeFetch } from "@/lib/trade-client";
import { KINDS, type AssessmentKind } from "./kinds";

/** The first page of a form that hasn't been started: what it is for, and a button that makes the draft. */
export function AssessmentStart({ kind, organizationId }: { kind: AssessmentKind; organizationId: string }) {
  const info = KINDS[kind];
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setError(null);
    const result = await tradeFetch<{ id: string }>("POST", "/assessments", { kind, organizationId });
    if (result.data) {
      router.push(`${info.route}/${result.data.id}`);
      return;
    }
    setBusy(false);
    setError(
      result.status === 422
        ? "Your business isn't enrolled in a TRADE cohort yet. Once Entrust enrols you, come back to this page."
        : (result.error ?? "Something went wrong. Try again."),
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">{info.title}</h1>
        {info.intro.map((line) => (
          <p key={line} className="mt-2 text-sm leading-relaxed text-ink-2">
            {line}
          </p>
        ))}
      </div>
      <Card className="p-5">
        <Button onClick={() => void start()} disabled={busy} className="w-full sm:w-auto">
          {busy ? "Starting…" : info.startButton}
        </Button>
        {error && (
          <p role="alert" className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            {error}
          </p>
        )}
      </Card>
    </div>
  );
}
