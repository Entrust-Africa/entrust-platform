import Link from "next/link";
import { AlertCircle, CheckCircle2, CircleDashed, FileText, Info, PartyPopper } from "lucide-react";
import { Card } from "@entrust/ui";
import { DOCUMENT_LABELS, PATHWAY_LABELS, countryName, eligibilitySummary, formatDateTime, type SummitApplication } from "@/lib/summit";
import { LinkButton } from "./link-button";
import { HubDocuments } from "./hub-documents";

// The status page for an applicant, one piece at a time. They show what the API's applicant view holds and nothing else:
// no scores, rubric points or internal notes are in that view, and the `staff` part of the reply is never read here.

/** What to say right after the application is sent, which depends on how the first check went. */
export function SentNotice({ status }: { status: string }) {
  const look =
    status === "in_review"
      ? { box: "border-ok/30 bg-ok-50", icon: <PartyPopper className="mt-0.5 size-6 shrink-0 text-ok" aria-hidden="true" />, title: "Thank you. We have your application.", body: "The result of our first check is below." }
      : status === "action_required"
        ? { box: "border-warn/30 bg-warn-50", icon: <AlertCircle className="mt-0.5 size-6 shrink-0 text-warn" aria-hidden="true" />, title: "We have your application. We need a little more.", body: "The result of our first check is below." }
        : { box: "border-line bg-surface-2", icon: <Info className="mt-0.5 size-6 shrink-0 text-ink-3" aria-hidden="true" />, title: "We have your application.", body: "The result of our first check is below." };
  return (
    <div className={`flex items-start gap-3 rounded-lg border p-4 ${look.box}`} role="status">
      {look.icon}
      <div>
        <p className="text-base font-semibold text-ink">{look.title}</p>
        <p className="mt-1 text-base text-ink-2">{look.body}</p>
      </div>
    </div>
  );
}

/** The questions-answered bar. */
export function Progress({ percent }: { percent: number }) {
  return (
    <div className="space-y-1.5">
      <div role="progressbar" aria-label="Questions answered" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} className="h-2 overflow-hidden rounded-full bg-surface-2">
        <div className="h-full rounded-full bg-brand-600" style={{ width: `${percent}%` }} />
      </div>
      <p className="text-sm text-ink-3">{percent}% of the questions answered</p>
    </div>
  );
}

/** The result of the eligibility check, in plain words, with what is missing when it isn't met. */
export function EligibilityCard({ application }: { application: SummitApplication }) {
  const eligibility = application.eligibility;
  if (!eligibility || application.status === "draft") return null;
  const summary = eligibilitySummary(eligibility);
  const unmet = eligibility.criteria.filter((c) => c.result === "not_met" || c.result === "unclear");
  const border = summary.tone === "ok" ? "border-ok/30" : summary.tone === "danger" ? "border-danger/30" : "border-warn/40";
  const problem = summary.tone !== "ok";
  return (
    <Card className={`space-y-3 p-5 ${border}`}>
      <div className="flex items-start gap-3">
        {problem ? (
          <AlertCircle className={`mt-0.5 size-6 shrink-0 ${summary.tone === "danger" ? "text-danger" : "text-warn"}`} aria-hidden="true" />
        ) : (
          <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-ok" aria-hidden="true" />
        )}
        <div className="min-w-0">
          <h2 className="font-display text-lg font-bold text-ink">{summary.title}</h2>
          <p className="mt-1 text-base leading-relaxed text-ink-2">{summary.body}</p>
        </div>
      </div>
      {problem && unmet.length > 0 && (
        <ul className="space-y-3 border-t border-line pt-3">
          {unmet.map((c) => (
            <li key={c.id} className="text-base">
              <p className="font-semibold text-ink">{c.text}</p>
              {c.reason && <p className="mt-0.5 text-ink-2">{c.reason}</p>}
            </li>
          ))}
        </ul>
      )}
      {problem && eligibility.missingDocuments.length > 0 && (
        <div className="border-t border-line pt-3">
          <p className="text-base font-semibold text-ink">Documents still needed</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-base text-ink-2">
            {eligibility.missingDocuments.map((kind) => (
              <li key={kind}>{DOCUMENT_LABELS[kind]}</li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

/** Where to go to fill in, change or send the form. Only shown while the applicant can still change it. */
export function ActionCard({ application, path }: { application: SummitApplication; path: string }) {
  if (!application.editable) return null;
  const draft = application.status === "draft";
  return (
    <Card className="space-y-4 p-5">
      <h2 className="font-display text-lg font-bold text-ink">{draft ? "Your application" : "Update your application"}</h2>
      {draft ? (
        <Progress percent={application.progress.percent} />
      ) : (
        <p className="text-base text-ink-2">Change your answers or add documents. When you are done, check your answers and send the application again.</p>
      )}
      <div className="flex flex-col gap-3 sm:flex-row">
        <LinkButton href={`${path}/form`} className="w-full sm:w-auto">
          {draft ? (application.progress.percent === 0 ? "Start the form" : "Continue the form") : "Update my answers"}
        </LinkButton>
        {(application.canSubmit || !draft) && (
          <LinkButton href={`${path}/form?section=review`} variant="secondary" className="w-full sm:w-auto">
            {draft ? "Check and send" : "Check and send again"}
          </LinkButton>
        )}
      </div>
    </Card>
  );
}

/** The documents: a checklist, or the upload panel when only documents can be added. */
export function DocumentsCard({ application, path }: { application: SummitApplication; path: string }) {
  const required = application.requiredDocuments;
  const extra = application.documents.filter((d) => !required.includes(d.kind));
  const missing = required.filter((kind) => !application.documents.some((d) => d.kind === kind));
  return (
    <Card className="p-5">
      <h2 className="font-display text-lg font-bold text-ink">Documents</h2>
      {application.canEditDocuments && !application.editable ? (
        <div className="mt-3">
          <HubDocuments application={application} />
        </div>
      ) : (
        <>
          {required.length === 0 && application.documents.length === 0 ? (
            <p className="mt-2 text-base text-ink-2">You have not added any documents yet.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {required.map((kind) => {
                const have = application.documents.filter((d) => d.kind === kind);
                return (
                  <li key={kind} className="flex items-start gap-3 text-base">
                    {have.length > 0 ? (
                      <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-ok" aria-hidden="true" />
                    ) : (
                      <CircleDashed className="mt-0.5 size-5 shrink-0 text-warn" aria-hidden="true" />
                    )}
                    <div className="min-w-0">
                      <p className="font-medium text-ink">{DOCUMENT_LABELS[kind]}</p>
                      <p className={have.length > 0 ? "break-words text-ink-3" : "font-medium text-warn"}>
                        {have.length > 0 ? have.map((d) => d.fileName).join(", ") : "Not added yet"}
                      </p>
                    </div>
                  </li>
                );
              })}
              {extra.map((d) => (
                <li key={d.id} className="flex items-start gap-3 text-base">
                  <FileText className="mt-0.5 size-5 shrink-0 text-ink-3" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="font-medium text-ink">{DOCUMENT_LABELS[d.kind]}</p>
                    <p className="break-words text-ink-3">{d.fileName}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {application.editable && missing.length > 0 && (
            <p className="mt-3 text-base text-ink-2">
              <Link href={`${path}/form?section=S8`} className="font-semibold text-brand-700 underline underline-offset-4">
                Add the missing documents
              </Link>
              .
            </p>
          )}
        </>
      )}
    </Card>
  );
}

/** A few facts about the application. */
export function DetailsCard({ application, path }: { application: SummitApplication; path: string }) {
  return (
    <Card className="p-5">
      <h2 className="font-display text-lg font-bold text-ink">About this application</h2>
      <dl className="mt-3 grid gap-x-6 gap-y-3 text-base sm:grid-cols-2">
        <div>
          <dt className="text-sm text-ink-3">Main opportunity</dt>
          <dd className="text-ink">{application.pathway ? (PATHWAY_LABELS[application.pathway] ?? application.pathway) : "Not chosen yet"}</dd>
        </div>
        {application.country && (
          <div>
            <dt className="text-sm text-ink-3">Country</dt>
            <dd className="text-ink">{countryName(application.country)}</dd>
          </div>
        )}
        {application.submittedAt && (
          <div>
            <dt className="text-sm text-ink-3">Sent on</dt>
            <dd className="text-ink">{formatDateTime(application.submittedAt)}</dd>
          </div>
        )}
        <div>
          <dt className="text-sm text-ink-3">Application number</dt>
          <dd className="font-mono text-ink">{application.number}</dd>
        </div>
      </dl>
      {!application.editable && application.status !== "withdrawn" && (
        <p className="mt-4">
          <Link href={`${path}/form?section=review`} className="inline-flex h-11 items-center text-base font-semibold text-brand-700 underline underline-offset-4">
            Read your answers
          </Link>
        </p>
      )}
    </Card>
  );
}
