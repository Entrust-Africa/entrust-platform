import Link from "next/link";
import { Card, Field, StatusBadge } from "@entrust/ui";
import type { EvidenceStatus, Role } from "@entrust/gate-engine";
import { evidenceActions } from "@/lib/catalogue";
import { formatDate, formatDateTime } from "@/lib/format";
import { EVIDENCE_STATUSES } from "@/lib/statuses";
import { reviewEvidence } from "../actions";
import { ActionForm } from "../action-form";
import { NoteField } from "../inputs";
import { FilterChips } from "./parts";
import { caseHref, stepAskingFor, withStep, type Detail, type View } from "./view";

export type Item = Detail["evidence"][number];

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

const FILTERS = [
  { id: "review", label: "To review", statuses: ["submitted", "under_review"] },
  { id: "back", label: "Sent back", statuses: ["changes_required", "rejected", "expired"] },
  { id: "approved", label: "Approved", statuses: ["approved"] },
] as const satisfies readonly { id: string; label: string; statuses: readonly EvidenceStatus[] }[];

/** The evidence tab: the latest submission of each type, with the reviewer's controls. */
export function EvidenceTab({ detail, view }: { detail: Detail; view: View }) {
  const latest = detail.evidence.filter((e) => e.latest).sort((a, b) => ORDER[a.status] - ORDER[b.status]);
  const earlier = detail.evidence.filter((e) => !e.latest);
  const filter = FILTERS.find((f) => f.id === view.show);
  const shown = filter ? latest.filter((e) => (filter.statuses as readonly string[]).includes(e.status)) : latest;

  if (!latest.length) {
    return (
      <Card className="px-6 py-10 text-center">
        <p className="font-display text-lg font-bold">Nothing submitted yet</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-ink-2">Evidence is submitted on the step that asks for it, from the step&apos;s panel.</p>
      </Card>
    );
  }
  return (
    <>
      <FilterChips
        label="Filter evidence"
        current={filter?.id ?? "all"}
        options={[
          { id: "all", label: "All", count: latest.length, href: caseHref(detail.id, { tab: "evidence" }) },
          ...FILTERS.map((f) => ({
            id: f.id,
            label: f.label,
            count: latest.filter((e) => (f.statuses as readonly string[]).includes(e.status)).length,
            href: caseHref(detail.id, { tab: "evidence", show: f.id }),
          })),
        ]}
      />
      {shown.length ? (
        <ul className="mt-4 flex flex-col gap-3">
          {shown.map((item) => (
            <EvidenceItem key={item.id} item={item} detail={detail} view={view} />
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-ink-2">No evidence is under “{filter?.label}”.</p>
      )}
      {earlier.length > 0 && (
        <details className="mt-6 text-sm">
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

function EvidenceItem({ item, detail, view }: { item: Item; detail: Detail; view: View }) {
  const status = EVIDENCE_STATUSES[item.status];
  const step = stepAskingFor(detail, item.type);
  return (
    <li>
      <Card className="p-4 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold">{item.typeName}</p>
            <p className="text-xs text-ink-3">
              <Submission item={item} />
              {step && (
                <>
                  {" · for "}
                  <Link href={withStep(detail.id, view, step.id)} scroll={false} className="font-mono text-brand-600 hover:underline">
                    {step.id}
                  </Link>
                </>
              )}
            </p>
          </div>
          <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
        </div>
        <ReviewNote item={item} />
        <EvidenceReview item={item} caseId={detail.id} role={detail.yourRole} />
      </Card>
    </li>
  );
}

/** When the submission was made, and the dates on the document. */
export function Submission({ item }: { item: Item }) {
  return (
    <>
      Submitted {formatDateTime(item.submittedAt)}
      {item.issuedOn && <> · issued {formatDate(item.issuedOn)}</>}
      {item.validUntil && <> · valid until {formatDate(item.validUntil)}</>}
    </>
  );
}

export function ReviewNote({ item }: { item: Item }) {
  if (!item.reviewNote) return null;
  return (
    <p className="mt-2 rounded-sm bg-surface-2 px-2 py-1.5 text-sm">
      <span className="font-semibold">Reviewer&apos;s note: </span>
      {item.reviewNote}
    </p>
  );
}

/** The reviewer's decision on a submission, when the role may make one now. */
export function EvidenceReview({ item, caseId, role }: { item: Item; caseId: string; role: Role }) {
  // Submitted evidence is put under review and decided in one go (see reviewEvidence).
  const deciding = item.status === "submitted" ? evidenceActions("under_review", role) : evidenceActions(item.status, role);
  const canDecide =
    (item.status === "under_review" || (item.status === "submitted" && evidenceActions("submitted", role).startReview)) &&
    (deciding.approve || deciding.requestChanges || deciding.reject);
  if (!canDecide) return null;
  return (
    <ActionForm
      action={reviewEvidence}
      hidden={{ caseId, evidenceId: item.id, from: item.status }}
      submits={[
        ...(deciding.approve ? [{ label: "Approve", name: "to", value: "approved" }] : []),
        ...(deciding.requestChanges ? [{ label: "Request changes", name: "to", value: "changes_required", variant: "secondary" as const }] : []),
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
  );
}
