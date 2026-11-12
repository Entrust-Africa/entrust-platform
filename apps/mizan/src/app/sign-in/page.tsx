import { SignInView } from "@entrust/account";
import { afriConnectSignInShown } from "@entrust/auth/africonnect";
import { getMe } from "@/lib/api";

export const metadata = { title: "Sign in" };

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ invitationId?: string; error?: string }> }) {
  const { invitationId, error } = await searchParams;
  const me = await getMe();

  return (
    <SignInView
      appName="MIZAN"
      logoSrc="/logo.png"
      logoAlt="MIZAN logo"
      tagline="Africa's SME Financial Readiness Standard."
      description="MIZAN assesses how ready a business is to approach lenders, and gives the SME a report and an improvement plan of its own."
      homePath="/"
      currentUser={me}
      invitationId={invitationId}
      // AfriConnect has no MIZAN product yet, so its page shows TRADE's colours. Change to "mizan" once AfriConnect adds it.
      afriConnect={afriConnectSignInShown() ? { product: "trade" } : null}
      errorCode={error}
    />
  );
}
