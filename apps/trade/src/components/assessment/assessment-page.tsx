import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Card } from "@entrust/ui";
import type { FormDefinition } from "@entrust/forms";
import { getMe } from "@/lib/api";
import { tradeGet } from "@/lib/trade-api";
import { AssessmentResult, type ResultView } from "./assessment-result";
import { AssessmentRunner } from "./assessment-runner";
import { AssessmentStart } from "./assessment-start";
import { NotApplicableReview, type PendingNotApplicable } from "./not-applicable-review";
import { RetakeButton } from "./retake-button";
import { KINDS, type AssessmentKind } from "./kinds";

interface Summary {
  id: string;
  status: string;
}

interface Detail extends ResultView {
  id: string;
  templateVersion: string;
  canEdit: boolean;
  answers: Record<string, unknown>;
  variables: Record<string, string>;
  documents: Record<string, boolean>;
  notApplicableApproved: Record<string, boolean>;
  organizationId?: string;
}

/** /diagnostic and /assessment: start the form, or go to the one in progress. */
export async function AssessmentIndexPage({ kind }: { kind: AssessmentKind }) {
  const me = await getMe();
  if (!me) redirect("/sign-in");
  const organizationId = me.activeOrganizationId ?? me.organizations?.[0]?.id;
  if (me.staffRole || !organizationId) {
    return (
      <div className="mx-auto max-w-xl py-12">
        <Card className="p-8 text-center">
          <h1 className="font-display text-xl font-bold text-ink">{KINDS[kind].title}</h1>
          <p className="mt-3 text-sm text-ink-2">
            {me.staffRole ? "SMEs fill this in from their own account. To fill it in with a business, open its cohort and use “Start with the business” in its row." : "Choose your business using the switcher above."}
          </p>
        </Card>
      </div>
    );
  }
  const list = await tradeGet<{ items: Summary[] }>(`/assessments?kind=${kind}&organizationId=${encodeURIComponent(organizationId)}`);
  const live = list.data?.items.find((item) => item.status !== "superseded");
  if (live) redirect(`${KINDS[kind].route}/${live.id}`);
  return <AssessmentStart kind={kind} organizationId={organizationId} />;
}

/** /diagnostic/{id} and /assessment/{id}: the form while it is a draft, the result once it is submitted. */
export async function AssessmentDetailPage({ kind, id }: { kind: AssessmentKind; id: string }) {
  const me = await getMe();
  if (!me) redirect("/sign-in");
  const result = await tradeGet<Detail & { kind: AssessmentKind }>(`/assessments/${encodeURIComponent(id)}`);
  if (!result.data || result.data.kind !== kind) notFound();
  const view = result.data;

  if (view.status === "draft" && view.canEdit) {
    const template = await tradeGet<{ form: FormDefinition }>(`/assessments/template?kind=${kind}&version=${encodeURIComponent(view.templateVersion)}`);
    if (!template.data) notFound();
    return (
      <div className={kind === "diagnostic" ? "mx-auto max-w-5xl space-y-4" : "mx-auto max-w-2xl space-y-4"}>
        <h1 className="font-display text-xl font-bold text-ink">{KINDS[kind].title}</h1>
        <AssessmentRunner assessmentId={view.id} kind={kind} definition={template.data.form} answers={view.answers} variables={view.variables} documents={view.documents} />
      </div>
    );
  }
  if (view.status === "draft") {
    return (
      <div className="mx-auto max-w-xl py-12">
        <Card className="p-8 text-center">
          <h1 className="font-display text-xl font-bold text-ink">{KINDS[kind].title}</h1>
          <p className="mt-3 text-sm text-ink-2">This one isn't finished yet. Only the person who is filling it in can change it.</p>
          <Link href="/" className="mt-4 inline-block text-sm font-semibold text-brand-600 hover:underline">
            Back to My plan
          </Link>
        </Card>
      </div>
    );
  }
  // Staff who can write approve the "does not apply" answers waiting for them; the business can take the assessment again.
  const canReview = Boolean(me.staffRole) && me.staffRole !== "reviewer";
  const waiting = Object.entries(view.answers)
    .filter(([questionId, answer]) => (answer as { notApplicable?: boolean } | null)?.notApplicable === true && !view.notApplicableApproved[questionId])
    .map(([questionId, answer]) => ({ questionId, reason: String((answer as { reason?: string }).reason ?? "") }));
  let pending: PendingNotApplicable[] = [];
  if (canReview && waiting.length > 0) {
    const template = await tradeGet<{ form: FormDefinition }>(`/assessments/template?kind=${kind}&version=${encodeURIComponent(view.templateVersion)}`);
    const text = new Map((template.data?.form.questions ?? []).map((q) => [q.id, q.text]));
    pending = waiting.map((w) => ({ ...w, question: text.get(w.questionId) ?? w.questionId }));
  }
  const ownOrganization = !me.staffRole ? (me.activeOrganizationId ?? me.organizations?.[0]?.id) : undefined;
  return (
    <div className="space-y-6">
      <AssessmentResult view={view} />
      {pending.length > 0 && <NotApplicableReview assessmentId={view.id} pending={pending} />}
      {ownOrganization && kind !== "exit" && view.status !== "superseded" && <RetakeButton kind={kind} organizationId={ownOrganization} />}
    </div>
  );
}
