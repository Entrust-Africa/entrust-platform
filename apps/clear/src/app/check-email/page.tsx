import { CheckEmail } from "./check-email";

export default async function CheckEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; invitationId?: string }>;
}) {
  const { email, invitationId } = await searchParams;
  return <CheckEmail email={email ?? ""} invitationId={invitationId} />;
}
