import { cookies } from "next/headers";
import { CheckEmailView } from "@entrust/account";
import { NEXT_COOKIE, nextFromCookie, signInHref } from "@/lib/next-path";

export const metadata = { title: "Check your email" };

export default async function CheckEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; invitationId?: string }>;
}) {
  const { email, invitationId } = await searchParams;
  // "Return to sign in" keeps a Summit visitor on their way back to the Summit.
  const next = nextFromCookie((await cookies()).get(NEXT_COOKIE)?.value);
  return <CheckEmailView email={email ?? ""} invitationId={invitationId} signInHref={!invitationId && next ? signInHref(next) : undefined} />;
}
