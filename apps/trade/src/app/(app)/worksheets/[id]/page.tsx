import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Card, StatusBadge } from "@entrust/ui";
import { getMe } from "@/lib/api";
import { tradeGet } from "@/lib/trade-api";
import { dayText, type WorksheetDefinition, type WorksheetSummaryList, type WorksheetVersionList } from "@/lib/worksheets";
import { StartDraftButton } from "@/components/worksheets/start-draft-button";

/** /worksheets/{id}: one worksheet, its versions and the way in. */
export default async function WorksheetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await getMe();
  if (!me) redirect("/sign-in");
  const definition = await tradeGet<WorksheetDefinition>(`/worksheets/definitions/${encodeURIComponent(id)}`);
  if (!definition.data) notFound();
  const organizationId = me.activeOrganizationId ?? me.organizations?.[0]?.id;
  const sme = !me.staffRole && organizationId;
  const [versions, summary] = sme
    ? await Promise.all([
        tradeGet<WorksheetVersionList>(`/worksheets/${encodeURIComponent(id)}/versions?organizationId=${encodeURIComponent(organizationId)}`),
        tradeGet<WorksheetSummaryList>(`/worksheets?organizationId=${encodeURIComponent(organizationId)}`),
      ])
    : [null, null];
  const d = definition.data;
  const hasDraft = versions?.data?.items.some((v) => v.status === "draft") ?? false;
  const hasSubmitted = versions?.data?.items.some((v) => v.status === "submitted") ?? false;
  const prefill = d.prefillFrom ? summary?.data?.items.find((i) => i.id === d.prefillFrom) : undefined;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/worksheets" className="text-xs font-semibold text-brand-600 hover:underline">
          ← All worksheets
        </Link>
        <p className="mt-3 font-mono text-xs font-semibold text-brand-700">{d.module}</p>
        <h1 className="font-display text-2xl font-bold text-ink">{d.title}</h1>
        <p className="mt-1 text-sm text-ink-2">{d.description}</p>
      </div>

      {sme ? (
        <Card className="space-y-3 p-5">
          {prefill && !hasSubmitted && !hasDraft && (
            <p className="text-sm text-ink-2">
              {prefill.latest
                ? `This starts from your ${prefill.title} (version ${prefill.latest.version}), so you don't type the same figures twice.`
                : `Fill in your ${prefill.title} first and this one starts from it.`}
            </p>
          )}
          <StartDraftButton worksheetId={id} label={hasDraft ? "Continue your draft" : hasSubmitted ? "Start a new version" : "Fill it in"} />
        </Card>
      ) : (
        <Card className="p-5 text-sm text-ink-2">SMEs fill in their worksheets from their own account.</Card>
      )}

      {versions?.data && versions.data.items.length > 0 && (
        <section aria-labelledby="versions" className="space-y-2">
          <h2 id="versions" className="font-display text-lg font-bold text-ink">
            Your versions
          </h2>
          <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
            {versions.data.items.map((v) => (
              <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <span className="text-ink">
                  Version {v.version}
                  {v.submittedAt ? `, submitted ${dayText(v.submittedAt.slice(0, 10))}` : ""}
                </span>
                <span className="flex items-center gap-3">
                  <StatusBadge tone={v.status === "submitted" ? "ok" : "warn"}>{v.status === "submitted" ? "Submitted" : "Draft"}</StatusBadge>
                  <Link href={`/worksheets/versions/${v.id}`} className="font-semibold text-brand-600 hover:underline">
                    {v.status === "submitted" ? "Read" : "Continue"}
                  </Link>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
