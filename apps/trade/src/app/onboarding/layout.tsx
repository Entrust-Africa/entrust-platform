import { PublicShell } from "@/components/shell/public-shell";

// The onboarding diagnostic is shared by link, so it stays out of search results.
export const metadata = {
  title: "Onboarding diagnostic",
  description: "Tell Entrust about your business so it can place you on the right learning path before the TRADE training starts.",
  robots: { index: false, follow: false },
};

/** The diagnostic's pages need no account: they use the public frame whether or not the visitor is signed in. */
export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <PublicShell homeHref="/onboarding" homeLabel="TRADE, onboarding diagnostic" signInHref="/sign-in">
      {children}
    </PublicShell>
  );
}
