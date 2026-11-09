"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, StatusBadge } from "@entrust/ui";
import { tradeFetch } from "@/lib/trade-client";
import { CONSENT_LABEL, DESTINATION_LABEL, KIND_LABEL, type Referral } from "./referral-types";

/** The business's side of a referral: what would be shared, with whom and why, and the choice to agree, decline or take its consent back. */
export function ReferralConsent({ initial, isOwner }: { initial: Referral[]; isOwner: boolean }) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const decide = async (id: string, decision: "grant" | "decline" | "withdraw") => {
    setBusy(true);
    setError(null);
    const res = await tradeFetch<Referral>("POST", `/referrals/${id}/consent`, { decision });
    setBusy(false);
    if (!res.ok || !res.data) return setError(res.error);
    setItems((all) => all.map((r) => (r.id === id ? res.data! : r)));
    router.refresh();
  };

  if (items.length === 0) return null;
  return (
    <section aria-labelledby="referrals" className="space-y-3">
      <h2 id="referrals" className="font-display text-lg font-bold text-ink">Referrals to partners</h2>
      <p className="max-w-2xl text-sm text-ink-2">Entrust may refer you to a bank, an insurer or a service provider. Nothing about your business is shared unless you agree here, and you can take your agreement back at any time.</p>
      {error && <p role="alert" className="rounded-md bg-danger-50 px-3 py-2 text-sm font-medium text-danger">{error}</p>}
      <Card className="divide-y divide-line">
        {items.map((r) => (
          <div key={r.id} className="space-y-2 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-ink">{r.destinationName} <span className="font-normal text-ink-3">({DESTINATION_LABEL[r.destinationType]})</span></p>
              <StatusBadge tone={r.consentStatus === "granted" ? "ok" : r.consentStatus === "requested" ? "warn" : "idle"}>{CONSENT_LABEL[r.consentStatus]}</StatusBadge>
            </div>
            <p className="text-sm text-ink-2">Why: {r.reason}</p>
            <p className="text-sm text-ink-2">They would receive: {r.sharedDataKinds.map((k) => KIND_LABEL[k] ?? k).join(", ") || "nothing about your business"}.</p>
            {r.outcome && <p className="text-xs text-ink-2">Outcome: {r.outcome}</p>}
            {isOwner && r.consentStatus === "requested" && (
              <div className="flex flex-wrap gap-2 pt-1">
                <Button size="sm" disabled={busy} onClick={() => void decide(r.id, "grant")}>I agree to share this with {r.destinationName}</Button>
                <Button size="sm" variant="secondary" disabled={busy} onClick={() => void decide(r.id, "decline")}>No, don't share</Button>
              </div>
            )}
            {isOwner && r.consentStatus === "granted" && (
              <Button size="sm" variant="secondary" disabled={busy} onClick={() => void decide(r.id, "withdraw")}>Take my agreement back</Button>
            )}
            {!isOwner && r.consentStatus === "requested" && <p className="text-xs text-ink-3">An owner of your business needs to decide this.</p>}
          </div>
        ))}
      </Card>
    </section>
  );
}
