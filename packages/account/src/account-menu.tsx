"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, LogOut, Settings, User } from "lucide-react";
import { cn } from "@entrust/ui";
import { PLATFORMS, mizanActionsFor } from "@entrust/roles";
import type { UserProfile } from "./types";
import { platformUrl, type PlatformId } from "./platform-url";
import { useSignOut } from "./use-sign-out";

export interface AccountMenuProps {
  user: UserProfile;
  className?: string;
  accountHref?: string;
  organizationsHref?: string;
  signOutRedirect?: string;
  currentPlatform?: PlatformId;
  platforms?: string[];
  clearAppUrl?: string;
  tradeAppUrl?: string;
  mizanAppUrl?: string;
  /**
   * Where the menu sits. "bottom" (the default) is a compact button in a header with the menu hanging under it; "top" is a
   * full-width button at the foot of a sidebar, always showing the name, with the menu opening upward.
   */
  placement?: "bottom" | "top";
}

function getInitials(name?: string, email?: string): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    const first = parts[0] ?? "";
    const second = parts[1] ?? "";
    if (parts.length >= 2 && first && second) {
      return `${first[0] ?? ""}${second[0] ?? ""}`.toUpperCase();
    }
    if (first) return first.slice(0, 2).toUpperCase();
  }
  if (email) return email.slice(0, 2).toUpperCase();
  return "EA";
}

export function AccountMenu({
  user,
  className,
  accountHref = "/account",
  organizationsHref = "/organizations",
  signOutRedirect = "/sign-in",
  currentPlatform = "clear",
  platforms,
  clearAppUrl,
  tradeAppUrl,
  mizanAppUrl,
  placement = "bottom",
}: AccountMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const activeOrg =
    user.organizations?.find((o) => o.id === user.activeOrganizationId) ?? user.organizations?.[0];
  // Staff see CLEAR and TRADE; MIZAN only for the staff it lets in (not cohort managers), Quality included. Everyone else sees
  // what their organisation has been given.
  const mizanStaff = mizanActionsFor({ staffRole: user.staffRole ?? null, quality: user.quality ?? false }).length > 0;
  const fromRole = user.staffRole ? ["clear", "trade"] : (activeOrg?.platforms ?? []);
  const activePlatforms = platforms ?? user.platforms ?? [...new Set([...fromRole, ...(mizanStaff ? ["mizan"] : [])])];
  const availablePlatforms = activePlatforms.filter((p: string) => (PLATFORMS as readonly string[]).includes(p));

  // The address of each platform comes from the app, then the deployment's setting, then the page's own address.
  const here = typeof window !== "undefined" ? window.location : undefined;
  const clearUrl = platformUrl({
    platform: "clear",
    current: currentPlatform,
    explicit: clearAppUrl,
    configured: process.env.NEXT_PUBLIC_CLEAR_APP_URL,
    location: here,
  });
  const tradeUrl = platformUrl({
    platform: "trade",
    current: currentPlatform,
    explicit: tradeAppUrl,
    configured: process.env.NEXT_PUBLIC_TRADE_APP_URL,
    location: here,
  });
  const mizanUrl = platformUrl({
    platform: "mizan",
    current: currentPlatform,
    explicit: mizanAppUrl,
    configured: process.env.NEXT_PUBLIC_MIZAN_APP_URL,
    location: here,
  });
  const switcher = (
    [
      { id: "clear", label: "CLEAR", href: clearUrl },
      { id: "trade", label: "TRADE", href: tradeUrl },
      { id: "mizan", label: "MIZAN", href: mizanUrl },
    ] as const
  ).filter((p) => availablePlatforms.includes(p.id));

  const { signOut, signingOut, signOutError } = useSignOut(signOutRedirect);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Escape" && isOpen) {
      event.stopPropagation();
      event.preventDefault();
      setIsOpen(false);
      triggerRef.current?.focus();
    }
  }

  function handleBlur(event: React.FocusEvent<HTMLDivElement>) {
    if (!menuRef.current?.contains(event.relatedTarget as Node)) {
      setIsOpen(false);
    }
  }

  const initials = getInitials(user.name, user.email);
  const upward = placement === "top";

  return (
    <div
      ref={menuRef}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
      className={cn("relative inline-block text-left", className)}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={isOpen}
        aria-controls="account-menu-popover"
        aria-label="Account menu"
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          "inline-flex h-9 items-center gap-2 rounded-md border border-line bg-surface px-2 text-xs font-semibold text-ink shadow-xs transition-colors",
          upward && "h-11 w-full",
          "hover:border-line-strong hover:bg-canvas focus-visible:outline-2 focus-visible:outline-brand-500",
          isOpen && "border-line-strong bg-canvas ring-1 ring-line-strong",
        )}
      >
        <span
          className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-600 font-display text-[10px] font-bold text-white uppercase"
          aria-hidden="true"
        >
          {initials}
        </span>
        <span className={cn("truncate", upward ? "min-w-0 flex-1 text-left" : "hidden max-w-[120px] lg:inline")}>{user.name || user.email}</span>
        <ChevronDown
          className={cn("size-3.5 shrink-0 text-ink-3 transition-transform duration-150", isOpen && "rotate-180")}
          aria-hidden="true"
        />
      </button>

      {isOpen && (
        <div
          id="account-menu-popover"
          className={cn(
            "absolute z-50 w-60 rounded-lg border border-line bg-surface p-1 shadow-lg ring-1 ring-black/5",
            upward ? "bottom-full left-0 mb-1.5 w-full origin-bottom-left" : "right-0 mt-1.5 origin-top-right",
          )}
        >
          <div className="border-b border-line px-3 py-2.5">
            <p className="truncate text-xs font-semibold text-ink">{user.name || "User"}</p>
            <p className="truncate text-[11px] text-ink-3">{user.email}</p>
          </div>

          {switcher.length > 0 && (
            <div className="border-b border-line py-1">
              <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-ink-3">
                Platforms
              </p>
              <div className="flex flex-col gap-0.5 px-1">
                {switcher.map((p) => (
                  <a
                    key={p.id}
                    href={p.href}
                    className={cn(
                      "flex items-center justify-between rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                      currentPlatform === p.id
                        ? "bg-brand-50 text-brand-700 font-semibold"
                        : "text-ink-2 hover:bg-canvas hover:text-ink",
                    )}
                  >
                    <span>{p.label}</span>
                    {currentPlatform === p.id && <span className="size-1.5 rounded-full bg-brand-600" aria-hidden="true" />}
                  </a>
                ))}
              </div>
            </div>
          )}

          <div className="py-1">
            <Link
              href={accountHref}
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-2.5 rounded-md px-3 py-2 text-xs font-medium text-ink-2 hover:bg-canvas hover:text-ink focus-visible:outline-2 focus-visible:outline-brand-500"
            >
              <User className="size-3.5 text-ink-3" aria-hidden="true" />
              <span>Account settings</span>
            </Link>
            <Link
              href={organizationsHref}
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-2.5 rounded-md px-3 py-2 text-xs font-medium text-ink-2 hover:bg-canvas hover:text-ink focus-visible:outline-2 focus-visible:outline-brand-500"
            >
              <Settings className="size-3.5 text-ink-3" aria-hidden="true" />
              <span>Organisation settings</span>
            </Link>
          </div>

          <div className="border-t border-line pt-1">
            {signOutError && (
              <p className="px-3 py-1 text-xs text-danger" role="alert">
                {signOutError}
              </p>
            )}
            <button
              type="button"
              disabled={signingOut}
              onClick={() => void signOut(() => setIsOpen(false))}
              className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-xs font-medium text-danger hover:bg-danger-50 focus-visible:outline-2 focus-visible:outline-brand-500"
            >
              <LogOut className="size-3.5" aria-hidden="true" />
              <span>{signingOut ? "Signing out..." : "Sign out"}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
