import type { MizanAction } from "@entrust/roles";
import type { MizanAccess } from "@/lib/api";

export interface NavItem {
  href: string;
  label: string;
  /** Shown to staff who may do this. Without one, the item is for everyone with MIZAN access. */
  action?: MizanAction;
}

// The screens that exist. Each later screen (SMEs, assessments, review queue, dashboard, audit) adds its line here.
const ITEMS: NavItem[] = [
  { href: "/", label: "Home" },
  { href: "/methodology", label: "Methodology" },
];

export function navFor(access: MizanAccess): NavItem[] {
  return ITEMS.filter((i) => !i.action || access.actions.includes(i.action));
}

export const isCurrent = (pathname: string, href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`));
