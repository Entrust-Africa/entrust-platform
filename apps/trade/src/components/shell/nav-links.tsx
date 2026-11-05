"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  Briefcase,
  CheckSquare,
  ClipboardList,
  FolderGit2,
  GraduationCap,
  LayoutDashboard,
  ShieldCheck,
  Store,
  Mic2,
  TrendingUp,
  User,
  Users,
  FileText,
} from "lucide-react";
import { cn } from "@entrust/ui";
import type { UserProfile } from "@/lib/types";
import { summitAccess } from "@/lib/summit";

interface NavLinksProps {
  onNavigate?: () => void;
  className?: string;
  user?: UserProfile;
}

interface NavItem {
  href: string;
  label: string;
  icon: typeof BookOpen;
  match: (path: string) => boolean;
}

/** Links that belong together, under a heading when they have one. */
interface NavGroup {
  heading?: string;
  items: NavItem[];
}

/** The links this visitor gets, in groups: one list for the sidebar and the phone drawer. */
function groupsFor(user: UserProfile | undefined): NavGroup[] {
  const activeOrg = user?.organizations?.find((o) => o.id === user.activeOrganizationId) ?? user?.organizations?.[0];
  const isStaff = Boolean(user?.staffRole);
  const isSponsor = activeOrg?.kind === "sponsor";
  // An organisation with the Summit and not TRADE has no learner pages to go to, so it gets the Summit and nothing else.
  const access = user ? summitAccess(user) : undefined;
  const summitItem: NavItem = {
    href: "/summit/apply",
    label: "Summit",
    icon: Mic2,
    match: (path) => path.startsWith("/summit"),
  };
  const account: NavItem = { href: "/account", label: "Account", icon: User, match: (path) => path.startsWith("/account") };

  if (isStaff) {
    const groups: NavGroup[] = [
      {
        heading: "Programme",
        items: [
          { href: "/cohorts", label: "Cohorts", icon: Users, match: (path) => path === "/cohorts" || path.startsWith("/cohorts/") },
          { href: "/catalogue", label: "SME catalogue", icon: Store, match: (path) => path.startsWith("/catalogue") },
          { href: "/register", label: "SME register", icon: ClipboardList, match: (path) => path.startsWith("/register") },
          { href: "/review-queue", label: "Review queue", icon: CheckSquare, match: (path) => path.startsWith("/review-queue") },
          { href: "/reports", label: "Reports", icon: TrendingUp, match: (path) => path.startsWith("/reports") },
        ],
      },
    ];
    // The Summit is one event with two sides: the businesses that apply to take part, and the commercial side (exhibitors,
    // sponsors, delegates, the directory).
    const summit: NavItem[] = [];
    // Only an administrator sets application periods.
    if (user?.staffRole === "admin") {
      summit.push({ href: "/summit/admin/periods", label: "Applications", icon: FileText, match: (path) => path.startsWith("/summit") && !path.startsWith("/summit/commerce") });
    }
    // The ADTIS exhibition, sponsorship and delegate screens are for administrators and facilitators.
    if (user?.staffRole === "admin" || user?.staffRole === "facilitator") {
      summit.push({ href: "/summit/commerce", label: "Commercial (ADTIS)", icon: Store, match: (path) => path.startsWith("/summit/commerce") });
    }
    if (summit.length > 0) groups.push({ heading: "Summit", items: summit });
    groups.push({ items: [account] });
    return groups;
  }

  if (isSponsor) {
    return [
      {
        items: [
          { href: "/sponsor", label: "Cohorts", icon: Users, match: (path) => path.startsWith("/sponsor") },
          { href: "/reports", label: "Reports", icon: TrendingUp, match: (path) => path.startsWith("/reports") },
          account,
        ],
      },
    ];
  }

  if (access?.summitOnly) return [{ items: [summitItem, account] }];

  // SME navigation
  const items: NavItem[] = [
    { href: "/", label: "My plan", icon: LayoutDashboard, match: (path) => path === "/" || path.startsWith("/plan") },
    { href: "/modules", label: "Modules", icon: GraduationCap, match: (path) => path.startsWith("/modules") },
    { href: "/portfolio", label: "Portfolio", icon: FolderGit2, match: (path) => path.startsWith("/portfolio") },
    { href: "/pipeline", label: "Pipeline", icon: Briefcase, match: (path) => path.startsWith("/pipeline") },
    { href: "/consent", label: "What you share", icon: ShieldCheck, match: (path) => path.startsWith("/consent") },
  ];
  if (access?.hasSummit) items.push(summitItem);
  return [{ items: [...items, account] }];
}

export function NavLinks({ onNavigate, className, user }: NavLinksProps) {
  const pathname = usePathname();
  const groups = groupsFor(user);

  return (
    <nav aria-label="Main Navigation" className={cn("flex flex-col gap-6", className)}>
      {groups.map((group, i) => (
        <div key={group.heading ?? `group-${i}`} role="group" aria-label={group.heading} className="flex flex-col gap-1">
          {group.heading && <p className="px-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-ink-3">{group.heading}</p>}
          {group.items.map((item) => {
            const isActive = item.match(pathname);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex min-h-[44px] items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors",
                  isActive ? "bg-brand-50 text-brand-900 shadow-xs" : "text-ink-2 hover:bg-canvas hover:text-ink",
                  "focus-visible:outline-2 focus-visible:outline-brand-500",
                )}
              >
                <Icon className={cn("size-5 shrink-0", isActive ? "text-brand-600" : "text-ink-3")} aria-hidden="true" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
