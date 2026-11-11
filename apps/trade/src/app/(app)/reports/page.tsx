import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, EmptyState } from "@entrust/ui";
import { getMe } from "@/lib/api";
import { tradeGet } from "@/lib/trade-api";
import { ReportView, type ProgrammeReport } from "@/components/reports/report-view";

export const metadata = { title: "Reports" };

interface Choice {
  kind: "program" | "cohort";
  id: string;
  label: string;
}

const pathFor = (choice: Pick<Choice, "kind" | "id">) => `/reports/${choice.kind === "program" ? "programs" : "cohorts"}/${encodeURIComponent(choice.id)}`;

/**
 * What the caller can report on: every programme and cohort for Entrust staff and the Quality role, the cohorts it
 * sponsors for a sponsor.
 */
async function loadChoices(seesEverything: boolean): Promise<Choice[]> {
  if (seesEverything) {
    const [programs, cohorts] = await Promise.all([
      tradeGet<{ programs: { id: string; name: string }[] }>("/programs"),
      tradeGet<{ cohorts: { id: string; name: string; programName: string }[] }>("/cohorts"),
    ]);
    return [
      ...(programs.data?.programs ?? []).map((p) => ({ kind: "program" as const, id: p.id, label: `${p.name} (whole programme)` })),
      ...(cohorts.data?.cohorts ?? []).map((c) => ({ kind: "cohort" as const, id: c.id, label: `${c.programName}: ${c.name}` })),
    ];
  }
  const sponsored = await tradeGet<{ items: { id: string; name: string; program: string }[] }>("/sponsor/cohorts");
  return (sponsored.data?.items ?? []).map((c) => ({ kind: "cohort" as const, id: c.id, label: `${c.program}: ${c.name}` }));
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ program?: string; cohort?: string; pathway?: string; moduleId?: string; cohortId?: string }> }) {
  const me = await getMe();
  if (!me) redirect("/sign-in");
  const { program, cohort, pathway, moduleId, cohortId } = await searchParams;
  const isStaff = Boolean(me.staffRole);
  // Quality reads every cohort's reports, as staff do, and isn't a sponsor (it has no /sponsor/cohorts).
  const choices = await loadChoices(isStaff || Boolean(me.quality));
  const asked = cohort ? choices.find((c) => c.kind === "cohort" && c.id === cohort) : program ? choices.find((c) => c.kind === "program" && c.id === program) : undefined;
  const selected = asked ?? choices[0];
  // Filters the page can narrow a report to. Anything else in the address is ignored. A sponsor sees each cohort it
  // sponsors whole: narrowing by pathway or cohort would give away which businesses are where, so it has the module only.
  const canSplit = isStaff || Boolean(me.quality);
  const filters = new URLSearchParams();
  if (canSplit && (pathway === "A" || pathway === "B")) filters.set("pathway", pathway);
  if (moduleId && /^M\d{2}$/.test(moduleId)) filters.set("moduleId", moduleId);
  if (canSplit && selected?.kind === "program" && cohortId && /^[0-9a-f-]{36}$/i.test(cohortId)) filters.set("cohortId", cohortId);
  const report = selected ? await tradeGet<ProgrammeReport>(`${pathFor(selected)}${filters.size ? `?${filters}` : ""}`) : null;
  const cohortsOfProgramme = selected?.kind === "program" ? choices.filter((c) => c.kind === "cohort") : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold text-ink">Programme reports</h1>
          <p className="mt-1 text-sm text-ink-2">Who took part, what capabilities improved and what commercial results followed.</p>
        </div>
        {isStaff && selected && (
          <div className="flex flex-wrap gap-2">
            {(["xlsx", "pdf", "csv"] as const).map((format) => (
              <a
                key={format}
                href={`/reports/export?kind=${selected.kind}&id=${encodeURIComponent(selected.id)}&format=${format}${filters.size ? `&${filters}` : ""}`}
                className="inline-flex h-10 items-center rounded-md border border-line-strong bg-surface px-4 text-sm font-semibold text-ink hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-brand-500"
              >
                Export ({format === "xlsx" ? "Excel" : format.toUpperCase()})
              </a>
            ))}
          </div>
        )}
      </div>

      {choices.length === 0 ? (
        <EmptyState
          title="Nothing to report on yet"
          description={isStaff || me.quality ? "Create a programme and a cohort, and their figures appear here as businesses work through TRADE." : "When Entrust names your organisation as the sponsor of a cohort, its report appears here."}
        />
      ) : (
        <>
          <nav aria-label="Choose a report" className="flex flex-wrap gap-2">
            {choices.map((choice) => {
              const current = selected?.kind === choice.kind && selected.id === choice.id;
              return (
                <Link
                  key={`${choice.kind}-${choice.id}`}
                  href={`/reports?${choice.kind}=${encodeURIComponent(choice.id)}`}
                  aria-current={current ? "page" : undefined}
                  className={`rounded-md border px-3 py-1.5 text-sm font-medium ${current ? "border-brand-600 bg-brand-50 text-brand-700" : "border-line text-ink-2 hover:bg-surface-2"}`}
                >
                  {choice.label}
                </Link>
              );
            })}
          </nav>
          {selected && (
            <form method="get" action="/reports" className="flex flex-wrap items-end gap-3 rounded-md border border-line bg-surface p-3" aria-label="Narrow the report">
              <input type="hidden" name={selected.kind} value={selected.id} />
              {canSplit && (
                <label className="text-xs font-semibold text-ink-3">
                  Pathway
                  <select name="pathway" defaultValue={filters.get("pathway") ?? ""} className="mt-1 block h-9 rounded-md border border-line bg-surface px-2 text-sm text-ink">
                    <option value="">Both</option>
                    <option value="A">Pathway A</option>
                    <option value="B">Pathway B</option>
                  </select>
                </label>
              )}
              <label className="text-xs font-semibold text-ink-3">
                Module
                <select name="moduleId" defaultValue={filters.get("moduleId") ?? ""} className="mt-1 block h-9 rounded-md border border-line bg-surface px-2 text-sm text-ink">
                  <option value="">All modules</option>
                  {Array.from({ length: 12 }, (_, i) => `M${String(i + 1).padStart(2, "0")}`).map((id) => (
                    <option key={id} value={id}>{id}</option>
                  ))}
                </select>
              </label>
              {canSplit && cohortsOfProgramme.length > 0 && (
                <label className="text-xs font-semibold text-ink-3">
                  Cohort
                  <select name="cohortId" defaultValue={filters.get("cohortId") ?? ""} className="mt-1 block h-9 rounded-md border border-line bg-surface px-2 text-sm text-ink">
                    <option value="">All cohorts</option>
                    {cohortsOfProgramme.map((c) => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>
                </label>
              )}
              <button type="submit" className="inline-flex h-9 items-center rounded-md bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-brand-500">Apply</button>
              {filters.size > 0 && <Link href={`/reports?${selected.kind}=${encodeURIComponent(selected.id)}`} className="text-xs font-semibold text-brand-600 underline-offset-4 hover:underline">Clear filters</Link>}
            </form>
          )}
          {report?.data ? (
            <ReportView report={report.data} />
          ) : (
            <Card className="p-8 text-center text-sm text-ink-2">This report couldn't be loaded. Please try again.</Card>
          )}
        </>
      )}
    </div>
  );
}
