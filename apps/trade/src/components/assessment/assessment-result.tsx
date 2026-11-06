import Link from "next/link";
import { Card } from "@entrust/ui";
import { KINDS, type AssessmentKind } from "./kinds";

export interface ResultView {
  /** Set on the placement assessment, whose report has its own page. */
  id?: string;
  kind: AssessmentKind;
  status: string;
  submittedAt: string | null;
  filledInByStaff: { name: string } | null;
  pathway: { pathway: string; name: string; status: "provisional" | "confirmed"; liveOrder: boolean; reasons: string[] } | null;
}

const formatDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

/** What a person sees once their form is submitted. For the diagnostic: the learning path they start on, and why. */
export function AssessmentResult({ view, hideBackLink = false }: { view: ResultView; hideBackLink?: boolean }) {
  const info = KINDS[view.kind];
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">{info.title}</h1>
        <p className="mt-1 text-sm text-ink-2">
          Submitted{view.submittedAt ? ` on ${formatDate(view.submittedAt)}` : ""}
          {view.filledInByStaff ? `, filled in for you by ${view.filledInByStaff.name} from Entrust` : ""}.
        </p>
      </div>

      {view.kind === "diagnostic" ? (
        view.pathway ? (
          <Card className="space-y-4 p-5 sm:p-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">You start on</p>
              <h2 className="mt-1 font-display text-xl font-bold text-ink">
                Pathway {view.pathway.pathway}: {view.pathway.name}
              </h2>
              {view.pathway.status === "provisional" && (
                <p className="mt-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                  This is provisional. A member of the Entrust team will check your shipment record before it is confirmed.
                </p>
              )}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-ink">Why</h3>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-ink-2">
                {view.pathway.reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-ink">What happens next</h3>
              <p className="mt-1 text-sm leading-relaxed text-ink-2">
                Your facilitator will use this to prepare your learning plan before the training starts. You don't need to do anything else now.
              </p>
            </div>
          </Card>
        ) : (
          <Card className="p-5 text-sm text-ink-2">Your answers are in. Your learning path will appear here soon.</Card>
        )
      ) : (
        <Card className="space-y-3 p-5 text-sm leading-relaxed text-ink-2 sm:p-6">
          <p className="font-semibold text-ink">Your answers are in.</p>
          <p>
            {view.status === "review_required"
              ? "Entrust will take a quick look at a few of your answers before your learning plan is final. You can already read your report."
              : "Your scores and learning plan are ready."}
          </p>
          {view.id && view.status !== "draft" && (
            <Link href={`/assessment/${view.id}/report`} className="inline-block font-semibold text-brand-600 hover:underline">
              Read your placement report →
            </Link>
          )}
        </Card>
      )}

      {view.kind === "diagnostic" && (
        <p className="text-xs leading-relaxed text-ink-3">
          This diagnostic does not guarantee any financing, insurance cover, export approval or contract.
        </p>
      )}
      {!hideBackLink && (
        <Link href="/" className="inline-block text-sm font-semibold text-brand-600 hover:underline">
          ← Back to My plan
        </Link>
      )}
    </div>
  );
}
