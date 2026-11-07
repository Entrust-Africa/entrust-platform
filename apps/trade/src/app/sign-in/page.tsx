import { SignInView } from "@entrust/account";
import { afriConnectSignInShown } from "@entrust/auth/africonnect";
import { getMe } from "@/lib/api";
import { safeNext } from "@/lib/next-path";
import { RememberNext } from "@/components/summit/clear-next";

export const metadata = { title: "Sign in" };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ invitationId?: string; next?: string; error?: string }>;
}) {
  const { invitationId, next, error } = await searchParams;
  const me = await getMe();
  // A visitor sent here from the Summit comes back to it, even after creating an account and verifying their email.
  const comeBackTo = safeNext(next);

  return (
    <>
      {comeBackTo && <RememberNext next={comeBackTo} />}
      <SignInView
        appName="TRADE"
        logoSrc="/logo.png"
        logoAlt="TRADE logo"
        tagline={comeBackTo ? "Apply to the Africa Diaspora Trade and Investment Summit." : "Building export capability for African SMEs."}
        description={
          comeBackTo
            ? "Sign in, or create an account, to start your application. You will come straight back to it."
            : "TRADE equips African businesses to assess export readiness, close capability gaps, and navigate global trade."
        }
        homePath={comeBackTo ?? "/"}
        currentUser={me}
        invitationId={invitationId}
        afriConnect={afriConnectSignInShown() ? { product: "trade" } : null}
        errorCode={error}
      />
    </>
  );
}
