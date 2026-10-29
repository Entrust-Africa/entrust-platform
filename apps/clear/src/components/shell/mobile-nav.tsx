"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import Image from "next/image";
import { LogOut, Menu, X } from "lucide-react";
import { Patchwork } from "@entrust/ui";
import type { UserProfile } from "@/lib/types";
import { useSignOut } from "@/lib/use-sign-out";
import { NavLinks } from "./nav-links";
import { OrgSwitcher } from "./org-switcher";

interface MobileNavProps {
  user: UserProfile;
}

export function MobileNav({ user }: MobileNavProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const wasOpenRef = useRef(false);

  const { signOut, signingOut, signOutError } = useSignOut();

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

  // Handle focus movement on open and close
  useEffect(() => {
    if (isOpen) {
      wasOpenRef.current = true;
      const id = requestAnimationFrame(() => {
        closeButtonRef.current?.focus();
      });
      return () => cancelAnimationFrame(id);
    } else if (wasOpenRef.current) {
      wasOpenRef.current = false;
      triggerRef.current?.focus();
    }
  }, [isOpen]);

  // Window-level Escape listener as fallback if focus is outside the portal
  useEffect(() => {
    if (!isOpen) return;
    function handleWindowKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !event.defaultPrevented) {
        setIsOpen(false);
      }
    }
    window.addEventListener("keydown", handleWindowKeyDown);
    return () => window.removeEventListener("keydown", handleWindowKeyDown);
  }, [isOpen]);

  // Close drawer if viewport expands to desktop breakpoint (>= 768px)
  useEffect(() => {
    if (!isOpen) return;
    function handleResize() {
      if (window.innerWidth >= 768) {
        setIsOpen(false);
      }
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [isOpen]);

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.stopPropagation();
      setIsOpen(false);
      return;
    }

    if (event.key === "Tab") {
      if (!drawerRef.current) return;
      const focusable = drawerRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey) {
        if (document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        }
      } else {
        if (document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    }
  }

  return (
    <div className="md:hidden">
      <button
        ref={triggerRef}
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
          <div
            ref={drawerRef}
            onKeyDown={handleKeyDown}
            className="fixed inset-0 z-[100] flex"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation drawer"
          >
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
                <div className="flex h-16 shrink-0 items-center justify-between border-b border-line bg-surface px-5">
                  <Link
                    href="/"
                    onClick={() => setIsOpen(false)}
                    aria-label="CLEAR Export"
                    className="flex items-center gap-2.5 transition-opacity hover:opacity-90"
                  >
                    <Image
                      src="/logo.jpg"
                      alt=""
                      width={36}
                      height={36}
                      className="size-9 rounded-md object-contain"
                    />
                    <span className="font-display text-base font-extrabold tracking-tight text-ink">
                      CLEAR <span className="text-product-600">Export</span>
                    </span>
                  </Link>
                  <button
                    ref={closeButtonRef}
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
                  <NavLinks orientation="vertical" onNavigate={() => setIsOpen(false)} user={user} />
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
                {signOutError && (
                  <p className="mb-2 text-xs text-danger" role="alert">
                    {signOutError}
                  </p>
                )}
                <button
                  type="button"
                  disabled={signingOut}
                  onClick={() => void signOut(() => setIsOpen(false))}
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
