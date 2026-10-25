"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, Menu, X } from "lucide-react";
import { Patchwork } from "@entrust/ui";
import { authClient } from "@/lib/auth-client";
import { NavLinks } from "./nav-links";
import { OrgSwitcher } from "./org-switcher";

interface UserProfile {
  id: string;
  name: string;
  email: string;
  activeOrganizationId?: string | null;
}

interface MobileNavProps {
  user: UserProfile;
}

export function MobileNav({ user }: MobileNavProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [isOpen]);

  // Handle escape key
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

  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-label={isOpen ? "Close main navigation" : "Open main navigation"}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((prev) => !prev)}
        className="inline-flex size-9 items-center justify-center rounded-md border border-line bg-surface text-ink hover:bg-canvas focus-visible:outline-2 focus-visible:outline-brand-500"
      >
        {isOpen ? <X className="size-4" aria-hidden="true" /> : <Menu className="size-4" aria-hidden="true" />}
      </button>

      {isOpen &&
        mounted &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex" role="dialog" aria-modal="true" aria-label="Navigation drawer">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-ink/60 backdrop-blur-xs transition-opacity"
              aria-hidden="true"
              onClick={() => setIsOpen(false)}
            />

            {/* Solid Drawer Content */}
            <div className="relative z-10 flex h-dvh w-full max-w-xs flex-col justify-between bg-surface shadow-2xl">
              <div className="flex flex-col overflow-y-auto">
                <Patchwork />
                <div className="flex h-14 shrink-0 items-center justify-between border-b border-line bg-surface px-5">
                  <Link
                    href="/"
                    onClick={() => setIsOpen(false)}
                    className="font-display text-base font-extrabold tracking-tight text-ink"
                  >
                    CLEAR <span className="text-product-600">Export</span>
                  </Link>
                  <button
                    type="button"
                    aria-label="Close drawer"
                    onClick={() => setIsOpen(false)}
                    className="inline-flex size-8 items-center justify-center rounded-md border border-line text-ink-3 hover:bg-canvas hover:text-ink focus-visible:outline-2 focus-visible:outline-brand-500"
                  >
                    <X className="size-4" aria-hidden="true" />
                  </button>
                </div>

                {/* Organisation switcher section */}
                <div className="border-b border-line bg-surface p-4">
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-ink-3">Organisation</p>
                  <OrgSwitcher
                    initialOrgId={user.activeOrganizationId}
                    className="w-full"
                    onSelect={() => setIsOpen(false)}
                  />
                </div>

                {/* Navigation links */}
                <div className="bg-surface p-4">
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-ink-3">Menu</p>
                  <NavLinks orientation="vertical" onNavigate={() => setIsOpen(false)} />
                </div>
              </div>

              {/* Bottom user profile & sign out */}
              <div className="shrink-0 border-t border-line bg-surface-2 p-4">
                <div className="mb-3 flex items-center gap-3">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-600 font-display text-xs font-bold text-white uppercase">
                    {(user.name?.[0] || user.email[0] || "U").toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-ink">{user.name || "User"}</p>
                    <p className="truncate text-[11px] text-ink-3">{user.email}</p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={signingOut}
                  onClick={() => void handleSignOut()}
                  className="flex w-full items-center justify-center gap-2 rounded-md border border-line bg-surface py-2.5 text-xs font-semibold text-danger shadow-xs hover:bg-danger-50 focus-visible:outline-2 focus-visible:outline-brand-500"
                >
                  <LogOut className="size-3.5 text-danger" aria-hidden="true" />
                  <span>{signingOut ? "Signing out..." : "Sign out"}</span>
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
