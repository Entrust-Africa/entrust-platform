import { AcceptInvitationView } from "@entrust/account";
import { getMe } from "@/lib/api";

export const metadata = { title: "Organisation invitation" };

export default async function AcceptInvitationPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;
  const me = await getMe();
  return <AcceptInvitationView invitationId={id ?? ""} initialUser={me ?? null} appName="MIZAN" dashboardHref="/" />;
}
