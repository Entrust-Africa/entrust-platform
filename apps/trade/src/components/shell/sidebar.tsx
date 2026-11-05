"use client";

import { Patchwork } from "@entrust/ui";
import type { UserProfile } from "@/lib/types";
import { AccountMenu } from "./account-menu";
import { Brand } from "./brand";
import { NavLinks } from "./nav-links";
import { OrgSwitcher } from "./org-switcher";
import { switchablePlatforms } from "./platforms";

/**
 * The navigation on a computer: down the left, the width of the screen's height, with the links in groups so a long list stays
 * easy to scan. The organisation is at the top and the account at the foot. On a phone the same links are in the drawer
 * (`MobileNav`) and this is hidden.
 */
export function Sidebar({ user }: { user: UserProfile }) {
  return (
    <aside aria-label="Sidebar" className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-line bg-surface md:flex">
      <Patchwork />
      <div className="flex h-16 shrink-0 items-center px-5">
        <Brand />
      </div>
      <div className="shrink-0 px-4 pb-4">
        <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-ink-3">Organisation</p>
        <OrgSwitcher initialOrgId={user.activeOrganizationId ?? user.organizations?.[0]?.id} className="w-full" />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        <NavLinks user={user} />
      </div>
      <div className="shrink-0 border-t border-line p-3">
        <AccountMenu user={user} currentPlatform="trade" platforms={switchablePlatforms(user)} placement="top" className="w-full" />
      </div>
    </aside>
  );
}
