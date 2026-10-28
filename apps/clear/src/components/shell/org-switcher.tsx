"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, Check, ChevronDown, Plus, Settings } from "lucide-react";
import { cn } from "@entrust/ui";
import { authClient } from "@/lib/auth-client";

interface OrgSwitcherProps {
  initialOrgId?: string | null;
  className?: string;
  onSelect?: () => void;
}

export function OrgSwitcher({ initialOrgId, className, onSelect }: OrgSwitcherProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [switchError, setSwitchError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const { data: activeOrg, isPending: activePending } = authClient.useActiveOrganization();
  const { data: orgs, isPending: listPending } = authClient.useListOrganizations();

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
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
    if (!containerRef.current?.contains(event.relatedTarget as Node)) {
      setIsOpen(false);
    }
  }

  const active = typeof activeOrg === "object" && activeOrg !== null ? activeOrg : null;
  const currentOrg = active ?? (initialOrgId ? orgs?.find((o) => o.id === initialOrgId) : undefined) ?? orgs?.[0];

  async function handleSwitch(orgId: string) {
    if (active && active.id === orgId) {
      setIsOpen(false);
      onSelect?.();
      return;
    }
    setSwitchingId(orgId);
    setSwitchError(null);
    try {
      const res = await authClient.organization.setActive({ organizationId: orgId });
      if (res?.error) {
        setSwitchError(res.error.message ?? "Could not switch organisation.");
        return;
      }
      setIsOpen(false);
      onSelect?.();
      router.refresh();
    } catch {
      setSwitchError("Network error while switching organisation.");
    } finally {
      setSwitchingId(null);
    }
  }

  const displayName = currentOrg?.name ?? (activePending || listPending ? "Loading..." : "Select organisation");

  return (
    <div
      ref={containerRef}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
      className={cn("relative inline-block text-left", className)}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={isOpen}
        aria-controls="org-switcher-popover"
        aria-label={`Active organisation: ${displayName}`}
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          "inline-flex h-9 w-full sm:max-w-[150px] lg:max-w-[220px] items-center justify-between gap-2 rounded-md border border-line bg-surface px-2.5 text-xs font-semibold text-ink shadow-xs transition-colors",
          "hover:border-line-strong hover:bg-canvas focus-visible:outline-2 focus-visible:outline-brand-500",
          isOpen && "border-line-strong bg-canvas ring-1 ring-line-strong",
        )}
      >
        <span className="flex items-center gap-2 truncate">
          <Building2 className="size-3.5 shrink-0 text-ink-3" aria-hidden="true" />
          <span className="truncate">{displayName}</span>
        </span>
        <ChevronDown
          className={cn("size-3.5 shrink-0 text-ink-3 transition-transform duration-150", isOpen && "rotate-180")}
          aria-hidden="true"
        />
      </button>

      {isOpen && (
        <div
          id="org-switcher-popover"
          className="absolute left-0 z-50 mt-1.5 w-full sm:w-64 origin-top-left rounded-lg border border-line bg-surface p-1 shadow-lg ring-1 ring-black/5"
        >
          <div className="px-2.5 py-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-ink-3">Organisations</p>
          </div>

          {switchError && (
            <p className="px-2.5 py-1 text-xs text-danger" role="alert">
              {switchError}
            </p>
          )}

          <div className="max-h-56 overflow-y-auto py-0.5">
            {orgs && orgs.length > 0 ? (
              orgs.map((org) => {
                const isSelected = currentOrg?.id === org.id;
                return (
                  <button
                    key={org.id}
                    type="button"
                    disabled={switchingId === org.id}
                    onClick={() => void handleSwitch(org.id)}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-2 text-left text-xs transition-colors",
                      isSelected ? "bg-brand-50 font-semibold text-brand-900" : "text-ink hover:bg-canvas",
                      "focus-visible:outline-2 focus-visible:outline-brand-500",
                    )}
                  >
                    <div className="min-w-0">
                      <p className="truncate">{org.name}</p>
                      <p className="truncate text-[10px] text-ink-3">{org.slug}</p>
                    </div>
                    {isSelected ? (
                      <Check className="size-3.5 shrink-0 text-brand-600" aria-hidden="true" />
                    ) : null}
                  </button>
                );
              })
            ) : (
              <p className="px-2.5 py-2 text-xs text-ink-3">No organisations yet.</p>
            )}
          </div>

          <div className="mt-1 border-t border-line pt-1">
            <Link
              href="/organizations#create-organisation"
              onClick={() => {
                setIsOpen(false);
                onSelect?.();
              }}
              className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium text-ink-2 hover:bg-canvas hover:text-ink focus-visible:outline-2 focus-visible:outline-brand-500"
            >
              <Plus className="size-3.5 text-ink-3" aria-hidden="true" />
              <span>Create organisation</span>
            </Link>
            <Link
              href="/organizations"
              onClick={() => {
                setIsOpen(false);
                onSelect?.();
              }}
              className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium text-ink-2 hover:bg-canvas hover:text-ink focus-visible:outline-2 focus-visible:outline-brand-500"
            >
              <Settings className="size-3.5 text-ink-3" aria-hidden="true" />
              <span>Manage organisations</span>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
