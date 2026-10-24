import { InvitationAcceptance } from "./invitation-acceptance";

export default async function AcceptInvitationPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const { id } = await searchParams;
  return <InvitationAcceptance invitationId={id ?? ""} />;
}
