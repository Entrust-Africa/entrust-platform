import { Members } from "./members";

export default async function MembersPage({ params }: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await params;
  return <Members organizationId={organizationId} />;
}
