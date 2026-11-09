import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, EmptyState, StatusBadge } from "@entrust/ui";
import { getMe } from "@/lib/api";
import { tradeGet } from "@/lib/trade-api";
import type { PublicDiagnosticCounts, PublicDiagnosticPerson } from "@/lib/types";
import { ActivityBars, AvenueSplit } from "@/components/diagnostics/charts";
import { PeopleTable } from "@/components/diagnostics/people-table";

export const metadata = { title: "Onboarding diagnostics" };

const FILTERS = [
  { id: "", label: "All" },
  { id: "submitted", label: "Submitted" },
  { id: "draft", label: "In progress" },
] as const;

function Figure({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-medium text-ink-3">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold tabular-nums text-ink">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-ink-3">{hint}</p>}
    </Card>
  );
}

/** Staff: everyone who has started or submitted the public onboarding diagnostic, how the avenues split, and a CSV of the answers. */
export default async function DiagnosticsPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  const me = await getMe();
  if (!me) redirect("/sign-in");
  if (!me.staffRole) redirect("/");

  const { status = "", q = "" } = await searchParams;
  const filter = status === "submitted" || status === "draft" ? status : "";
  const query = new URLSearchParams({ ...(filter ? { status: filter } : {}), ...(q.trim() ? { q: q.trim() } : {}) });
  const result = await tradeGet<{ items: PublicDiagnosticPerson[]; counts: PublicDiagnosticCounts }>(`/public-diagnostics${query.size ? `?${query}` : ""}`);
  const items = result.data?.items ?? [];
  const counts = result.data?.counts;
  const link = (next: string) => `/diagnostics${next || q.trim() ? `?${new URLSearchParams({ ...(next ? { status: next } : {}), ...(q.trim() ? { q: q.trim() } : {}) })}` : ""}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Onboarding diagnostics</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-2">
            Everyone who started the diagnostic from the public link, one line for each email address. Open a line to see each form they started. Share the link as <span className="font-mono text-ink">/onboarding</span>. No account is needed to fill it in.
          </p>
        </div>
        <a
          href="/diagnostics/export"
          className="inline-flex h-10 items-center rounded-md border border-line-strong bg-surface px-4 text-sm font-semibold text-ink hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-brand-500"
        >
          Export submitted (CSV)
        </a>
      </div>

      {result.data === null ? (
        <Card className="p-6 text-sm text-ink-2">{result.error ?? "The diagnostics couldn't be loaded. Refresh to try again."}</Card>
      ) : (
        <>
          {counts && (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Figure label="Submitted" value={counts.submitted} hint="People with a submitted form" />
                <Figure label="In progress" value={counts.draft} hint="Started, nothing submitted yet" />
                <Figure label="Pathway B, self-reported" value={counts.provisional} hint="No shipment record seen yet" />
                <Figure label="Live order" value={counts.liveOrder} hint="A confirmed order, so M04, M06 and M08 move forward" />
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <Card className="p-5">
                  <AvenueSplit a={counts.pathwayA} b={counts.pathwayB} provisional={counts.provisional} />
                </Card>
                <Card className="p-5">
                  <ActivityBars perDay={counts.perDay} />
                </Card>
              </div>
            </>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <nav aria-label="Filter by status" className="flex gap-1 rounded-lg bg-surface-2 p-1">
              {FILTERS.map((f) => (
                <Link
                  key={f.id}
                  href={link(f.id)}
                  aria-current={filter === f.id ? "page" : undefined}
                  className={`rounded-md px-3 py-1.5 text-sm font-semibold ${filter === f.id ? "bg-surface text-ink shadow-xs" : "text-ink-2 hover:text-ink"}`}
                >
                  {f.label}
                </Link>
              ))}
            </nav>
            <form action="/diagnostics" className="flex gap-2">
              {filter && <input type="hidden" name="status" value={filter} />}
              <input
                type="search"
                name="q"
                defaultValue={q}
                aria-label="Search by business, email or phone"
                placeholder="Search business, email or phone"
                className="h-10 w-60 rounded-md border border-line bg-surface px-3 text-sm text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <button type="submit" className="h-10 rounded-md border border-line-strong bg-surface px-3 text-sm font-semibold text-ink hover:bg-surface-2">
                Search
              </button>
            </form>
          </div>

          {items.length === 0 ? (
            <EmptyState
              title={q.trim() || filter ? "Nothing matches" : "No one has started the diagnostic yet"}
              description={q.trim() || filter ? "Try another search or filter." : "Once you share the link, each person who starts it appears here."}
            />
          ) : (
            <Card className="overflow-hidden p-0">
              <div className="relative overflow-x-auto">
                <PeopleTable people={items} />
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
