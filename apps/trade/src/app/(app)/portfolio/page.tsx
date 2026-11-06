import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, StatusBadge } from "@entrust/ui";
import { getMe } from "@/lib/api";
import { tradeGet } from "@/lib/trade-api";
import { dayText, type WorksheetSummaryList } from "@/lib/worksheets";

export const metadata = { title: "Portfolio" };

export default async function PortfolioPage() {
  const me = await getMe();
  if (!me) redirect("/sign-in");
  const organizationId = !me.staffRole ? (me.activeOrganizationId ?? me.organizations?.[0]?.id) : undefined;
  // The newest submitted version of each worksheet is kept here, as it was submitted.
  const worksheets = organizationId ? await tradeGet<WorksheetSummaryList>(`/worksheets?organizationId=${encodeURIComponent(organizationId)}`) : null;
  const submitted = worksheets?.data?.items.filter((w) => w.latest) ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">Evidence Portfolio</h1>
        <p className="mt-1 text-sm text-ink-2">Your submitted worksheets, verified company records, export documentation, and compliance evidence.</p>
      </div>

      {submitted.length > 0 && (
        <section aria-labelledby="worksheets" className="space-y-3">
          <h2 id="worksheets" className="font-display text-lg font-bold text-ink">
            Worksheets you have submitted
          </h2>
          <ul className="grid gap-3 md:grid-cols-2">
            {submitted.map((w) => (
              <li key={w.id}>
                <Card className="flex h-full flex-col justify-between gap-2 p-4">
                  <div>
                    <p className="font-mono text-xs font-semibold text-brand-700">{w.module}</p>
                    <h3 className="font-display text-base font-bold text-ink">{w.title}</h3>
                    <p className="text-xs text-ink-3">
                      Version {w.latest!.version}, submitted {dayText(w.latest!.submittedAt.slice(0, 10))}
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <StatusBadge tone="idle">Self-reported</StatusBadge>
                    <Link href={`/worksheets/versions/${w.latest!.id}`} className="text-sm font-semibold text-brand-600 hover:underline">
                      Read
                    </Link>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Card className="mx-auto mt-6 max-w-xl p-8 text-center">
        <h2 className="font-display text-lg font-bold text-ink">{submitted.length > 0 ? "No evidence records yet" : "Portfolio is empty"}</h2>
        <p className="mt-2 text-sm text-ink-2">As you progress through your learning plan, submit evidence records here for staff verification.</p>
      </Card>
    </div>
  );
}
