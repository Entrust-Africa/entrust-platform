import { redirect } from "next/navigation";
import { MfaView } from "@entrust/account";
import { getMe } from "@/lib/api";

export const metadata = { title: "Two-step sign-in" };

export default async function MfaPage() {
  const me = await getMe();
  if (!me) redirect("/sign-in");
  // Only Entrust staff have a second step, and only once it's asked for and not yet passed.
  if (!me.mfa || !me.mfa.required || me.mfa.verified) redirect("/");
  return <MfaView email={me.email} enrolled={me.mfa.enrolled} />;
}
