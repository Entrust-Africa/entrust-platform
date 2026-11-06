"use client";

import { useState } from "react";
import Link from "next/link";
import { StatusBadge } from "@entrust/ui";
import { countryName } from "@/lib/summit";
import { PATHWAYS, labelOf, scoreText, statusOf, type CommitteeItem } from "@/lib/summit-staff";

/** The applicants in committee stages, ranked. Two to five can be ticked to compare side by side. */
export function CommitteeTable({ items }: { items: CommitteeItem[] }) {
  const [picked, setPicked] = useState<string[]>([]);
  const toggle = (id: string) => setPicked((now) => (now.includes(id) ? now.filter((x) => x !== id) : now.length < 5 ? [...now, id] : now));
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-canvas px-4 py-2 text-sm">
        <span className="text-ink-2">{picked.length === 0 ? "Tick two to five applicants to compare them." : `${picked.length} ticked.`}</span>
        {picked.length >= 2 ? (
          <Link href={`/summit/committee/compare?ids=${picked.join(",")}`} className="font-semibold text-brand-600 hover:underline">
            Compare {picked.length} →
          </Link>
        ) : (
          <span className="text-ink-3">Compare</span>
        )}
      </div>
      <div className="relative overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line text-xs font-semibold text-ink-2">
            <tr>
              <th className="w-10 px-4 py-3">
                <span className="sr-only">Compare</span>
              </th>
              <th className="px-3 py-3">Rank</th>
              <th className="px-3 py-3">Applicant</th>
              <th className="px-3 py-3">Score</th>
              <th className="px-3 py-3">Readiness</th>
              <th className="px-3 py-3">Officer's recommendation</th>
              <th className="px-3 py-3">Where it is</th>
              <th className="px-3 py-3 text-right">
                <span className="sr-only">Open</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {items.map((a) => {
              const s = statusOf(a.status);
              return (
                <tr key={a.id} className="align-top hover:bg-canvas/50">
                  <td className="px-4 py-3">
                    <input type="checkbox" aria-label={`Compare ${a.organizationName}`} checked={picked.includes(a.id)} onChange={() => toggle(a.id)} />
                  </td>
                  <td className="px-3 py-3 font-display text-lg font-bold text-ink">{a.rank ?? "—"}</td>
                  <td className="px-3 py-3">
                    <div className="font-semibold text-ink">{a.organizationName}</div>
                    <div className="text-xs text-ink-3">
                      {a.number}
                      {a.country ? ` · ${countryName(a.country)}` : ""}
                      {a.sector ? ` · ${a.sector}` : ""}
                    </div>
                    <div className="text-xs text-ink-3">
                      {labelOf(PATHWAYS, a.pathway)}
                      {a.womanOwned ? " · woman-owned" : ""}
                      {a.youthOwned ? " · youth-owned" : ""}
                    </div>
                  </td>
                  <td className="px-3 py-3 font-semibold text-ink">{scoreText(a.score)}</td>
                  <td className="px-3 py-3 text-ink-2">{a.readiness === null ? "—" : `${Math.round(a.readiness)}%`}</td>
                  <td className="px-3 py-3 text-ink-2">{a.recommendation?.label ?? "—"}</td>
                  <td className="px-3 py-3">
                    <StatusBadge tone={s.tone}>{s.label}</StatusBadge>
                    {a.decision && a.status === "committee_review" && <div className="mt-1 text-xs text-ink-3">Last: {a.decision.label}</div>}
                  </td>
                  <td className="px-3 py-3 text-right">
                    <Link href={`/summit/review/${a.id}`} className="font-semibold text-brand-600 hover:underline">
                      Open
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
