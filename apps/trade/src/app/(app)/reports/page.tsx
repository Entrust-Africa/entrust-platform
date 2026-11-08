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

/** What the caller can report on: every programme and cohort for Entrust staff, the cohorts it sponsors for a sponsor. */
async function loadChoices(isStaff: boolean): Promise<Choice[]> {
  if (isStaff) {
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

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ program?: string; cohort?: string }> }) {
  const me = await getMe();
  if (!me) redirect("/sign-in");
  const { program, cohort } = await searchParams;
  const isStaff = Boolean(me.staffRole);
  const choices = await loadChoices(isStaff);
  const asked = cohort ? choices.find((c) => c.kind === "cohort" && c.id === cohort) : program ? choices.find((c) => c.kind === "program" && c.id === program) : undefined;
  const selected = asked ?? choices[0];
  const report = selected ? await tradeGet<ProgrammeReport>(pathFor(selected)) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold text-ink">Programme reports</h1>
          <p className="mt-1 text-sm text-ink-2">Who took part, what capabilities improved and what commercial results followed.</p>
        </div>
        {isStaff && selected && (
          <a
            href={`/reports/export?kind=${selected.kind}&id=${encodeURIComponent(selected.id)}`}
            className="inline-flex h-10 items-center rounded-md border border-line-strong bg-surface px-4 text-sm font-semibold text-ink hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-brand-500"
          >
            Export (CSV)
          </a>
        )}
      </div>

      {choices.length === 0 ? (
        <EmptyState
          title="Nothing to report on yet"
          description={isStaff ? "Create a programme and a cohort, and their figures appear here as businesses work through TRADE." : "When Entrust names your organisation as the sponsor of a cohort, its report appears here."}
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
