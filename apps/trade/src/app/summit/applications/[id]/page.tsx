import { Card, StatusBadge } from "@entrust/ui";
import { ok } from "@/lib/summit-api";
import { formatDateTime, statusCopy } from "@/lib/summit";
import { load, requireUser } from "@/lib/summit-server";
import { ClarificationPanel } from "@/components/summit/clarification-panel";
import { ActionCard, DetailsCard, DocumentsCard, EligibilityCard, SentNotice } from "@/components/summit/hub-sections";
import { WithdrawButton } from "@/components/summit/withdraw-button";

export const metadata = { title: "Your Summit application" };

/** What an applicant can still withdraw. After the committee decides it is too late. */
const WITHDRAWABLE = ["draft", "in_review", "action_required", "not_eligible"];

export default async function ApplicationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ submitted?: string }>;
}) {
  const { id } = await params;
  const { submitted } = await searchParams;
  const path = `/summit/applications/${id}`;
  await requireUser(path);
  const application = await load(path, (api) => ok(api.v1.summit.applications[":id"].$get({ param: { id } })));

  const copy = statusCopy(application.status, application.result);
  const justSent = submitted === "1" && application.status !== "draft";
  const openRequests = application.clarifications.filter((c) => c.open);
  const earlier = application.clarifications.filter((c) => !c.open);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <p className="text-sm font-bold tracking-wider text-brand-600 uppercase">Summit application</p>
        <h1 className="mt-1 break-words font-display text-3xl font-bold text-ink">{application.organizationName}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
          <StatusBadge tone={copy.tone}>{copy.label}</StatusBadge>
          <span className="font-mono text-sm text-ink-3">{application.number}</span>
        </div>
      </div>

      {justSent && <SentNotice status={application.status} />}

      <Card className="p-5">
        <h2 className="font-display text-lg font-bold text-ink">Where things stand</h2>
        <p className="mt-2 text-base leading-relaxed text-ink-2">{copy.next}</p>
        {application.status === "draft" && (
          <p className="mt-2 text-base text-ink-2">
            {application.editable
              ? `Applications close on ${formatDateTime(application.closesAt)}.`
              : "Applications have closed, so this application can no longer be sent."}
          </p>
        )}
      </Card>

      {openRequests.map((request) => (
        <div key={request.id} className="space-y-2">
          <h2 className="font-display text-lg font-bold text-ink">We need more information</h2>
          <ClarificationPanel applicationId={application.id} clarification={request} />
        </div>
      ))}

      <EligibilityCard application={application} />

      <ActionCard application={application} path={path} />
      <DocumentsCard application={application} path={path} />

      {earlier.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display text-lg font-bold text-ink">Earlier requests</h2>
          {earlier.map((request) => (
            <ClarificationPanel key={request.id} applicationId={application.id} clarification={request} />
          ))}
        </section>
      )}

      <DetailsCard application={application} path={path} />

      {WITHDRAWABLE.includes(application.status) && (
        <div className="border-t border-line pt-6">
          <WithdrawButton applicationId={application.id} />
        </div>
      )}
    </div>
  );
}
