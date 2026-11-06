import { Fragment } from "react";
import Link from "next/link";
import { Card, StatusBadge } from "@entrust/ui";
import { countryName } from "@/lib/summit";
import { ok } from "@/lib/summit-api";
import { PATHWAYS, VERIFICATION_CLASSES, labelOf, scoreText, staffAccess, statusOf } from "@/lib/summit-staff";
import { load, requireUser } from "@/lib/summit-server";
import { Decide } from "@/components/summit/staff/decisions";

export const metadata = { title: "Compare Summit applicants" };

const money = (m: { amount: number; currency: string } | null) => (m ? `${m.currency} ${m.amount.toLocaleString("en-GB")}` : "—");

/** /summit/committee/compare?ids=a,b,c: two to five applicants side by side. */
export default async function ComparePage({ searchParams }: { searchParams: Promise<{ ids?: string }> }) {
  const { ids = "" } = await searchParams;
  const path = `/summit/committee/compare?ids=${encodeURIComponent(ids)}`;
  const me = await requireUser(path);
  const access = staffAccess(me);
  const count = ids.split(",").filter(Boolean).length;
  if (!access.selection || count < 2 || count > 5) {
    return (
      <div className="mx-auto max-w-xl">
        <Card className="space-y-3 p-6">
          <h1 className="font-display text-2xl font-bold text-ink">Pick two to five applicants</h1>
          <p className="text-base text-ink-2">Tick the applicants you want to compare on the committee list.</p>
          <Link href="/summit/committee" className="font-semibold text-brand-600 hover:underline">
            Back to the committee list
          </Link>
        </Card>
      </div>
    );
  }
  const { items } = await load(path, (api) => ok(api.v1.summit.committee.compare.$get({ query: { ids } })));
  const categories = items[0]?.categories ?? [];

  const row = (label: string, cell: (i: (typeof items)[number]) => React.ReactNode) => (
    <tr className="align-top">
      <th scope="row" className="w-40 bg-canvas px-4 py-3 text-left text-xs font-semibold text-ink-2">
        {label}
      </th>
      {items.map((i) => (
        <td key={i.id} className="px-4 py-3 text-sm text-ink">
          {cell(i)}
        </td>
      ))}
    </tr>
  );

  return (
    <div className="space-y-6">
      <div>
        <Link href="/summit/committee" className="text-xs font-semibold text-brand-600 hover:underline">
          ← Back to the committee list
        </Link>
        <h1 className="mt-2 font-display text-3xl font-bold text-ink">Compare applicants</h1>
      </div>
      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] border-collapse divide-y divide-line">
            <thead>
              <tr>
                <th className="bg-canvas" />
                {items.map((i) => (
                  <th key={i.id} scope="col" className="px-4 py-3 text-left align-top">
                    <Link href={`/summit/review/${i.id}`} className="font-display text-base font-bold text-ink hover:underline">
                      {i.organizationName}
                    </Link>
                    <div className="text-xs font-normal text-ink-3">
                      {i.number}
                      {i.country ? ` · ${countryName(i.country)}` : ""}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {row("Rank", (i) => i.rank ?? "—")}
              {row("Score", (i) => <span className="font-display text-xl font-bold">{scoreText(i.score)}</span>)}
              {row("Readiness", (i) => (i.readiness === null ? "—" : `${Math.round(i.readiness)}%`))}
              {categories.map((c) => (
                <Fragment key={c.id}>
                  {row(`${c.id}. ${c.title}`, (i) => {
                    const cat = i.categories.find((x) => x.id === c.id);
                    return !cat?.applicable ? <span className="text-ink-3">Does not apply</span> : cat.points === null ? "—" : `${cat.points} of ${cat.maxPoints}`;
                  })}
                </Fragment>
              ))}
              {row("Opportunity", (i) => labelOf(PATHWAYS, i.pathway))}
              {row("Sector", (i) => i.sector ?? "—")}
              {row("Annual revenue", (i) => money(i.profile.annualRevenue))}
              {row("Employees", (i) => i.profile.employees ?? "—")}
              {row("Commercial ask", (i) => i.profile.commercialAsk ?? "—")}
              {row("Ownership", (i) => [i.womanOwned ? "Woman-owned" : null, i.youthOwned ? "Youth-owned" : null].filter(Boolean).join(", ") || "—")}
              {row("Recommendation", (i) => i.recommendation?.label ?? "—")}
              {row("Why", (i) => <span className="whitespace-pre-wrap text-ink-2">{i.rationale ?? "—"}</span>)}
              {row("Claims", (i) =>
                i.verification.length === 0 ? (
                  "—"
                ) : (
                  <ul className="space-y-0.5 text-xs text-ink-2">
                    {i.verification.map((v) => (
                      <li key={v.claim}>
                        {v.label ?? v.claim}: {labelOf(VERIFICATION_CLASSES, v.class)}
                      </li>
                    ))}
                  </ul>
                ),
              )}
              {row("Score adjustments", (i) => i.adjustments)}
              {row("Where it is", (i) => <StatusBadge tone={statusOf(i.status).tone}>{statusOf(i.status).label}</StatusBadge>)}
              {row("Decision so far", (i) => i.decision?.label ?? "—")}
            </tbody>
          </table>
        </div>
      </Card>

      {access.committee && (
        <section aria-labelledby="decide" className="space-y-3">
          <h2 id="decide" className="font-display text-xl font-bold text-ink">
            Record a decision
          </h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {items
              .filter((i) => i.status === "committee_review")
              .map((i) => (
                <div key={i.id} className="space-y-2">
                  <p className="text-sm font-semibold text-ink">{i.organizationName}</p>
                  <Decide applicationId={i.id} />
                </div>
              ))}
          </div>
        </section>
      )}
    </div>
  );
}
