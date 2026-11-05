import { cookies } from "next/headers";
import { EmailVerifiedView } from "@entrust/account";
import { NEXT_COOKIE, nextFromCookie, signInHref } from "@/lib/next-path";

export const metadata = { title: "Email verified" };

export default async function EmailVerifiedPage({
  searchParams,
}: {
  searchParams: Promise<{ invitationId?: string }>;
}) {
  const { invitationId } = await searchParams;
  // Verifying signs the visitor in. "Continue" goes through the sign-in page, which sends a signed-in visitor on to
  // where they were headed (the Summit), instead of the learner home.
  const next = nextFromCookie((await cookies()).get(NEXT_COOKIE)?.value);
  return <EmailVerifiedView appName="TRADE" invitationId={invitationId} signInHref={next ? signInHref(next) : undefined} />;
}
