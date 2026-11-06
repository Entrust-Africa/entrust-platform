import Link from "next/link";
import { Card, StatusBadge } from "@entrust/ui";
import { ok } from "@/lib/summit-api";
import { countryName, formatDate } from "@/lib/summit";
import { PATHWAYS, STATUS_FILTERS, labelOf, staffAccess, statusOf } from "@/lib/summit-staff";
import { load, requireUser } from "@/lib/summit-server";
import { LinkButton } from "@/components/summit/link-button";
import { AssignOfficer } from "@/components/summit/staff/assign-officer";

export const metadata = { title: "Summit applications" };

const ELIGIBILITY: Record<string, { label: string; tone: "ok" | "danger" | "warn" }> = {
  eligible: { label: "Eligible", tone: "ok" },
  ineligible: { label: "Not eligible", tone: "danger" },
  pending_clarification: { label: "Needs information", tone: "warn" },
};

/** /summit/review: the applications Entrust staff can open. An officer sees the ones assigned to them; administrators and facilitators see all. */
export default async function ReviewQueuePage({ searchParams }: { searchParams: Promise<{ status?: string; pathway?: string }> }) {
  const path = "/summit/review";
  const me = await requireUser(path);
  const access = staffAccess(me);
  if (!me.staffRole) {
    return (
      <div className="mx-auto max-w-xl">
        <Card className="space-y-3 p-6">
          <h1 className="font-display text-2xl font-bold text-ink">Only for Entrust staff</h1>
          <p className="text-base text-ink-2">The review screens are for the Entrust team that assesses Summit applications.</p>
          <LinkButton href="/summit">Back to the Summit</LinkButton>
        </Card>
      </div>
    );
  }

  const { status, pathway } = await searchParams;
  const query = {
    ...(status ? { status } : {}),
    ...(pathway && PATHWAYS.some((p) => p.id === pathway) ? { pathway: pathway as (typeof PATHWAYS)[number]["id"] } : {}),
    limit: "200",
  };
  const [list, officers] = await Promise.all([
    load(path, (api) => ok(api.v1.summit.applications.$get({ query }))),
    access.admin ? load(path, (api) => ok(api.v1.summit.officers.$get())) : Promise.resolve(null),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-bold tracking-wider text-brand-600 uppercase">Summit</p>
        <h1 className="mt-1 font-display text-3xl font-bold text-ink">Applications</h1>
        <p className="mt-2 max-w-2xl text-base text-ink-2">
          {access.allApplications
            ? "Every application sent in. Assign each eligible one to an assessment officer, then follow it to the committee."
            : "The applications assigned to you. Open one to score it, check the claims and write your recommendation."}
        </p>
      </div>

      <Card className="p-4">
        <form className="flex flex-wrap items-end gap-3" action="/summit/review">
          <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
            Status
            <select name="status" defaultValue={status ?? ""} className="h-10 rounded-md border border-line-strong bg-surface px-2 text-sm font-normal">
              <option value="">All</option>
              {STATUS_FILTERS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
            Opportunity
            <select name="pathway" defaultValue={pathway ?? ""} className="h-10 rounded-md border border-line-strong bg-surface px-2 text-sm font-normal">
              <option value="">All</option>
              {PATHWAYS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="h-10 rounded-md border border-line-strong bg-surface px-4 text-sm font-semibold text-ink hover:bg-surface-2">
            Filter
          </button>
          {(status || pathway) && (
            <Link href="/summit/review" className="pb-2.5 text-sm font-semibold text-brand-600 hover:underline">
              Clear
            </Link>
          )}
        </form>
      </Card>

      {list.items.length === 0 ? (
        <Card className="mx-auto max-w-xl p-8 text-center">
          <h2 className="font-display text-lg font-bold text-ink">Nothing here yet</h2>
          <p className="mt-2 text-sm text-ink-2">{status || pathway ? "No application matches these filters." : "No application has been sent in yet."}</p>
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="relative overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line bg-canvas text-xs font-semibold text-ink-2">
                <tr>
                  <th className="px-4 py-3">Application</th>
                  <th className="px-4 py-3">Opportunity</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Eligibility</th>
                  <th className="px-4 py-3">Officer</th>
                  <th className="px-4 py-3">Sent</th>
                  <th className="px-4 py-3 text-right">
                    <span className="sr-only">Open</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {list.items.map((a) => {
                  const s = statusOf(a.status);
                  const e = a.eligibility ? ELIGIBILITY[a.eligibility] : undefined;
                  return (
                    <tr key={a.id} className="align-top hover:bg-canvas/50">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-ink">{a.organizationName}</div>
                        <div className="font-mono text-xs text-ink-3">
                          {a.number}
                          {a.country ? ` · ${countryName(a.country)}` : ""}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-ink-2">{labelOf(PATHWAYS, a.pathway)}</td>
                      <td className="px-4 py-3">
                        <StatusBadge tone={s.tone}>{s.label}</StatusBadge>
                      </td>
                      <td className="px-4 py-3">
                        {e ? <StatusBadge tone={e.tone}>{e.label}</StatusBadge> : <span className="text-ink-3">—</span>}
                        {a.missingDocuments > 0 && <div className="mt-1 text-xs text-ink-3">{a.missingDocuments} document(s) missing</div>}
                      </td>
                      <td className="px-4 py-3">
                        {officers ? (
                          <AssignOfficer applicationId={a.id} officers={officers.items} currentUserId={a.officer?.id ?? null} />
                        ) : (
                          <span className="text-ink-2">{a.officer?.name ?? "—"}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-ink-2">{a.submittedAt ? formatDate(a.submittedAt) : "—"}</td>
                      <td className="px-4 py-3 text-right">
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
          <p className="border-t border-line px-4 py-2 text-xs text-ink-3">
            Showing {list.items.length} of {list.total}.
          </p>
        </Card>
      )}
    </div>
  );
}
