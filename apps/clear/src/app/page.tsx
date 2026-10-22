import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, Patchwork } from "@entrust/ui";
import { getSession } from "@/lib/session";
import { SignOutButton } from "./sign-out-button";

export default async function HomePage() {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  return (
    <div className="min-h-dvh">
      <header className="border-b border-line bg-surface">
        <Patchwork />
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-6">
          <p className="font-display text-base font-extrabold">
            CLEAR <span className="text-product-600">Export</span>
          </p>
          <div className="flex items-center gap-3 text-sm text-ink-2">
            <span className="hidden truncate sm:inline">{session.user.email}</span>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-10">
        <h1 className="font-display text-2xl font-bold">Export cases</h1>
        <Card className="mt-6 px-6 py-12 text-center">
          <p className="font-display text-lg font-bold">No export cases yet</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-ink-2">
            Case intake arrives with the GATE engine. Until then, the{" "}
            <Link href="/design" className="font-semibold text-brand-600 underline underline-offset-4">
              design system
            </Link>{" "}
            shows the components the case screens will use.
          </p>
        </Card>
      </main>
    </div>
  );
}
