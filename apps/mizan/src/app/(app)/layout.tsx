import { redirect } from "next/navigation";
import { getMe, getMizanAccess, hasMizanAccess } from "@/lib/api";
import { AppShell } from "@/components/shell/app-shell";
import { NoAccess } from "@/components/no-access";

export default async function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const me = await getMe();
  if (!me) redirect("/sign-in");
  // Staff who haven't passed the second step go to it first (the API refuses them anything else).
  if (me.mfa?.required && !me.mfa.verified) redirect("/mfa");
  const access = await getMizanAccess();
  if (!hasMizanAccess(access)) return <NoAccess user={me} />;
  return (
    <AppShell user={me} access={access}>
      {children}
    </AppShell>
  );
}
