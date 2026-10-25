import { Field, StatusBadge } from "@entrust/ui";
import type { CaseDetailView } from "@entrust/api/client";
import type { EvidenceStatus } from "@entrust/gate-engine";
import { evidenceActions } from "@/lib/catalogue";
import { formatDate, formatDateTime } from "@/lib/format";
import { EVIDENCE_STATUSES } from "@/lib/statuses";
import { reviewEvidence } from "../actions";
import { ActionForm } from "../action-form";
import { NoteField } from "../inputs";

type Item = CaseDetailView["evidence"][number];

// Evidence waiting on a reviewer first, then what needs the exporter, then the rest.
const ORDER: Record<EvidenceStatus, number> = {
  submitted: 0,
  under_review: 1,
  changes_required: 2,
  rejected: 3,
  expired: 4,
  approved: 5,
  not_provided: 6,
};

/** The case's evidence: the latest submission of each type, with the reviewer's controls. */
export function EvidenceList({ detail }: { detail: CaseDetailView }) {
  const latest = detail.evidence.filter((e) => e.latest).sort((a, b) => ORDER[a.status] - ORDER[b.status]);
  const earlier = detail.evidence.filter((e) => !e.latest);
  if (!latest.length) {
    return <p className="text-sm text-ink-2">Nothing submitted yet. Evidence is submitted on the step that asks for it.</p>;
  }
  return (
    <>
      <ul className="flex flex-col gap-3">
        {latest.map((item) => (
          <EvidenceItem key={item.id} item={item} caseId={detail.id} role={detail.yourRole} />
        ))}
      </ul>
      {earlier.length > 0 && (
        <details className="mt-4 text-sm">
          <summary className="cursor-pointer text-ink-2">
            {earlier.length === 1 ? "1 earlier submission" : `${earlier.length} earlier submissions`}
          </summary>
          <ul className="mt-2 flex flex-col gap-1 text-ink-3">
            {earlier.map((e) => (
              <li key={e.id}>
                {e.typeName}: {EVIDENCE_STATUSES[e.status].label.toLowerCase()}, submitted {formatDate(e.submittedAt)}
                {e.reviewNote && <> · {e.reviewNote}</>}
              </li>
            ))}
          </ul>
        </details>
      )}
    </>
  );
}

function EvidenceItem({ item, caseId, role }: { item: Item; caseId: string; role: CaseDetailView["yourRole"] }) {
  const status = EVIDENCE_STATUSES[item.status];
  // Submitted evidence is put under review and decided in one go (see reviewEvidence).
  const deciding = item.status === "submitted" ? evidenceActions("under_review", role) : evidenceActions(item.status, role);
  const canDecide =
    (item.status === "under_review" || (item.status === "submitted" && evidenceActions("submitted", role).startReview)) &&
    (deciding.approve || deciding.requestChanges || deciding.reject);
  return (
    <li className="rounded-md border border-line p-3 sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold">{item.typeName}</p>
          <p className="text-xs text-ink-3">
            Submitted {formatDateTime(item.submittedAt)}
            {item.issuedOn && <> · issued {formatDate(item.issuedOn)}</>}
            {item.validUntil && <> · valid until {formatDate(item.validUntil)}</>}
          </p>
        </div>
        <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
      </div>
      {item.reviewNote && (
        <p className="mt-2 rounded-sm bg-surface-2 px-2 py-1.5 text-sm">
          <span className="font-semibold">Reviewer&apos;s note: </span>
          {item.reviewNote}
        </p>
      )}
      {canDecide && (
        <ActionForm
          action={reviewEvidence}
          hidden={{ caseId, evidenceId: item.id, from: item.status }}
          submits={[
            ...(deciding.approve ? [{ label: "Approve", name: "to", value: "approved" }] : []),
            ...(deciding.requestChanges
              ? [{ label: "Request changes", name: "to", value: "changes_required", variant: "secondary" as const }]
              : []),
            ...(deciding.reject ? [{ label: "Reject", name: "to", value: "rejected", variant: "danger" as const }] : []),
          ]}
          className="mt-3"
        >
          <NoteField label="Note for the exporter" name="note" placeholder="Needed to request changes or reject: what is wrong." />
          <Field
            label="Issue date on the document"
            name="issuedOn"
            type="date"
            hint="To record or correct it. Its validity runs from this day."
            className="max-w-xs"
          />
        </ActionForm>
      )}
    </li>
  );
}
