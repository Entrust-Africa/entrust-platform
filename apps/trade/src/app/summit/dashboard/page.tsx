import Link from "next/link";
import { Card } from "@entrust/ui";
import { countryName } from "@/lib/summit";
import { ok } from "@/lib/summit-api";
import { OPPORTUNITIES, PATHWAYS, VERIFICATION_CLASSES, labelOf, scoreText, staffAccess } from "@/lib/summit-staff";
import { load, requireUser } from "@/lib/summit-server";
import { LinkButton } from "@/components/summit/link-button";
import { PeriodPicker } from "@/components/summit/staff/period-picker";
import { SelectionTarget } from "@/components/summit/staff/selection-target";

export const metadata = { title: "Summit dashboard" };

function Tile({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <Card className="p-4">
      <dt className="text-xs text-ink-3">{label}</dt>
      <dd className="font-display text-2xl font-bold text-ink">{value}</dd>
      {hint && <p className="text-xs text-ink-3">{hint}</p>}
    </Card>
  );
}

/** /summit/dashboard: the live distribution of applications by stage, country, industry and opportunity, and the selection target. */
export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ periodId?: string }> }) {
  const path = "/summit/dashboard";
  const me = await requireUser(path);
  const access = staffAccess(me);
  if (!access.selection) {
    return (
      <div className="mx-auto max-w-xl">
        <Card className="space-y-3 p-6">
          <h1 className="font-display text-2xl font-bold text-ink">Only for the selection committee</h1>
          <p className="text-base text-ink-2">The dashboard is for the Summit's selection committee, administrators and facilitators.</p>
          <LinkButton href="/summit">Back to the Summit</LinkButton>
        </Card>
      </div>
    );
  }
  const { periodId } = await searchParams;
  const [d, periods] = await Promise.all([
    load(path, (api) => ok(api.v1.summit.dashboard.$get({ query: periodId ? { periodId } : {} }))),
    me.staffRole ? load(path, (api) => ok(api.v1.summit.periods.$get())).then((r) => r.items) : Promise.resolve([]),
  ]);
  const t = d.totals;

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/summit/committee?periodId=${d.period.id}`} className="text-xs font-semibold text-brand-600 hover:underline">
          ← Back to the committee
        </Link>
        <h1 className="mt-2 font-display text-3xl font-bold text-ink">Dashboard: {d.period.name}</h1>
        <p className="mt-1 text-sm text-ink-3">The figures are worked out each time you open this page.</p>
      </div>

      <PeriodPicker basePath="/summit/dashboard" periods={periods} currentId={d.period.id} />

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <Tile label="Applications" value={t.applications} hint={`${t.drafts} still drafts, ${t.withdrawn} withdrawn`} />
        <Tile label="Eligible" value={t.eligible} hint={`${t.ineligible} not eligible, ${t.awaitingInformation} waiting for information`} />
        <Tile label="Under assessment" value={t.underAssessment} />
        <Tile label="Assessed" value={t.assessed} hint={`Average score ${scoreText(t.averageScore)}`} />
        <Tile label="In committee review" value={t.inCommitteeReview} />
        <Tile label="Selected" value={t.selected} />
        <Tile label="Waitlisted" value={t.waitlisted} />
        <Tile label="Not selected" value={t.notSelected} />
      </dl>

      <SelectionTarget dashboard={d} canEdit={access.committee} />

      <Card className="overflow-hidden p-0">
        <h2 className="px-4 pt-4 font-display text-lg font-bold text-ink">By country</h2>
        <div className="overflow-x-auto">
          <table className="mt-2 w-full text-left text-sm">
            <thead className="border-y border-line bg-canvas text-xs font-semibold text-ink-2">
              <tr>
                {["Country", "Applications", "Eligible", "Assessing", "Assessed", "Average score", "Selected", "Waitlisted", "Not selected", "Target", "To go"].map((h) => (
                  <th key={h} className="px-3 py-2.5">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {d.byCountry.map((c) => (
                <tr key={c.country ?? "none"}>
                  <td className="px-3 py-2.5 font-semibold text-ink">{c.country ? countryName(c.country) : "No country"}</td>
                  <td className="px-3 py-2.5">{c.applications}</td>
                  <td className="px-3 py-2.5">{c.eligible}</td>
                  <td className="px-3 py-2.5">{c.underAssessment}</td>
                  <td className="px-3 py-2.5">{c.assessed}</td>
                  <td className="px-3 py-2.5">{scoreText(c.averageScore)}</td>
                  <td className="px-3 py-2.5">{c.selected}</td>
                  <td className="px-3 py-2.5">{c.waitlisted}</td>
                  <td className="px-3 py-2.5">{c.notSelected}</td>
                  <td className="px-3 py-2.5">{c.target}</td>
                  <td className="px-3 py-2.5">{c.remaining}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="space-y-2 p-4">
          <h2 className="font-display text-lg font-bold text-ink">By industry</h2>
          {d.byIndustry.length === 0 ? (
            <p className="text-sm text-ink-3">Nothing yet.</p>
          ) : (
            <ul className="divide-y divide-line text-sm">
              {d.byIndustry.map((i) => (
                <li key={i.sector ?? "none"} className="flex justify-between gap-2 py-1.5">
                  <span className="text-ink">{i.sector ?? "Not given"}</span>
                  <span className="text-ink-2">
                    {i.applications} applied, {i.selected} selected
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="space-y-2 p-4">
          <h2 className="font-display text-lg font-bold text-ink">By opportunity</h2>
          <ul className="divide-y divide-line text-sm">
            {Object.entries(d.byPathway).map(([id, n]) => (
              <li key={id} className="flex justify-between py-1.5">
                <span className="text-ink">{labelOf(PATHWAYS, id)}</span>
                <span className="text-ink-2">{n}</span>
              </li>
            ))}
          </ul>
          <h3 className="pt-2 text-sm font-semibold text-ink">Best suited to (officers' view)</h3>
          <ul className="divide-y divide-line text-sm">
            {Object.entries(d.bySuitableOpportunity).map(([id, n]) => (
              <li key={id} className="flex justify-between py-1.5">
                <span className="text-ink">{labelOf(OPPORTUNITIES, id)}</span>
                <span className="text-ink-2">{n}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="space-y-2 p-4">
          <h2 className="font-display text-lg font-bold text-ink">Ownership</h2>
          <ul className="divide-y divide-line text-sm">
            <li className="flex justify-between py-1.5">
              <span className="text-ink">Woman-owned</span>
              <span className="text-ink-2">
                {d.ownership.womanOwned.applications} applied, {d.ownership.womanOwned.selected} selected
              </span>
            </li>
            <li className="flex justify-between py-1.5">
              <span className="text-ink">Youth-owned</span>
              <span className="text-ink-2">
                {d.ownership.youthOwned.applications} applied, {d.ownership.youthOwned.selected} selected
              </span>
            </li>
          </ul>
        </Card>
        <Card className="space-y-2 p-4">
          <h2 className="font-display text-lg font-bold text-ink">What the claims rest on</h2>
          <p className="text-xs text-ink-3">{d.verification.classifiedApplications} application(s) have claims classified.</p>
          <ul className="divide-y divide-line text-sm">
            {Object.entries(d.verification.byClass).map(([id, n]) => (
              <li key={id} className="flex justify-between py-1.5">
                <span className="text-ink">{labelOf(VERIFICATION_CLASSES, id)}</span>
                <span className="text-ink-2">{n}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
