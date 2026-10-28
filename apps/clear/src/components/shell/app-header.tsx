"use client";

import Link from "next/link";
import Image from "next/image";
import { Patchwork } from "@entrust/ui";
import type { UserProfile } from "@/lib/types";
import { AccountMenu } from "./account-menu";
import { MobileNav } from "./mobile-nav";
import { NavLinks } from "./nav-links";
import { OrgSwitcher } from "./org-switcher";

interface AppHeaderProps {
  user: UserProfile;
}

export function AppHeader({ user }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur-xs">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-brand-600 focus:px-3 focus:py-1.5 focus:text-xs focus:font-semibold focus:text-white focus:shadow-md focus:outline-none focus:ring-2 focus:ring-brand-500"
      >
        Skip to content
      </a>
      <Patchwork />
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
        {/* Left: Mobile trigger + Logo + Desktop Org Switcher */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          <MobileNav user={user} />
          <Link
            href="/"
            aria-label="CLEAR Export"
            className="flex items-center gap-2.5 rounded-md transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-brand-500"
          >
            <Image
              src="/logo.jpg"
              alt=""
              width={36}
              height={36}
              className="size-9 rounded-md object-contain"
              priority
            />
            <span className="font-display text-base font-extrabold tracking-tight text-ink">
              CLEAR <span className="text-product-600">Export</span>
            </span>
          </Link>

          <span className="hidden h-6 w-px bg-line sm:block" aria-hidden="true" />

          <div className="hidden sm:block">
            <OrgSwitcher initialOrgId={user.activeOrganizationId} />
          </div>
        </div>

        {/* Center: Desktop Navigation */}
        <div className="hidden md:flex md:items-center">
          <NavLinks orientation="horizontal" />
        </div>

        {/* Right: Account Menu */}
        <div className="flex items-center gap-2">
          <AccountMenu user={user} />
        </div>
      </div>
    </header>
  );
}
