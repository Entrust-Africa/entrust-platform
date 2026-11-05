import { getMe } from "@/lib/api";
import { AppShell } from "@/components/shell/app-shell";
import { PublicShell } from "@/components/shell/public-shell";

export const metadata = {
  title: "Africa Diaspora Trade and Investment Summit",
  description: "Apply for the Africa Diaspora Trade and Investment Summit. Open to small and medium businesses from African countries.",
};

/**
 * The Summit's pages, in TRADE's frame. Anyone can open /summit; the pages under it need a sign-in and send a visitor
 * to the sign-in page first. Signed in, the visitor gets the app's header whatever platforms their organisation has.
 */
export default async function SummitLayout({ children }: { children: React.ReactNode }) {
  const me = await getMe();
  return me ? <AppShell user={me}>{children}</AppShell> : <PublicShell>{children}</PublicShell>;
}
