"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card } from "@entrust/ui";
import { tradeFetch } from "@/lib/trade-client";
import type { PracticeFact, PracticeScenario } from "@/lib/practice";

const INPUT = "mt-1 block w-full rounded-md border border-line-strong bg-surface px-3 py-2 text-base text-ink sm:text-sm";

/** One scenario and the button that starts it. A scenario on the learner's own deal asks for its product and destination first. */
export function StartPractice({ scenario, facts, organizationId }: { scenario: PracticeScenario; facts: PracticeFact[]; organizationId: string | undefined }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [product, setProduct] = useState("");
  const [destination, setDestination] = useState("");
  const products = facts.find((f) => f.key === "product")?.options ?? [];

  async function start() {
    setBusy(true);
    setError(null);
    const body = { organizationId, scenario: scenario.id, ...(scenario.ownFacts ? { facts: { product, destinationCountry: destination.trim().toUpperCase() } } : {}) };
    const result = await tradeFetch<{ id: string }>("POST", "/practice-cases", body);
    if (!result.ok || !result.data) {
      setError(result.error ?? "The practice case couldn't be started. Please try again.");
      setBusy(false);
      return;
    }
    router.push(`/practice/${result.data.id}`);
  }

  const ready = !scenario.ownFacts || (product && destination.trim().length === 2);

  return (
    <Card className="flex h-full flex-col justify-between gap-4 p-5">
      <div>
        <h3 className="font-display text-base font-bold text-ink">{scenario.title}</h3>
        <p className="mt-1 text-sm text-ink-2">{scenario.summary}</p>
      </div>
      {scenario.ownFacts && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block text-sm font-medium text-ink">
            Your product
            <select value={product} onChange={(e) => setProduct(e.target.value)} className={INPUT}>
              <option value="">Choose one</option>
              {products.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium text-ink">
            Destination country code
            <input value={destination} maxLength={2} placeholder="US" onChange={(e) => setDestination(e.target.value)} className={INPUT} />
          </label>
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <div>
        <Button onClick={() => void start()} disabled={busy || !ready}>
          Start practising
        </Button>
      </div>
    </Card>
  );
}
