import Link from "next/link";
import { Card, EmptyState } from "@entrust/ui";
import { ok } from "@/lib/summit-api";
import { load, requireUser } from "@/lib/summit-server";
import { REGISTER_VIEWS, isRegisterView } from "@/lib/register";
import { ImportPanel } from "@/components/register/import-panel";
import { amount, READINESS } from "@/components/register/format";
import { FinanceTable, ReadinessTable, RegisterTable, ServicesTable } from "@/components/register/tables";

export const metadata = { title: "SME register" };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const path = "/register";
  const me = await requireUser(path);
  if (!me.staffRole) {
    return (
      <div className="mx-auto max-w-xl py-12">
        <Card className="p-8 text-center">
          <h1 className="font-display text-2xl font-bold text-ink">This page is for Entrust staff</h1>
          <p className="mt-3 text-sm text-ink-2">The register holds what Entrust recorded about each business in the pilot.</p>
        </Card>
      </div>
    );
  }

  const { view: asked } = await searchParams;
  const view = isRegisterView(asked) ? asked : "register";
  const { items, summary } = await load(path, (api) => ok(api.v1.trade.register.$get()));
  const canLoad = me.staffRole === "admin" || me.staffRole === "facilitator";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">SME register</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-2">
          The pilot businesses and their export readiness diagnostic, from Entrust&apos;s workbook. Amounts are in birr. Only Entrust staff see this
          page; a sponsor sees none of it unless the business agrees to share it.
        </p>
      </div>

      {canLoad && <ImportPanel hasRecords={items.length > 0} />}

      {items.length === 0 ? (
        <EmptyState
          title="Nobody is in the register yet"
          description={canLoad ? "Load the diagnostic workbook above to add the pilot businesses." : "An Entrust admin or facilitator loads the diagnostic workbook."}
        />
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Figure label="Businesses" value={String(summary.total)} note={`${summary.assessed} with all five scores`} />
            <Figure
              label="Average export readiness"
              value={summary.averageReadiness === null ? "–" : `${summary.averageReadiness} of 25`}
              note="Of those with all five scores"
            />
            <Figure label="Total capital gap" value={amount(summary.totalCapitalGap)} note="Birr, across the register" />
            <Figure
              label="Finance readiness"
              value={`${summary.byLevel.high} high`}
              note={`${summary.byLevel.medium} ${READINESS.medium.label.toLowerCase()}, ${summary.byLevel.low} ${READINESS.low.label.toLowerCase()}, ${summary.byLevel.notAssessed} not assessed`}
            />
          </dl>

          {summary.banks.length > 0 && (
            <section aria-labelledby="banks">
              <h2 id="banks" className="text-xs font-semibold uppercase tracking-wide text-ink-3">
                Businesses by bank
              </h2>
              <ul className="mt-2 flex flex-wrap gap-2">
                {summary.banks.map((b) => (
                  <li key={b.bank} className="rounded-md border border-line bg-surface px-3 py-1.5 text-sm text-ink">
                    {b.bank} <span className="font-semibold tabular-nums">{b.count}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <nav aria-label="Views of the register" className="flex flex-wrap gap-1">
            {REGISTER_VIEWS.map((v) => (
              <Link
                key={v.id}
                href={v.id === "register" ? "/register" : `/register?view=${v.id}`}
                aria-current={v.id === view ? "page" : undefined}
                className={`inline-flex min-h-[44px] items-center whitespace-nowrap rounded-md px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-brand-500 ${
                  v.id === view ? "bg-brand-50 text-brand-900" : "text-ink-2 hover:bg-canvas hover:text-ink"
                }`}
              >
                {v.label}
              </Link>
            ))}
          </nav>

          {view === "register" && <RegisterTable items={items} />}
          {view === "readiness" && <ReadinessTable items={items} />}
          {view === "finance" && <FinanceTable items={items} />}
          {view === "services" && <ServicesTable items={items} />}
        </>
      )}
    </div>
  );
}

function Figure({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <Card className="p-4">
      <dt className="text-xs font-semibold uppercase tracking-wide text-ink-3">{label}</dt>
      <dd className="mt-1 font-display text-xl font-bold tabular-nums text-ink sm:text-2xl">{value}</dd>
      <dd className="mt-1 text-xs text-ink-3">{note}</dd>
    </Card>
  );
}
