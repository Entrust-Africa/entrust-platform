import { redirect } from "next/navigation";
import { getMe } from "@/lib/api";
import { AppShell } from "@/components/shell/app-shell";

export default async function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const me = await getMe();
  if (!me) {
    redirect("/sign-in");
  }
  return <AppShell user={me}>{children}</AppShell>;
}
