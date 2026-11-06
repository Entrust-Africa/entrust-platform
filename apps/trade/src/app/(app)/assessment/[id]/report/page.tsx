import { notFound, redirect } from "next/navigation";
import { Card } from "@entrust/ui";
import { PlacementReport } from "@/components/assessment/placement-report";
import { getMe } from "@/lib/api";
import { tradeGet } from "@/lib/trade-api";
import type { PlacementReportData } from "@/lib/types";

export const metadata = { title: "Placement report" };

/** /assessment/{id}/report: the placement report of a scored assessment. Entrust staff open any SME's from its cohort. */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const me = await getMe();
  if (!me) redirect("/sign-in");
  const { id } = await params;
  const result = await tradeGet<{ report: PlacementReportData }>(`/assessments/${encodeURIComponent(id)}/report`);
  if (result.status === 404) notFound();
  if (!result.data) {
    return (
      <div className="mx-auto max-w-xl py-12">
        <Card className="p-8 text-center">
          <h1 className="font-display text-xl font-bold text-ink">Placement report</h1>
          <p className="mt-3 text-sm text-ink-2">{result.error ?? "The report isn't ready yet. It appears once the assessment is submitted."}</p>
        </Card>
      </div>
    );
  }
  return <PlacementReport report={result.data.report} backHref={me.staffRole ? "/cohorts" : "/"} />;
}
