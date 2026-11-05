"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, LogOut, Settings, User } from "lucide-react";
import { cn } from "@entrust/ui";
import { PLATFORMS, type Platform } from "@entrust/roles";
import type { UserProfile } from "./types";
import { platformUrl } from "./platform-url";
import { useSignOut } from "./use-sign-out";

export interface AccountMenuProps {
  user: UserProfile;
  className?: string;
  accountHref?: string;
  organizationsHref?: string;
  signOutRedirect?: string;
  currentPlatform?: "clear" | "trade";
  platforms?: string[];
  clearAppUrl?: string;
  tradeAppUrl?: string;
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
}: AccountMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const activeOrg =
    user.organizations?.find((o) => o.id === user.activeOrganizationId) ?? user.organizations?.[0];
  const activePlatforms =
    platforms ?? user.platforms ?? (user.staffRole ? ["clear", "trade"] : activeOrg?.platforms ?? []);
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
        <span className="hidden max-w-[120px] truncate lg:inline">{user.name || user.email}</span>
        <ChevronDown
          className={cn("size-3.5 shrink-0 text-ink-3 transition-transform duration-150", isOpen && "rotate-180")}
          aria-hidden="true"
        />
      </button>

      {isOpen && (
        <div
          id="account-menu-popover"
          className="absolute right-0 z-50 mt-1.5 w-60 origin-top-right rounded-lg border border-line bg-surface p-1 shadow-lg ring-1 ring-black/5"
        >
          <div className="border-b border-line px-3 py-2.5">
            <p className="truncate text-xs font-semibold text-ink">{user.name || "User"}</p>
            <p className="truncate text-[11px] text-ink-3">{user.email}</p>
          </div>

          {availablePlatforms.length > 0 && (
            <div className="border-b border-line py-1">
              <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-ink-3">
                Platforms
              </p>
              <div className="flex flex-col gap-0.5 px-1">
                {availablePlatforms.includes("clear") && (
                  <a
                    href={clearUrl}
                    className={cn(
                      "flex items-center justify-between rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                      currentPlatform === "clear"
                        ? "bg-brand-50 text-brand-700 font-semibold"
                        : "text-ink-2 hover:bg-canvas hover:text-ink",
                    )}
                  >
                    <span>CLEAR</span>
                    {currentPlatform === "clear" && (
                      <span className="size-1.5 rounded-full bg-brand-600" aria-hidden="true" />
                    )}
                  </a>
                )}
                {availablePlatforms.includes("trade") && (
                  <a
                    href={tradeUrl}
                    className={cn(
                      "flex items-center justify-between rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                      currentPlatform === "trade"
                        ? "bg-brand-50 text-brand-700 font-semibold"
                        : "text-ink-2 hover:bg-canvas hover:text-ink",
                    )}
                  >
                    <span>TRADE</span>
                    {currentPlatform === "trade" && (
                      <span className="size-1.5 rounded-full bg-brand-600" aria-hidden="true" />
                    )}
                  </a>
                )}
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
