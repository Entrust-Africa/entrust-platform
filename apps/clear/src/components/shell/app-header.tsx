"use client";

import Link from "next/link";
import Image from "next/image";
import { Patchwork } from "@entrust/ui";
import { AccountMenu } from "./account-menu";
import { MobileNav } from "./mobile-nav";
import { NavLinks } from "./nav-links";
import { OrgSwitcher } from "./org-switcher";

interface UserProfile {
  id: string;
  name: string;
  email: string;
  activeOrganizationId?: string | null;
}

interface AppHeaderProps {
  user: UserProfile;
}

export function AppHeader({ user }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur-xs">
      <Patchwork />
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
        {/* Left: Mobile trigger + Logo + Desktop Org Switcher */}
        <div className="flex items-center gap-3">
          <MobileNav user={user} />
          <Link
            href="/"
            aria-label="CLEAR Export"
            className="flex items-center transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-brand-500"
          >
            <Image
              src="/logo.jpg"
              alt="CLEAR Export"
              width={48}
              height={48}
              className="size-12 rounded-md object-contain"
              priority
            />
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
