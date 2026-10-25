import Form from "next/form";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Button, Card, StatusBadge, cn } from "@entrust/ui";
import { serverApi } from "@/lib/api";
import { countryName, productLabel, readable } from "@/lib/catalogue";
import { CASE_STATUSES, NEXT_ACTIONS, PHASES } from "@/lib/statuses";
import { SelectField } from "./cases/inputs";

export const metadata = { title: "Export cases" };

const PAGE_SIZE = 20;
const isCaseStatus = (s: string | undefined): s is keyof typeof CASE_STATUSES => !!s && s in CASE_STATUSES;

export default async function CasesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; phase?: string; page?: string }>;
}) {
  const params = await searchParams;
  const status = isCaseStatus(params.status) ? params.status : undefined;
  const phase = PHASES.some((p) => String(p.n) === params.phase) ? params.phase : undefined;
  const page = Math.max(1, Math.floor(Number(params.page)) || 1);

  const res = await (await serverApi()).v1.clear.cases.$get({
    query: { status, phase, limit: String(PAGE_SIZE), offset: String((page - 1) * PAGE_SIZE) },
  });
  if (res.status === 401) redirect("/sign-in");
  if (!res.ok) throw new Error(`The case list didn't load (${res.status}).`);
  const { items, total } = await res.json();
  const filtered = status !== undefined || phase !== undefined;
  const pageLink = (n: number) => `/?${new URLSearchParams({ ...(status && { status }), ...(phase && { phase }), page: String(n) })}`;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold">Export cases</h1>
          <p className="mt-1 text-sm text-ink-2">
            {total === 1 ? "1 case" : `${total} cases`}
            {filtered && " match the filters"}
          </p>
        </div>
        <Link
          href="/cases/new"
          className="inline-flex h-10 items-center rounded-md bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700"
        >
          New case
        </Link>
      </div>

      <Form action="/" className="mt-6 flex flex-wrap items-end gap-3">
        <SelectField
          label="Status"
          name="status"
          defaultValue={status ?? ""}
          placeholder="Any status"
          options={Object.entries(CASE_STATUSES).map(([value, s]) => ({ value, label: s.label }))}
          className="w-44"
        />
        <SelectField
          label="Phase"
          name="phase"
          defaultValue={phase ?? ""}
          placeholder="Any phase"
          options={PHASES.map((p) => ({ value: String(p.n), label: `${p.n}. ${p.title}` }))}
          className="w-64 max-w-full"
        />
        <Button type="submit" variant="secondary">
          Filter
        </Button>
        {filtered && (
          <Link href="/" className="h-10 content-center text-sm font-semibold text-brand-600 underline-offset-4 hover:underline">
            Clear filters
          </Link>
        )}
      </Form>

      {items.length === 0 ? (
        <Card className="mt-6 px-6 py-12 text-center">
          <p className="font-display text-lg font-bold">{filtered ? "No cases match these filters" : "No export cases yet"}</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-ink-2">
            {filtered
              ? "Try another status or phase."
              : "Open a case for an export: its product and destination decide the steps and requirements it gets."}
          </p>
        </Card>
      ) : (
        <ul className="mt-6 flex flex-col gap-4">
          {items.map((c) => {
            const caseStatus = CASE_STATUSES[c.status];
            return (
              <li key={c.id}>
                <Card className="overflow-hidden transition-colors duration-150 hover:border-line-strong">
                  <Link href={`/cases/${c.id}`} className="block">
                    <div className="flex flex-wrap items-start justify-between gap-3 p-4 sm:p-6">
                      <div className="min-w-0">
                        <p className="font-mono text-xs text-ink-3">
                          {c.reference} · {c.organizationName}
                        </p>
                        <h2 className="mt-1 font-display text-lg font-bold">
                          {productLabel(c.product)} → {countryName(c.destinationCountry)}
                        </h2>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {c.openFlags > 0 && (
                          <StatusBadge tone="danger">{c.openFlags === 1 ? "1 open flag" : `${c.openFlags} open flags`}</StatusBadge>
                        )}
                        <StatusBadge tone={caseStatus.tone}>{caseStatus.label}</StatusBadge>
                      </div>
                    </div>
                    <ol className="grid grid-cols-7 gap-1 px-4 sm:px-6" aria-label={`Phase ${c.currentPhase} of 7`}>
                      {PHASES.map((p) => (
                        <li
                          key={p.n}
                          title={`Phase ${p.n}: ${p.title}`}
                          className={cn(
                            "h-1.5 rounded-full",
                            p.n < c.currentPhase ? "bg-ok" : p.n === c.currentPhase ? "bg-product" : "bg-line",
                          )}
                        />
                      ))}
                    </ol>
                    <p className="mt-5 border-t border-line bg-surface-2 px-4 py-3 text-sm sm:px-6">
                      <span className="font-semibold">Phase {c.currentPhase}</span>
                      {c.nextAction ? (
                        <>
                          {" · next: "}
                          {NEXT_ACTIONS[c.nextAction.kind]} {c.nextAction.stepId}. {readable(c.nextAction.detail)}
                        </>
                      ) : (
                        " · nothing waiting"
                      )}
                    </p>
                  </Link>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {total > PAGE_SIZE && (
        <nav className="mt-6 flex items-center justify-between gap-4 text-sm" aria-label="Pages">
          {page > 1 ? (
            <Link href={pageLink(page - 1)} className="font-semibold text-brand-600 underline-offset-4 hover:underline">
              Newer cases
            </Link>
          ) : (
            <span />
          )}
          <span className="text-ink-3">
            Page {page} of {Math.ceil(total / PAGE_SIZE)}
          </span>
          {page * PAGE_SIZE < total ? (
            <Link href={pageLink(page + 1)} className="font-semibold text-brand-600 underline-offset-4 hover:underline">
              Older cases
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </>
  );
}
