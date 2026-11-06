import Link from "next/link";
import { Card, StatusBadge } from "@entrust/ui";
import { DOCUMENT_LABELS, countryName, formatDateTime } from "@/lib/summit";
import { ok } from "@/lib/summit-api";
import { PATHWAYS, labelOf, staffAccess, statusOf } from "@/lib/summit-staff";
import { load, requireUser } from "@/lib/summit-server";
import { Claims } from "@/components/summit/staff/claims";
import { Conversation } from "@/components/summit/staff/conversation";
import { NextSteps } from "@/components/summit/staff/decisions";
import { DocumentLink } from "@/components/summit/staff/document-link";
import { ProfileCard } from "@/components/summit/staff/profile-card";
import { Scorecard } from "@/components/summit/staff/scorecard";

export const metadata = { title: "Assess a Summit application" };

/** The statuses in which scores can still change. */
const SCORING = ["under_assessment", "under_verification"];
/** After these the application is out of the officer's hands. */
const FINAL = ["draft", "selected", "waitlisted", "not_selected", "withdrawn"];

const CRITERION_TONE = { met: "ok", not_met: "danger", unclear: "warn", excepted: "info" } as const;

/** /summit/review/{id}: one application for the officer, the administrators and the committee. */
export default async function ReviewApplicationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const path = `/summit/review/${id}`;
  const me = await requireUser(path);
  const access = staffAccess(me);
  const { application, workspace, sharing } = await load(path, async (api) => {
    const application = await ok(api.v1.summit.applications[":id"].$get({ param: { id } }));
    const workspace = await ok(api.v1.summit.applications[":id"].assessment.$get({ param: { id } }));
    const sharing = application.status === "selected" ? await ok(api.v1.summit.applications[":id"].sharing.$get({ param: { id } })) : null;
    return { application, workspace, sharing };
  });

  const status = statusOf(application.status);
  const canEdit = Boolean(me.staffRole) && !FINAL.includes(application.status);
  const canScore = Boolean(me.staffRole) && SCORING.includes(application.status);

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <Link href={me.staffRole ? "/summit/review" : "/summit/committee"} className="text-xs font-semibold text-brand-600 hover:underline">
          ← Back to the list
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="break-words font-display text-3xl font-bold text-ink">{application.organizationName}</h1>
            <p className="mt-1 font-mono text-sm text-ink-3">
              {application.number}
              {application.smeId ? ` · ${application.smeId}` : ""}
              {application.country ? ` · ${countryName(application.country)}` : ""}
            </p>
          </div>
          <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="space-y-2 p-4 lg:col-span-1">
          <h2 className="font-display text-lg font-bold text-ink">The application</h2>
          <dl className="space-y-1 text-sm">
            <div>
              <dt className="text-xs text-ink-3">Main opportunity</dt>
              <dd className="text-ink">{labelOf(PATHWAYS, application.pathway)}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-3">Sent</dt>
              <dd className="text-ink">{application.submittedAt ? formatDateTime(application.submittedAt) : "Not sent"}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-3">Assessment officer</dt>
              <dd className="text-ink">{application.staff?.officer?.name ?? "Not assigned"}</dd>
            </div>
          </dl>
          <Link href={`/summit/applications/${application.id}/form?section=review`} className="inline-block text-sm font-semibold text-brand-600 hover:underline">
            Read the answers →
          </Link>
        </Card>

        <Card className="space-y-2 p-4 lg:col-span-1">
          <h2 className="font-display text-lg font-bold text-ink">Eligibility</h2>
          {application.eligibility ? (
            <ul className="space-y-1.5 text-sm">
              {application.eligibility.criteria.map((c) => (
                <li key={c.id} className="flex items-start justify-between gap-2">
                  <span className="text-ink-2">{c.text}</span>
                  <StatusBadge tone={CRITERION_TONE[c.result]}>{c.result === "not_met" ? "Not met" : c.result === "excepted" ? "Excepted" : c.result === "unclear" ? "Unclear" : "Met"}</StatusBadge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-2">Not checked yet.</p>
          )}
        </Card>

        <Card className="space-y-2 p-4 lg:col-span-1">
          <h2 className="font-display text-lg font-bold text-ink">Documents</h2>
          {application.documents.length === 0 ? (
            <p className="text-sm text-ink-2">None uploaded.</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {application.documents.map((d) => (
                <li key={d.id}>
                  <p className="text-ink-2">{DOCUMENT_LABELS[d.kind]}</p>
                  <DocumentLink applicationId={application.id} documentId={d.id}>
                    {d.fileName}
                  </DocumentLink>
                  {d.restricted && <span className="ml-2 text-xs text-ink-3">restricted</span>}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {sharing && <ProfileCard applicationId={application.id} sharing={sharing} canMakeExternal={access.allApplications} />}

      <Scorecard applicationId={application.id} workspace={workspace} canEdit={canScore} />
      <Claims applicationId={application.id} workspace={workspace} documents={application.documents} canEdit={canEdit} />
      <Conversation applicationId={application.id} workspace={workspace} canEdit={canEdit} />
      <NextSteps applicationId={application.id} status={application.status} workspace={workspace} access={access} canEdit={canEdit} />

      {application.staff && application.staff.history.length > 0 && (
        <section aria-labelledby="history" className="space-y-2">
          <h2 id="history" className="font-display text-lg font-bold text-ink">
            History
          </h2>
          <ol className="space-y-1.5 text-sm text-ink-2">
            {application.staff.history.map((h) => (
              <li key={h.at}>
                <span className="text-xs text-ink-3">{formatDateTime(h.at)}</span> {h.from ? `${statusOf(h.from).label} → ` : ""}
                <span className="font-semibold text-ink">{statusOf(h.to).label}</span>
                {h.by ? ` by ${h.by.name}` : ""}
                {h.reason ? `. ${h.reason}` : ""}
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
