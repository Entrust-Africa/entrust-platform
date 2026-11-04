import { SignInView } from "@entrust/account";
import { getMe } from "@/lib/api";

export const metadata = { title: "Sign in" };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ invitationId?: string }>;
}) {
  const { invitationId } = await searchParams;
  const me = await getMe();

  return (
    <SignInView
      appName="TRADE"
      logoSrc=""
      logoAlt="TRADE logo"
      tagline="Building export capability for African SMEs."
      description="TRADE equips African businesses to assess export readiness, close capability gaps, and navigate global trade."
      homePath="/"
      currentUser={me}
      invitationId={invitationId}
    />
  );
}
