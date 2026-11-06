import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, StatusBadge } from "@entrust/ui";
import { getMe } from "@/lib/api";
import { tradeGet } from "@/lib/trade-api";
import { dayText, type WorksheetSummaryList } from "@/lib/worksheets";

export const metadata = { title: "Worksheets" };

/** /worksheets: the structured forms an SME fills in as it learns. */
export default async function WorksheetsPage() {
  const me = await getMe();
  if (!me) redirect("/sign-in");
  const organizationId = me.activeOrganizationId ?? me.organizations?.[0]?.id;
  if (me.staffRole || !organizationId) {
    return (
      <div className="mx-auto max-w-xl py-12">
        <Card className="p-8 text-center">
          <h1 className="font-display text-xl font-bold text-ink">Worksheets</h1>
          <p className="mt-3 text-sm text-ink-2">{me.staffRole ? "SMEs fill in their worksheets from their own account." : "Choose your business using the switcher above."}</p>
        </Card>
      </div>
    );
  }
  const list = await tradeGet<WorksheetSummaryList>(`/worksheets?organizationId=${encodeURIComponent(organizationId)}`);
  if (!list.data) {
    return (
      <div className="mx-auto max-w-xl py-12">
        <Card className="p-8 text-center">
          <h1 className="font-display text-xl font-bold text-ink">Worksheets</h1>
          <p className="mt-3 text-sm text-ink-2">{list.error ?? "Your worksheets aren't available yet."}</p>
        </Card>
      </div>
    );
  }
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">Worksheets</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-2">
          Short forms that work out your numbers as you type. Your figures save as you go. When you submit one, that version is kept as it is, and you can start a new one to change it.
        </p>
      </div>
      <ul className="grid gap-4 md:grid-cols-2">
        {list.data.items.map((w) => (
          <li key={w.id}>
            <Card className="flex h-full flex-col justify-between gap-3 p-5">
              <div className="space-y-1">
                <p className="font-mono text-xs font-semibold text-brand-700">{w.module}</p>
                <h2 className="font-display text-lg font-bold text-ink">{w.title}</h2>
                <p className="text-sm text-ink-2">{w.description}</p>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap gap-2">
                  {w.latest && <StatusBadge tone="ok">{`Version ${w.latest.version} submitted ${dayText(w.latest.submittedAt.slice(0, 10))}`}</StatusBadge>}
                  {w.draft && <StatusBadge tone="warn">{`Draft of version ${w.draft.version}`}</StatusBadge>}
                  {!w.latest && !w.draft && <StatusBadge tone="idle">Not started</StatusBadge>}
                </div>
                <Link href={`/worksheets/${w.id}`} className="text-sm font-semibold text-brand-600 hover:underline">
                  Open
                </Link>
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
