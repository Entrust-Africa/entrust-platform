import { EmailVerifiedView } from "@entrust/account";

export const metadata = { title: "Email verified" };

export default async function EmailVerifiedPage({
  searchParams,
}: {
  searchParams: Promise<{ invitationId?: string }>;
}) {
  const { invitationId } = await searchParams;
  return <EmailVerifiedView appName="CLEAR" invitationId={invitationId} />;
}
