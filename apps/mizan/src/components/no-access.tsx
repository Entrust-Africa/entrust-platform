import Image from "next/image";
import { AccountMenu } from "@entrust/account";
import { Patchwork } from "@entrust/ui";
import { tradeOrganizationsUrl } from "@/lib/links";
import type { UserProfile } from "@/lib/types";

/** For someone signed in who has nothing in MIZAN: a cohort manager, a sponsor, an SME that hasn't been assessed. */
export function NoAccess({ user }: { user: UserProfile }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl items-center px-4 py-8 sm:px-6">
      <section className="w-full overflow-hidden rounded-lg border border-line bg-surface shadow-xs">
        <Patchwork />
        <div className="p-6 sm:p-8">
          <div className="flex items-center justify-between gap-3">
            <Image src="/logo.png" alt="MIZAN" width={48} height={48} className="size-12 rounded-md" />
            <AccountMenu user={user} currentPlatform="mizan" organizationsHref={tradeOrganizationsUrl()} />
          </div>
          <h1 className="mt-5 font-display text-2xl font-bold tracking-tight text-ink">You don't have access to MIZAN</h1>
          <p className="mt-3 text-sm text-ink-2">
            MIZAN is for Entrust Africa's assessors and for the businesses they have assessed. Your account, {user.email}, has neither.
          </p>
          <p className="mt-3 text-sm text-ink-2">If you think it should, ask the person at Entrust Africa you work with.</p>
        </div>
      </section>
    </main>
  );
}
