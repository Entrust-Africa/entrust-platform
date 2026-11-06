import Link from "next/link";
import { Card } from "@entrust/ui";
import { ok } from "@/lib/summit-api";
import { PATHWAYS, RECOMMENDATIONS, staffAccess } from "@/lib/summit-staff";
import { load, requireUser } from "@/lib/summit-server";
import { LinkButton } from "@/components/summit/link-button";
import { CommitteeTable } from "@/components/summit/staff/committee-table";
import { FinalList } from "@/components/summit/staff/final-list";
import { PeriodPicker } from "@/components/summit/staff/period-picker";

export const metadata = { title: "Summit committee" };

type Params = { periodId?: string; country?: string; sector?: string; pathway?: string; recommendation?: string; status?: string; minScore?: string; q?: string; sort?: string; woman?: string; youth?: string };

const COMMITTEE_STATUSES = [
  { id: "committee_review", label: "In committee review" },
  { id: "selected", label: "Selected" },
  { id: "waitlisted", label: "Waitlisted" },
  { id: "not_selected", label: "Not selected" },
];
const SORTS = [
  { id: "rank", label: "Rank" },
  { id: "score", label: "Score" },
  { id: "readiness", label: "Readiness" },
  { id: "name", label: "Name" },
  { id: "country", label: "Country" },
];

const field = "h-10 rounded-md border border-line-strong bg-surface px-2 text-sm font-normal";

/** /summit/committee: the applicants in committee stages, to compare and filter, and the final list. */
export default async function CommitteePage({ searchParams }: { searchParams: Promise<Params> }) {
  const path = "/summit/committee";
  const me = await requireUser(path);
  const access = staffAccess(me);
  if (!access.selection) {
    return (
      <div className="mx-auto max-w-xl">
        <Card className="space-y-3 p-6">
          <h1 className="font-display text-2xl font-bold text-ink">Only for the selection committee</h1>
          <p className="text-base text-ink-2">These screens are for the Summit's selection committee and the Entrust administrators and facilitators who run the selection.</p>
          <LinkButton href="/summit">Back to the Summit</LinkButton>
        </Card>
      </div>
    );
  }

  const p = await searchParams;
  const query = {
    ...(p.periodId ? { periodId: p.periodId } : {}),
    ...(p.country ? { country: p.country.trim().toUpperCase().slice(0, 2) } : {}),
    ...(p.sector ? { sector: p.sector } : {}),
    ...(p.pathway && PATHWAYS.some((x) => x.id === p.pathway) ? { pathway: p.pathway as (typeof PATHWAYS)[number]["id"] } : {}),
    ...(p.recommendation ? { recommendation: p.recommendation } : {}),
    ...(p.status ? { status: p.status as "committee_review" } : {}),
    ...(p.minScore ? { minScore: p.minScore } : {}),
    ...(p.q ? { q: p.q } : {}),
    ...(p.woman ? { womanOwned: "true" as const } : {}),
    ...(p.youth ? { youthOwned: "true" as const } : {}),
    sort: (SORTS.some((s) => s.id === p.sort) ? p.sort : "rank") as "rank",
    limit: "200",
  };
  const [list, periods] = await Promise.all([
    load(path, (api) => ok(api.v1.summit.committee.applications.$get({ query }))),
    me.staffRole ? load(path, (api) => ok(api.v1.summit.periods.$get())).then((r) => r.items) : Promise.resolve([]),
  ]);
  const finalList = list.period ? await load(path, (api) => ok(api.v1.summit.periods[":id"]["final-list"].$get({ param: { id: list.period!.id } }))) : null;
  const filtered = Object.keys(p).some((k) => k !== "periodId" && p[k as keyof Params]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold tracking-wider text-brand-600 uppercase">Summit</p>
          <h1 className="mt-1 font-display text-3xl font-bold text-ink">Selection committee</h1>
          <p className="mt-2 max-w-2xl text-base text-ink-2">{list.period ? `${list.period.name}. ` : ""}Compare the applicants the officers have recommended, record a decision with its reason, then approve the final list.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <LinkButton href={list.period ? `/summit/dashboard?periodId=${list.period.id}` : "/summit/dashboard"} variant="secondary">
            Dashboard
          </LinkButton>
          <LinkButton href={list.period ? `/summit/reports?periodId=${list.period.id}` : "/summit/reports"} variant="secondary">
            Reports
          </LinkButton>
        </div>
      </div>

      <PeriodPicker basePath="/summit/committee" periods={periods} currentId={list.period?.id} />

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {COMMITTEE_STATUSES.map((s) => (
          <Card key={s.id} className="p-4">
            <dt className="text-xs text-ink-3">{s.label}</dt>
            <dd className="font-display text-2xl font-bold text-ink">{list.counts[s.id] ?? 0}</dd>
          </Card>
        ))}
      </dl>

      <Card className="p-4">
        <form action="/summit/committee" className="flex flex-wrap items-end gap-3">
          {p.periodId && <input type="hidden" name="periodId" value={p.periodId} />}
          <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
            Search
            <input name="q" defaultValue={p.q ?? ""} placeholder="Name, number or SME ID" className={`${field} w-52`} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
            Country
            <input name="country" defaultValue={p.country ?? ""} maxLength={2} placeholder="KE" className={`${field} w-20 uppercase`} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
            Sector
            <input name="sector" defaultValue={p.sector ?? ""} className={`${field} w-40`} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
            Opportunity
            <select name="pathway" defaultValue={p.pathway ?? ""} className={field}>
              <option value="">All</option>
              {PATHWAYS.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
            Recommendation
            <select name="recommendation" defaultValue={p.recommendation ?? ""} className={field}>
              <option value="">All</option>
              {RECOMMENDATIONS.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
            Where it is
            <select name="status" defaultValue={p.status ?? ""} className={field}>
              <option value="">All</option>
              {COMMITTEE_STATUSES.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
            Lowest score
            <input name="minScore" type="number" min={0} max={100} defaultValue={p.minScore ?? ""} className={`${field} w-24`} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
            Sort by
            <select name="sort" defaultValue={p.sort ?? "rank"} className={field}>
              {SORTS.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 pb-2.5 text-sm text-ink">
            <input type="checkbox" name="woman" value="1" defaultChecked={Boolean(p.woman)} /> Woman-owned
          </label>
          <label className="flex items-center gap-2 pb-2.5 text-sm text-ink">
            <input type="checkbox" name="youth" value="1" defaultChecked={Boolean(p.youth)} /> Youth-owned
          </label>
          <button type="submit" className="h-10 rounded-md border border-line-strong bg-surface px-4 text-sm font-semibold text-ink hover:bg-surface-2">
            Filter
          </button>
          {filtered && (
            <Link href={p.periodId ? `/summit/committee?periodId=${p.periodId}` : "/summit/committee"} className="pb-2.5 text-sm font-semibold text-brand-600 hover:underline">
              Clear
            </Link>
          )}
        </form>
      </Card>

      {list.items.length === 0 ? (
        <Card className="mx-auto max-w-xl p-8 text-center">
          <h2 className="font-display text-lg font-bold text-ink">Nobody to show</h2>
          <p className="mt-2 text-sm text-ink-2">{filtered ? "No applicant matches these filters." : "No application has reached the committee yet. They appear here once an administrator approves an officer's assessment."}</p>
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <CommitteeTable items={list.items} />
          <p className="border-t border-line px-4 py-2 text-xs text-ink-3">
            Showing {list.items.length} of {list.total}.
          </p>
        </Card>
      )}

      {finalList && <FinalList list={finalList} canApprove={access.committee} />}
    </div>
  );
}
