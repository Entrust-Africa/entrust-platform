"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  Briefcase,
  CheckSquare,
  FileText,
  FolderGit2,
  GraduationCap,
  LayoutDashboard,
  Mic2,
  TrendingUp,
  User,
  Users,
} from "lucide-react";
import { cn } from "@entrust/ui";
import type { UserProfile } from "@/lib/types";
import { summitAccess } from "@/lib/summit";

interface NavLinksProps {
  orientation?: "horizontal" | "vertical";
  onNavigate?: () => void;
  className?: string;
  user?: UserProfile;
}

export function NavLinks({ orientation = "horizontal", onNavigate, className, user }: NavLinksProps) {
  const pathname = usePathname();

  const activeOrg =
    user?.organizations?.find((o) => o.id === user.activeOrganizationId) ?? user?.organizations?.[0];
  const isStaff = Boolean(user?.staffRole);
  const isSponsor = activeOrg?.kind === "sponsor";
  // An organisation with the Summit and not TRADE has no learner pages to go to, so it gets the Summit and nothing else.
  const access = user ? summitAccess(user) : undefined;
  const summitItem = {
    href: "/summit/apply",
    label: "Summit",
    icon: Mic2,
    match: (path: string) => path.startsWith("/summit"),
  };

  let navItems: {
    href: string;
    label: string;
    icon: typeof BookOpen;
    match: (path: string) => boolean;
  }[] = [];

  if (isStaff) {
    navItems = [
      { href: "/cohorts", label: "Cohorts", icon: Users, match: (path: string) => path === "/cohorts" || path.startsWith("/cohorts/") },
      { href: "/review-queue", label: "Review queue", icon: CheckSquare, match: (path: string) => path.startsWith("/review-queue") },
      { href: "/reports", label: "Reports", icon: TrendingUp, match: (path: string) => path.startsWith("/reports") },
    ];
    // Only an administrator sets application periods.
    if (user?.staffRole === "admin") {
      navItems.push({ ...summitItem, href: "/summit/admin/periods", match: (path: string) => path.startsWith("/summit") });
    }
  } else if (isSponsor) {
    navItems = [
      { href: "/reports", label: "Reports", icon: TrendingUp, match: (path: string) => path.startsWith("/reports") },
    ];
  } else if (access?.summitOnly) {
    navItems = [summitItem];
  } else {
    // SME navigation
    navItems = [
      { href: "/", label: "My plan", icon: LayoutDashboard, match: (path: string) => path === "/" || path.startsWith("/plan") },
      { href: "/modules", label: "Modules", icon: GraduationCap, match: (path: string) => path.startsWith("/modules") },
      { href: "/portfolio", label: "Portfolio", icon: FolderGit2, match: (path: string) => path.startsWith("/portfolio") },
      { href: "/pipeline", label: "Pipeline", icon: Briefcase, match: (path: string) => path.startsWith("/pipeline") },
    ];
    if (access?.hasSummit) navItems.push(summitItem);
  }

  // Account is available to all
  navItems.push({
    href: "/account",
    label: "Account",
    icon: User,
    match: (path: string) => path.startsWith("/account"),
  });

  if (orientation === "vertical") {
    return (
      <nav aria-label="Main Navigation" className={cn("flex flex-col gap-1", className)}>
        {navItems.map((item) => {
          const isActive = item.match(pathname);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors min-h-[44px]",
                isActive
                  ? "bg-brand-50 text-brand-900 shadow-xs"
                  : "text-ink-2 hover:bg-canvas hover:text-ink",
                "focus-visible:outline-2 focus-visible:outline-brand-500",
              )}
            >
              <Icon className={cn("size-5 shrink-0", isActive ? "text-brand-600" : "text-ink-3")} aria-hidden="true" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <nav aria-label="Main Navigation" className={cn("flex items-center gap-1", className)}>
      {navItems.map((item) => {
        const isActive = item.match(pathname);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "relative inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
              isActive
                ? "bg-brand-50 text-brand-900 shadow-xs"
                : "text-ink-2 hover:bg-canvas hover:text-ink",
              "focus-visible:outline-2 focus-visible:outline-brand-500",
            )}
          >
            <Icon className={cn("size-3.5 shrink-0", isActive ? "text-brand-600" : "text-ink-3")} aria-hidden="true" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
