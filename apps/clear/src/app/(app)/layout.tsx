import Link from "next/link";
import { redirect } from "next/navigation";
import { Patchwork } from "@entrust/ui";
import { getMe } from "@/lib/api";
import { SignOutButton } from "../sign-out-button";

// The signed-in part of CLEAR. A plain header until the app shell (#19) replaces it. Each page
// still checks its own data with the API, which refuses a visitor who isn't signed in.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const me = await getMe();
  if (!me) redirect("/sign-in");
  return (
    <div className="min-h-dvh">
      <header className="border-b border-line bg-surface">
        <Patchwork />
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/" className="font-display text-base font-extrabold">
            CLEAR <span className="text-product-600">Export</span>
          </Link>
          <div className="flex min-w-0 items-center gap-3 text-sm text-ink-2">
            <span className="hidden truncate sm:inline">{me.email}</span>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">{children}</main>
    </div>
  );
}
