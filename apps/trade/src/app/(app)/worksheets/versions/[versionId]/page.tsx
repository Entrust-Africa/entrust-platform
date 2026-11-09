import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getMe } from "@/lib/api";
import { tradeGet } from "@/lib/trade-api";
import type { WorksheetDefinition, WorksheetVersion } from "@/lib/worksheets";
import { WorksheetRunner } from "@/components/worksheets/worksheet-runner";
import { OutputAttachments } from "@/components/outputs/output-attachments";
import { OutputReview, type OutputDetails } from "@/components/outputs/output-review";
import { WorksheetSummary } from "@/components/worksheets/worksheet-summary";

export const metadata = { title: "Worksheet" };

/** /worksheets/versions/{id}: a draft to fill in, or a submitted version to read and print. */
export default async function WorksheetVersionPage({ params }: { params: Promise<{ versionId: string }> }) {
  const { versionId } = await params;
  const me = await getMe();
  if (!me) redirect("/sign-in");
  const organizationId = !me.staffRole ? (me.activeOrganizationId ?? me.organizations?.[0]?.id) : undefined;
  const version = await tradeGet<WorksheetVersion>(`/worksheet-versions/${encodeURIComponent(versionId)}`);
  if (!version.data) notFound();
  const definition = await tradeGet<WorksheetDefinition>(`/worksheets/definitions/${encodeURIComponent(version.data.worksheetId)}`);
  if (!definition.data) notFound();

  const back = (
    <Link href={`/worksheets/${version.data.worksheetId}`} className="mb-4 inline-block text-xs font-semibold text-brand-600 hover:underline print:hidden">
      ← {definition.data.title}
    </Link>
  );
  if (version.data.status === "draft" && version.data.canEdit) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        {back}
        <WorksheetRunner definition={definition.data} initial={version.data} />
        {organizationId && <OutputAttachments versionId={versionId} organizationId={organizationId} />}
      </div>
    );
  }
  const details = version.data.status === "submitted" ? await tradeGet<OutputDetails>(`/worksheet-versions/${encodeURIComponent(versionId)}/details`) : null;
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      {back}
      {details?.data && <OutputReview details={details.data} canReview={Boolean(me.staffRole)} />}
      <WorksheetSummary definition={definition.data} version={version.data} canStartNext={version.data.status === "submitted" && !me.staffRole} />
    </div>
  );
}
