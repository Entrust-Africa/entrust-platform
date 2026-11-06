import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Card } from "@entrust/ui";
import type { FormDefinition } from "@entrust/forms";
import { getMe } from "@/lib/api";
import { tradeGet } from "@/lib/trade-api";
import { AssessmentResult, type ResultView } from "./assessment-result";
import { AssessmentRunner } from "./assessment-runner";
import { AssessmentStart } from "./assessment-start";
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
            {me.staffRole ? "SMEs fill this in from their own account. To fill it in for an SME, open the SME from its cohort." : "Choose your business using the switcher above."}
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
  return <AssessmentResult view={view} />;
}
