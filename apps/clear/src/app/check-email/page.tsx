import { CheckEmailView } from "@entrust/account";

export const metadata = { title: "Check your email" };

export default async function CheckEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; invitationId?: string }>;
}) {
  const { email, invitationId } = await searchParams;
  return <CheckEmailView email={email ?? ""} invitationId={invitationId} />;
}
