"use client";

import { useState } from "react";
import { Card } from "@entrust/ui";
import { tradeFetch } from "@/lib/trade-client";

export interface ConsentKind {
  kind: string;
  label: string;
  description: string;
  wording: string;
  granted: boolean;
  consentId: string | null;
  grantedAt: string | null;
}
export interface ConsentData {
  organizationId: string;
  canChange: boolean;
  disclaimer: string;
  sponsors: { sponsor: { id: string; name: string }; cohorts: string[]; kinds: ConsentKind[] }[];
}

export function ConsentManager({ initial }: { initial: ConsentData }) {
  const [data, setData] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function change(sponsorId: string, kind: ConsentKind) {
    setBusy(`${sponsorId}:${kind.kind}`);
    setError(null);
    const result = kind.granted
      ? await tradeFetch<ConsentData>("POST", `/consents/${kind.consentId}/withdraw`)
      : await tradeFetch<ConsentData>("POST", "/consents", { organizationId: data.organizationId, sponsorOrganizationId: sponsorId, kinds: [kind.kind] });
    setBusy(null);
    if (result.data) setData(result.data);
    else setError(result.error);
  }

  return (
    <div className="space-y-6">
      {error && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      )}
      {!data.canChange && (
        <p className="rounded-lg border border-line bg-surface p-3 text-sm text-ink-2">
          Only the owner of your organisation can change what is shared. You can see what is shared now.
        </p>
      )}
      {data.sponsors.map(({ sponsor, cohorts, kinds }) => (
        <Card key={sponsor.id} className="p-4 sm:p-6">
          <h2 className="font-display text-lg font-bold text-ink">{sponsor.name}</h2>
          <p className="mt-1 text-sm text-ink-2">Sponsors {cohorts.join(", ")}. Turn on only what you are happy for them to see.</p>
          <ul className="mt-4 divide-y divide-line">
            {kinds.map((kind) => {
              const id = `${sponsor.id}-${kind.kind}`;
              return (
                <li key={kind.kind} className="py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <label htmlFor={id} className="block font-semibold text-ink">
                        {kind.label}
                      </label>
                      <p className="mt-1 text-sm text-ink-2">{kind.description}</p>
                      {kind.granted && kind.grantedAt && (
                        <p className="mt-1 text-xs text-ink-3">Shared since {new Date(kind.grantedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</p>
                      )}
                      <details className="mt-2 text-sm text-ink-2">
                        <summary className="cursor-pointer text-xs font-semibold text-brand-600">What you agree to</summary>
                        <p className="mt-2 leading-relaxed">{kind.wording}</p>
                      </details>
                    </div>
                    <input
                      id={id}
                      type="checkbox"
                      role="switch"
                      className="mt-1 size-6 shrink-0 accent-brand-600"
                      checked={kind.granted}
                      disabled={!data.canChange || busy === `${sponsor.id}:${kind.kind}`}
                      onChange={() => void change(sponsor.id, kind)}
                      aria-label={`Share ${kind.label.toLowerCase()} with ${sponsor.name}`}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      ))}
      <p className="text-xs leading-relaxed text-ink-3">{data.disclaimer}</p>
    </div>
  );
}
