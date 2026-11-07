import Link from "next/link";
import type { FormDefinition } from "@entrust/forms";
import { Card } from "@entrust/ui";
import { AssessmentResult, type ResultView } from "@/components/assessment/assessment-result";
import { PublicDiagnosticRunner } from "@/components/onboarding/public-diagnostic-runner";
import { afriConnectSignInShown } from "@entrust/auth/africonnect";
import { ConfirmEmail } from "@/components/onboarding/confirm-email";
import { tradeGet } from "@/lib/trade-api";

interface View extends ResultView {
  status: "draft" | "submitted";
  email: string;
  emailVerified: boolean;
  businessName: string | null;
  answers: Record<string, unknown>;
  variables: Record<string, string>;
}

/** A draft's own page, reached by its private link: the form while it is a draft, the result once it is submitted. */
export default async function PublicDiagnosticPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ proof?: string }>;
}) {
  const { token } = await params;
  const { proof } = await searchParams;
  const result = await tradeGet<Omit<View, "kind" | "filledInByStaff">>(`/public/diagnostic/${encodeURIComponent(token)}`);
  if (!result.data) {
    return (
      <div className="mx-auto max-w-xl py-8">
        <Card className="space-y-3 p-6 text-center">
          <h1 className="font-display text-xl font-bold text-ink">This link isn't right</h1>
          <p className="text-sm text-ink-2">Open the link from the email we sent you, or start the diagnostic again.</p>
          <Link href="/onboarding" className="inline-block text-sm font-semibold text-brand-600 hover:underline">
            Start the diagnostic
          </Link>
        </Card>
      </div>
    );
  }
  const view = result.data;

  // The link in the email carries a proof that the visitor reads that address's mail; a button spends it.
  if (typeof proof === "string" && proof && !view.emailVerified) {
    return <ConfirmEmail token={token} proof={proof} email={view.email} afriConnect={afriConnectSignInShown()} />;
  }

  if (view.status === "submitted") {
    return (
      <AssessmentResult
        hideBackLink
        view={{ kind: "diagnostic", status: view.status, submittedAt: view.submittedAt, filledInByStaff: null, pathway: view.pathway }}
      />
    );
  }

  const template = await tradeGet<{ form: FormDefinition }>(`/public/diagnostic/${encodeURIComponent(token)}/template`);
  if (!template.data) {
    return <p className="mx-auto max-w-xl py-8 text-sm text-ink-2">The form couldn't be loaded. Refresh the page to try again.</p>;
  }
  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">Onboarding diagnostic</h1>
        <p className="mt-1 text-sm text-ink-2">
          {view.businessName ? `${view.businessName}. ` : ""}Your answers save as you go. We emailed the link to {view.email}, so you can carry on later. Where you don't know an answer, write that you don't know.
        </p>
      </div>
      <PublicDiagnosticRunner token={token} definition={template.data.form} answers={view.answers} variables={view.variables} />
    </div>
  );
}
