"use client";

import { Patchwork } from "@entrust/ui";
import type { UserProfile } from "@/lib/types";
import { AccountMenu } from "./account-menu";
import { Brand } from "./brand";
import { MobileNav } from "./mobile-nav";
import { switchablePlatforms } from "./platforms";

/** The bar across the top on a phone: the menu button, the name and the account. On a computer the sidebar does all of this. */
export function AppHeader({ user }: { user: UserProfile }) {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur-xs md:hidden print:hidden">
      <Patchwork />
      <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <MobileNav user={user} />
          <Brand />
        </div>
        <AccountMenu user={user} currentPlatform="trade" platforms={switchablePlatforms(user)} />
      </div>
    </header>
  );
}
