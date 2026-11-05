import { redirect } from "next/navigation";
import { Building2, Info } from "lucide-react";
import { Card, StatusBadge } from "@entrust/ui";
import { serverApi } from "@/lib/api";
import { ok } from "@/lib/summit-api";
import { formatDateTime, smeOrganizations, statusCopy } from "@/lib/summit";
import { load, requireUser } from "@/lib/summit-server";
import { ClearNext } from "@/components/summit/clear-next";
import { CreateOrganisation } from "@/components/summit/create-organisation";
import { LinkButton } from "@/components/summit/link-button";
import { StartApplication } from "@/components/summit/start-application";

export const metadata = { title: "Apply to the Summit" };

export default async function ApplyPage() {
  const me = await requireUser("/summit/apply");
  const { period, applications } = await load("/summit/apply", async (api) => {
    const [periodReply, listReply] = await Promise.all([ok(api.v1.summit.period.$get()), ok(api.v1.summit.applications.$get({ query: {} }))]);
    return { period: periodReply.period, applications: listReply.items };
  });

  const organizations = smeOrganizations(me);
  const mine = applications.filter((a) => organizations.some((o) => o.id === a.organizationId));
  const live = mine.filter((a) => a.status !== "withdrawn");
  // One application to look after: go straight to it.
  if (live.length === 1 && live[0]) redirect(`/summit/applications/${live[0].id}`);

  const open = period?.state === "open";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <ClearNext />
      <div>
        <p className="text-sm font-bold tracking-wider text-brand-600 uppercase">Summit</p>
        <h1 className="mt-1 font-display text-3xl font-bold text-ink">Apply to the Summit</h1>
      </div>

      {me.staffRole && organizations.length === 0 && (
        <Card className="space-y-3 p-5">
          <h2 className="font-display text-lg font-bold text-ink">You are signed in as Entrust staff</h2>
          <p className="text-base text-ink-2">Applications are for businesses. The tools for reviewing applications are not in this app yet.</p>
          {me.staffRole === "admin" && <LinkButton href="/summit/admin/periods">Manage application periods</LinkButton>}
        </Card>
      )}

      {!period && (
        <div className="flex items-start gap-3 rounded-lg border border-line bg-surface-2 p-4 text-base text-ink-2" role="status">
          <Info className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <p>Applications are not open yet. We will announce the dates soon.</p>
        </div>
      )}
      {period && !open && (
        <div className="flex items-start gap-3 rounded-lg border border-line bg-surface-2 p-4 text-base text-ink-2" role="status">
          <Info className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <p>
            {period.state === "upcoming"
              ? `Applications open on ${formatDateTime(period.opensAt)}. You can add your business now so you are ready.`
              : `Applications closed on ${formatDateTime(period.closesAt)}.`}
          </p>
        </div>
      )}

      {organizations.length === 0 && !me.staffRole && period && (
        <Card className="space-y-5 p-5 sm:p-6">
          <div>
            <h2 className="font-display text-xl font-bold text-ink">Tell us about your business</h2>
            <p className="mt-1 text-base text-ink-2">You apply as a business. Add yours first. You can fill in the rest of the details in the application.</p>
          </div>
          <CreateOrganisation countries={period.countries} />
        </Card>
      )}

      {organizations.map((organization) => {
        const related = mine.filter((a) => a.organizationId === organization.id);
        const current = related.find((a) => a.status !== "withdrawn");
        const withdrawn = related.find((a) => a.status === "withdrawn");
        return (
          <Card key={organization.id} className="space-y-4 p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                <Building2 className="size-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <h2 className="break-words font-display text-xl font-bold text-ink">{organization.name}</h2>
                {organization.smeId && <p className="font-mono text-sm text-ink-3">{organization.smeId}</p>}
              </div>
            </div>

            {current ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge tone={statusCopy(current.status, null).tone}>{statusCopy(current.status, null).label}</StatusBadge>
                  <span className="font-mono text-sm text-ink-3">{current.number}</span>
                </div>
                <LinkButton href={`/summit/applications/${current.id}`} className="w-full sm:w-auto">
                  Open the application
                </LinkButton>
              </>
            ) : open ? (
              <>
                {withdrawn && <p className="text-base text-ink-2">You withdrew your earlier application. You can start a new one.</p>}
                <StartApplication organizationId={organization.id} organizationName={organization.name} />
              </>
            ) : (
              <p className="text-base text-ink-2">You can start the application when applications are open.</p>
            )}
          </Card>
        );
      })}
    </div>
  );
}
