"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import type { NavItem } from "./nav";
import { NavLinks } from "./nav-links";

/** The menu on a phone: a button that opens the same links under the header. */
export function MobileNav({ items }: { items: NavItem[] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => setOpen(false), [pathname]);
  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="mobile-nav"
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen(!open)}
        className="grid size-9 place-items-center rounded-md text-ink-2 hover:bg-canvas focus-visible:outline-2 focus-visible:outline-brand-500"
      >
        {open ? <X className="size-5" aria-hidden="true" /> : <Menu className="size-5" aria-hidden="true" />}
      </button>
      {open && (
        <div id="mobile-nav" className="absolute inset-x-0 top-full border-b border-line bg-surface p-3 shadow-md">
          <NavLinks items={items} orientation="vertical" />
        </div>
      )}
    </div>
  );
}
