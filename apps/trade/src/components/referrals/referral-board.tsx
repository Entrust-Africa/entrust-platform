"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Field, StatusBadge } from "@entrust/ui";
import { tradeFetch } from "@/lib/trade-client";
import { CONSENT_LABEL, DESTINATION_LABEL, KIND_LABEL, type Referral } from "./referral-types";

const select = "h-10 w-full rounded-md border border-line-strong bg-surface px-3 text-sm text-ink";

/** Staff: refer a business to a bank, insurer or service provider, ask for its consent, release what it agreed to, and follow the outcome. */
export function ReferralBoard({ initial, canWrite, forBusiness }: { initial: Referral[]; canWrite: boolean; forBusiness: { id: string; name: string } | null }) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState({ destinationName: "", destinationType: "bank", reason: "", kinds: ["profile"] as string[] });
  const [pack, setPack] = useState<Record<string, unknown> | null>(null);

  const reload = async () => {
    const res = await tradeFetch<{ items: Referral[] }>("GET", "/referrals");
    if (res.data) setItems(res.data.items);
    router.refresh();
  };
  const run = async (action: () => Promise<{ ok: boolean; error: string | null }>, done: string) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    const res = await action();
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setNotice(done);
    await reload();
  };

  return (
    <div className="space-y-6">
      {error && <p role="alert" className="rounded-md bg-danger-50 px-3 py-2 text-sm font-medium text-danger">{error}</p>}
      {notice && <p role="status" className="rounded-md bg-ok-50 px-3 py-2 text-sm font-medium text-ok">{notice}</p>}

      {canWrite && forBusiness && (
        <Card className="space-y-4 p-4 sm:p-5">
          <h2 className="font-display text-lg font-bold text-ink">Refer {forBusiness.name}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Partner" value={draft.destinationName} onChange={(e) => setDraft({ ...draft, destinationName: e.target.value })} />
            <div className="flex flex-col gap-1.5">
              <label htmlFor="destination-type" className="text-sm font-semibold text-ink">Kind of partner</label>
              <select id="destination-type" className={select} value={draft.destinationType} onChange={(e) => setDraft({ ...draft, destinationType: e.target.value })}>
                {Object.entries(DESTINATION_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
          </div>
          <Field label="Why are you referring them?" value={draft.reason} onChange={(e) => setDraft({ ...draft, reason: e.target.value })} />
          <fieldset>
            <legend className="text-sm font-semibold text-ink">What would the business be asked to share?</legend>
            <div className="mt-2 flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-2">
              {Object.entries(KIND_LABEL).map(([kind, label]) => (
                <label key={kind} className="flex items-center gap-2">
                  <input type="checkbox" checked={draft.kinds.includes(kind)} onChange={(e) => setDraft({ ...draft, kinds: e.target.checked ? [...draft.kinds, kind] : draft.kinds.filter((k) => k !== kind) })} />
                  {label}
                </label>
              ))}
            </div>
            <p className="mt-2 text-xs text-ink-3">Nothing is shared until the business agrees to this partner, for this reason and these kinds of information.</p>
          </fieldset>
          <Button disabled={!draft.destinationName.trim() || !draft.reason.trim()} loading={busy} onClick={() => void run(() => tradeFetch("POST", "/referrals", { organizationId: forBusiness.id, destinationName: draft.destinationName, destinationType: draft.destinationType, reason: draft.reason, sharedDataKinds: draft.kinds }), "Referral saved as a draft.")}>
            Save referral
          </Button>
        </Card>
      )}

      <Card className="divide-y divide-line">
        {items.length === 0 && <p className="p-4 text-sm text-ink-2">No referrals yet. Start one from a business on a cohort.</p>}
        {items.map((r) => (
          <div key={r.id} className="space-y-2 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-ink">
                {r.organizationName} → {r.destinationName} <span className="font-normal text-ink-3">({DESTINATION_LABEL[r.destinationType]})</span>
              </p>
              <div className="flex flex-wrap gap-2">
                <StatusBadge tone={r.consentStatus === "granted" ? "ok" : r.consentStatus === "requested" ? "warn" : r.consentStatus === "not_requested" ? "idle" : "danger"}>{CONSENT_LABEL[r.consentStatus]}</StatusBadge>
                <StatusBadge tone="info">{r.status.replaceAll("_", " ")}</StatusBadge>
              </div>
            </div>
            <p className="text-sm text-ink-2">{r.reason}</p>
            <p className="text-xs text-ink-3">Would share: {r.sharedDataKinds.map((k) => KIND_LABEL[k] ?? k).join(", ") || "nothing about the business"}{r.responsible ? ` · Responsible: ${r.responsible}` : ""}</p>
            {r.outcome && <p className="text-xs text-ink-2">Outcome: {r.outcome}</p>}
            {canWrite && (
              <div className="flex flex-wrap gap-2 pt-1">
                {["draft", "awaiting_consent"].includes(r.status) && r.consentStatus !== "granted" && (
                  <Button size="sm" variant="secondary" disabled={busy} onClick={() => void run(() => tradeFetch("POST", `/referrals/${r.id}/request-consent`), "The business has been asked.")}>
                    {r.consentStatus === "requested" ? "Ask again" : "Ask for consent"}
                  </Button>
                )}
                {r.consentStatus === "granted" && ["ready", "shared"].includes(r.status) && (
                  <Button size="sm" disabled={busy} onClick={() => void run(async () => {
                    const res = await tradeFetch<Record<string, unknown>>("POST", `/referrals/${r.id}/release`);
                    if (res.ok && res.data) setPack(res.data);
                    return res;
                  }, "Released. The package is below; it is recorded in the referral's history.")}>
                    Release what was agreed
                  </Button>
                )}
                {r.status === "shared" && (
                  <>
                    <Button size="sm" variant="secondary" disabled={busy} onClick={() => void run(() => tradeFetch("POST", `/referrals/${r.id}/status`, { status: "accepted" }), "Marked accepted.")}>Partner accepted</Button>
                    <Button size="sm" variant="secondary" disabled={busy} onClick={() => void run(() => tradeFetch("POST", `/referrals/${r.id}/status`, { status: "declined" }), "Marked declined.")}>Partner declined</Button>
                  </>
                )}
                {r.status === "accepted" && (
                  <Button size="sm" variant="secondary" disabled={busy} onClick={() => {
                    const outcome = window.prompt("What was the outcome?");
                    if (outcome) void run(() => tradeFetch("POST", `/referrals/${r.id}/status`, { status: "completed", outcome }), "Marked completed.");
                  }}>
                    Mark completed
                  </Button>
                )}
              </div>
            )}
          </div>
        ))}
      </Card>

      {pack && (
        <Card className="space-y-2 p-4">
          <h2 className="font-display text-lg font-bold text-ink">Released information</h2>
          <p className="text-xs text-ink-3">Only what the business agreed to. Pass it on to {String(pack.destinationName)} yourself; TRADE sends nothing to partners.</p>
          <pre className="max-h-96 overflow-auto rounded-md bg-surface-2 p-3 text-xs text-ink">{JSON.stringify(pack, null, 2)}</pre>
          <Button size="sm" variant="secondary" onClick={() => setPack(null)}>Hide</Button>
        </Card>
      )}
    </div>
  );
}
