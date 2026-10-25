"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, LogOut, Settings, User } from "lucide-react";
import { cn } from "@entrust/ui";
import { authClient } from "@/lib/auth-client";

interface UserProfile {
  id: string;
  name: string;
  email: string;
  activeOrganizationId?: string | null;
}

interface AccountMenuProps {
  user: UserProfile;
  className?: string;
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

export function AccountMenu({ user, className }: AccountMenuProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await authClient.signOut();
      setIsOpen(false);
      router.replace("/sign-in");
      router.refresh();
    } finally {
      setSigningOut(false);
    }
  }

  const initials = getInitials(user.name, user.email);

  return (
    <div ref={menuRef} className={cn("relative inline-block text-left", className)}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
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
        <span className="hidden max-w-[120px] truncate sm:inline">{user.name || user.email}</span>
        <ChevronDown
          className={cn("size-3.5 shrink-0 text-ink-3 transition-transform duration-150", isOpen && "rotate-180")}
          aria-hidden="true"
        />
      </button>

      {isOpen && (
        <div
          role="menu"
          aria-orientation="vertical"
          className="absolute right-0 z-50 mt-1.5 w-60 origin-top-right rounded-lg border border-line bg-surface p-1 shadow-lg ring-1 ring-black/5"
        >
          <div className="border-b border-line px-3 py-2.5">
            <p className="truncate text-xs font-semibold text-ink">{user.name || "User"}</p>
            <p className="truncate text-[11px] text-ink-3">{user.email}</p>
          </div>

          <div className="py-1">
            <Link
              href="/account"
              role="menuitem"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-2.5 rounded-md px-3 py-2 text-xs font-medium text-ink-2 hover:bg-canvas hover:text-ink focus-visible:outline-2 focus-visible:outline-brand-500"
            >
              <User className="size-3.5 text-ink-3" aria-hidden="true" />
              <span>Account settings</span>
            </Link>
            <Link
              href="/organizations"
              role="menuitem"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-2.5 rounded-md px-3 py-2 text-xs font-medium text-ink-2 hover:bg-canvas hover:text-ink focus-visible:outline-2 focus-visible:outline-brand-500"
            >
              <Settings className="size-3.5 text-ink-3" aria-hidden="true" />
              <span>Organisation settings</span>
            </Link>
          </div>

          <div className="border-t border-line pt-1">
            <button
              type="button"
              role="menuitem"
              disabled={signingOut}
              onClick={() => void handleSignOut()}
              className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-xs font-semibold text-danger hover:bg-danger-50 focus-visible:outline-2 focus-visible:outline-brand-500"
            >
              <LogOut className="size-3.5 text-danger" aria-hidden="true" />
              <span>{signingOut ? "Signing out..." : "Sign out"}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
