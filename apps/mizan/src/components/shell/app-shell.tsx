import Image from "next/image";
import Link from "next/link";
import { AccountMenu } from "@entrust/account";
import { Patchwork } from "@entrust/ui";
import type { MizanAccess } from "@/lib/api";
import { tradeOrganizationsUrl } from "@/lib/links";
import type { UserProfile } from "@/lib/types";
import { MobileNav } from "./mobile-nav";
import { navFor } from "./nav";
import { NavLinks } from "./nav-links";

export function AppShell({ user, access, children }: { user: UserProfile; access: MizanAccess; children: React.ReactNode }) {
  const items = navFor(access);
  return (
    <div className="flex min-h-dvh flex-col bg-canvas text-ink">
      <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur-xs">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-brand-600 focus:px-3 focus:py-1.5 focus:text-xs focus:font-semibold focus:text-white focus:shadow-md focus:outline-none"
        >
          Skip to content
        </a>
        <Patchwork />
        <div className="relative mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <MobileNav items={items} />
            <Link href="/" aria-label="MIZAN home" className="flex items-center gap-2.5 rounded-md hover:opacity-90 focus-visible:outline-2 focus-visible:outline-brand-500">
              <Image src="/logo.png" alt="" width={36} height={36} className="size-9 rounded-md" priority />
              <span className="font-display text-base font-extrabold tracking-[0.18em] text-ink">MIZAN</span>
            </Link>
          </div>
          <div className="hidden md:block">
            <NavLinks items={items} orientation="horizontal" />
          </div>
          <AccountMenu user={user} currentPlatform="mizan" organizationsHref={tradeOrganizationsUrl()} />
        </div>
      </header>
      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 outline-none sm:px-6">
        {children}
      </main>
    </div>
  );
}
