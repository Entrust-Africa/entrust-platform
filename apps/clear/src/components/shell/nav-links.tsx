"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Briefcase, Building2, ShieldCheck, User } from "lucide-react";
import { cn } from "@entrust/ui";
import type { UserProfile } from "@/lib/types";

interface NavLinksProps {
  orientation?: "horizontal" | "vertical";
  onNavigate?: () => void;
  className?: string;
  user?: UserProfile;
}

export function NavLinks({ orientation = "horizontal", onNavigate, className, user }: NavLinksProps) {
  const pathname = usePathname();

  const navItems = [
    { href: "/", label: "Cases", icon: Briefcase, match: (path: string) => path === "/" || path.startsWith("/cases") },
    { href: "/organizations", label: "Organisation", icon: Building2, match: (path: string) => path.startsWith("/organizations") },
    ...(user?.staffRole
      ? [{ href: "/audit", label: "Audit", icon: ShieldCheck, match: (path: string) => path.startsWith("/audit") }]
      : []),
    { href: "/account", label: "Account", icon: User, match: (path: string) => path.startsWith("/account") },
  ];

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
