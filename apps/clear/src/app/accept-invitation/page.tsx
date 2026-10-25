import { getMe } from "@/lib/api";
import { InvitationAcceptance } from "./invitation-acceptance";

export default async function AcceptInvitationPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const { id } = await searchParams;
  const me = await getMe();
  return <InvitationAcceptance invitationId={id ?? ""} initialUser={me ?? null} />;
}
