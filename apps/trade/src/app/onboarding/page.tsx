import { afriConnectSignInShown } from "@entrust/auth/africonnect";
import { Card } from "@entrust/ui";
import { StartDiagnostic } from "@/components/onboarding/start-diagnostic";

// Whether AfriConnect accounts are made is a setting read per request.
export const dynamic = "force-dynamic";

/** The public link Entrust sends out: what the diagnostic is, and a way to start it. No account needed. */
export default function OnboardingPage() {
  const afriConnect = afriConnectSignInShown();
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.12em] text-brand-600">Entrust TRADE</p>
        <h1 className="mt-2 font-display text-3xl font-bold text-ink">Onboarding diagnostic</h1>
        <p className="mt-3 leading-relaxed text-ink-2">
          Tell us about your business so Entrust can place you on the right learning path before the TRADE training starts on 19 November 2026.
        </p>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-relaxed text-ink-2">
          <li>
            {afriConnect
              ? "You don't need to sign in or choose a password. Just your business name, email address and phone number."
              : "You don't need an account. Just your business name, email address and phone number."}
          </li>
          <li>Questions that don't apply to you stay hidden, so most businesses answer far fewer than the full list.</li>
          <li>Your answers save as you go. You can stop at any time and carry on from the link we email you.</li>
          <li>It works on a phone. Have your business registration and tax details nearby.</li>
        </ul>
      </div>
      <Card className="p-5 sm:p-6">
        <StartDiagnostic />
      </Card>
      <p className="text-xs leading-relaxed text-ink-3">
        {afriConnect
          ? "When you open the link we email you, we also create your Entrust Africa account with that email, so you can sign in later; you choose a password the first time you do. "
          : ""}
        This diagnostic does not guarantee any financing, insurance cover, export approval or contract. Your answers are used by Entrust to plan the training, and are shared with sponsors only with your consent.
      </p>
    </div>
  );
}
