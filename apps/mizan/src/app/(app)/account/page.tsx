import { redirect } from "next/navigation";
import { AccountView } from "@entrust/account";
import { afriConnectSignInShown } from "@entrust/auth/africonnect";
import { getMe } from "@/lib/api";
import { tradeOrganizationsUrl } from "@/lib/links";

export const metadata = { title: "Account" };

export default async function AccountPage() {
  const me = await getMe();
  if (!me) redirect("/sign-in");
  return <AccountView user={me} platformName="MIZAN" organizationsHref={tradeOrganizationsUrl()} afriConnect={afriConnectSignInShown()} />;
}
