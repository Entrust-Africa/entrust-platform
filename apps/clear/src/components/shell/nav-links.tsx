"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Briefcase, Building2, User } from "lucide-react";
import { cn } from "@entrust/ui";

const NAV_ITEMS = [
  { href: "/", label: "Cases", icon: Briefcase, match: (path: string) => path === "/" || path.startsWith("/cases") },
  { href: "/organizations", label: "Organisation", icon: Building2, match: (path: string) => path.startsWith("/organizations") },
  { href: "/account", label: "Account", icon: User, match: (path: string) => path.startsWith("/account") },
] as const;

interface NavLinksProps {
  orientation?: "horizontal" | "vertical";
  onNavigate?: () => void;
  className?: string;
}

export function NavLinks({ orientation = "horizontal", onNavigate, className }: NavLinksProps) {
  const pathname = usePathname();

  if (orientation === "vertical") {
    return (
      <nav aria-label="Main Navigation" className={cn("flex flex-col gap-1", className)}>
        {NAV_ITEMS.map((item) => {
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
      {NAV_ITEMS.map((item) => {
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
