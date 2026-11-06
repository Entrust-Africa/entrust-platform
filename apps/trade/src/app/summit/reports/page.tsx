import Link from "next/link";
import { Card } from "@entrust/ui";
import { ok } from "@/lib/summit-api";
import { load, requireUser } from "@/lib/summit-server";
import { isSummitStaff } from "@/lib/summit-staff";
import { LinkButton } from "@/components/summit/link-button";
import { PeriodPicker } from "@/components/summit/staff/period-picker";
import { ReportsPanel } from "@/components/summit/staff/reports-panel";

export const metadata = { title: "Summit reports" };

/** /summit/reports: the Summit's twelve reports, for the people each one is meant for. */
export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ periodId?: string }> }) {
  const path = "/summit/reports";
  const me = await requireUser(path);
  if (!isSummitStaff(me)) {
    return (
      <div className="mx-auto max-w-xl">
        <Card className="space-y-3 p-6">
          <h1 className="font-display text-2xl font-bold text-ink">Only for the Summit team</h1>
          <p className="text-base text-ink-2">The reports are for Entrust staff and the selection committee.</p>
          <LinkButton href="/summit">Back to the Summit</LinkButton>
        </Card>
      </div>
    );
  }
  const { periodId } = await searchParams;
  const [{ items }, periods] = await Promise.all([
    load(path, (api) => ok(api.v1.summit.reports.$get())),
    me.staffRole ? load(path, (api) => ok(api.v1.summit.periods.$get())).then((r) => r.items) : Promise.resolve([]),
  ]);
  return (
    <div className="space-y-6">
      <div>
        <Link href={me.staffRole ? "/summit/review" : "/summit/committee"} className="text-xs font-semibold text-brand-600 hover:underline">
          ← Back
        </Link>
        <h1 className="mt-2 font-display text-3xl font-bold text-ink">Reports</h1>
        <p className="mt-2 max-w-2xl text-base text-ink-2">
          Each report downloads for the application period you pick, the latest by default. What it holds depends on your role: an officer's reports have only the applications assigned to them. Every download is logged.
        </p>
      </div>
      <PeriodPicker basePath="/summit/reports" periods={periods} currentId={periodId ?? periods[0]?.id} />
      <ReportsPanel catalogue={items} periodId={periodId} />
    </div>
  );
}
