"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@entrust/ui";
import { isCurrent, type NavItem } from "./nav";

export function NavLinks({ items, orientation }: { items: NavItem[]; orientation: "horizontal" | "vertical" }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main">
      <ul className={cn("flex gap-1", orientation === "vertical" && "flex-col")}>
        {items.map((item) => {
          const current = isCurrent(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "block rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-brand-500",
                  current ? "bg-product-50 text-product-600 font-semibold" : "text-ink-2 hover:bg-canvas hover:text-ink",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
