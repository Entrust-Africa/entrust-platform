import { getMe } from "@/lib/api";
import { redirect } from "next/navigation";
import { AccountView } from "./account-view";

export const metadata = {
  title: "Account",
};

export default async function AccountPage() {
  const me = await getMe();
  if (!me) {
    redirect("/sign-in");
  }
  return <AccountView user={me} />;
}
