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
      appName="CLEAR"
      logoSrc="/logo.jpg"
      logoAlt="CLEAR Export logo"
      tagline="Your export cases, step by step."
      description="CLEAR Export tracks every permit, document and deadline from first order to the final foreign exchange settlement."
      homePath="/"
      currentUser={me}
      invitationId={invitationId}
    />
  );
}
