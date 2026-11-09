import { redirect } from "next/navigation";
import { getMe } from "@/lib/api";
import { AppShell } from "@/components/shell/app-shell";

export default async function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const me = await getMe();
  if (!me) {
    redirect("/sign-in");
  }
  // Staff who haven't passed the second step go to it first (the API refuses them anything else).
  if (me.mfa?.required && !me.mfa.verified) {
    redirect("/mfa");
  }
  return <AppShell user={me}>{children}</AppShell>;
}
