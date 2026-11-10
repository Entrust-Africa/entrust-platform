"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { tradeFetch } from "@/lib/trade-client";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  BookOpen,
  Briefcase,
  Calculator,
  CalendarRange,
  CheckSquare,
  ClipboardList,
  Coins,
  ExternalLink,
  FlaskConical,
  Ship,
  FolderGit2,
  GraduationCap,
  Handshake,
  Inbox,
  LayoutDashboard,
  ListChecks,
  ShieldCheck,
  Store,
  Mic2,
  TrendingUp,
  User,
  Users,
  FileText,
  FileEdit,
  Gavel, Percent, Sparkles, PackageCheck, Building2, Bell } from "lucide-react";
import { cn } from "@entrust/ui";
import type { UserProfile } from "@/lib/types";
import { summitAccess } from "@/lib/summit";
import { SIMULATOR_URL } from "@/lib/simulator";

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
  /** Another app: opens in a new tab and is never the current page. */
  external?: boolean;
}

/** Links that belong together, under a heading when they have one. */
interface NavGroup {
  heading?: string;
  items: NavItem[];
}

/** The selection committee's screens. */
function committeeLinks(): NavItem[] {
  return [
    { href: "/summit/committee", label: "Committee", icon: Gavel, match: (path) => path.startsWith("/summit/committee") },
    { href: "/summit/dashboard", label: "Selection dashboard", icon: BarChart3, match: (path) => path.startsWith("/summit/dashboard") },
    { href: "/summit/reports", label: "Summit reports", icon: FileText, match: (path) => path.startsWith("/summit/reports") },
  ];
}

/** The links this visitor gets, in groups: one list for the sidebar and the phone drawer. */
function baseGroupsFor(user: UserProfile | undefined): NavGroup[] {
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
  const practice: NavItem = { href: "/practice", label: "Export practice", icon: Ship, match: (path) => path.startsWith("/practice") };
  const simulator: NavItem = { href: SIMULATOR_URL, label: "Export simulator", icon: FlaskConical, match: () => false, external: true };
  const account: NavItem = { href: "/account", label: "Account", icon: User, match: (path) => path.startsWith("/account") };

  if (isStaff) {
    const groups: NavGroup[] = [
      {
        heading: "Programme",
        items: [
          { href: "/cohorts", label: "Cohorts", icon: Users, match: (path) => path === "/cohorts" || path.startsWith("/cohorts/") },
          { href: "/catalogue", label: "SME catalogue", icon: Store, match: (path) => path.startsWith("/catalogue") },
          { href: "/register", label: "SME register", icon: ClipboardList, match: (path) => path.startsWith("/register") },
          { href: "/diagnostics", label: "Diagnostics", icon: ListChecks, match: (path) => path.startsWith("/diagnostics") },
          { href: "/review-queue", label: "Review queue", icon: CheckSquare, match: (path) => path.startsWith("/review-queue") },
          { href: "/referrals", label: "Referrals", icon: Handshake, match: (path) => path.startsWith("/referrals") },
          { href: "/reports", label: "Programme reports", icon: TrendingUp, match: (path) => path.startsWith("/reports") },
          // Staff read the course content here. The pages are read-only for staff; changing a module means publishing a new version.
          { href: "/modules", label: "Modules", icon: GraduationCap, match: (path) => path.startsWith("/modules") },
          { href: "/admin/modules", label: "Course studio", icon: FileEdit, match: (path) => path.startsWith("/admin/modules") },
          simulator,
        ],
      },
    ];
    // The register and the diagnostics hold every business's answers. A reviewer works from the cohorts they're on.
    if (user?.staffRole === "reviewer") {
      groups[0]!.items = groups[0]!.items.filter(
        (item) => item.href !== "/register" && item.href !== "/diagnostics" && item.href !== "/admin/modules",
      );
    }
    // The Summit is one event with two sides: the businesses that apply to take part, and the commercial side (exhibitors,
    // sponsors, delegates, the directory).
    const summit: NavItem[] = [
      { href: "/summit/review", label: "Applications", icon: Inbox, match: (path) => path.startsWith("/summit/review") },
    ];
    // The committee's screens are for its members and the administrators and facilitators who run the selection.
    if (user?.staffRole === "admin" || user?.staffRole === "facilitator") summit.push(...committeeLinks());
    // An officer's reports hold the applications assigned to them.
    else summit.push(committeeLinks()[2]!);
    // Only an administrator sets application periods.
    if (user?.staffRole === "admin") {
      summit.push({ href: "/summit/admin/periods", label: "Application periods", icon: CalendarRange, match: (path) => path.startsWith("/summit/admin") });
    }
    // The ADTIS exhibition, sponsorship and delegate screens are for administrators and facilitators.
    if (user?.staffRole === "admin" || user?.staffRole === "facilitator") {
      summit.push({ href: "/summit/commerce", label: "Commercial (ADTIS)", icon: Handshake, match: (path) => path.startsWith("/summit/commerce") });
    }
    if (summit.length > 0) groups.push({ heading: "Summit", items: summit });
    groups.push({ items: [account] });
    return groups;
  }

  // Quality reads the programme's reports and nothing else.
  if (user?.quality) {
    return [{ items: [{ href: "/reports", label: "Programme reports", icon: TrendingUp, match: (path) => path.startsWith("/reports") }, account] }];
  }

  // A member of the selection committee is not staff: they get the committee's screens and nothing else of the Summit.
  if (user?.summitCommittee) return [{ heading: "Summit", items: committeeLinks() }, { items: [account] }];

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
    { href: "/worksheets", label: "Worksheets", icon: Calculator, match: (path) => path.startsWith("/worksheets") },
    { href: "/business", label: "My business", icon: Building2, match: (path) => path.startsWith("/business") },
    { href: "/portfolio", label: "Portfolio", icon: FolderGit2, match: (path) => path.startsWith("/portfolio") },
    { href: "/pipeline", label: "Pipeline", icon: Briefcase, match: (path) => path.startsWith("/pipeline") },
    { href: "/outcomes", label: "Financing & outcomes", icon: Coins, match: (path) => path.startsWith("/outcomes") },
    { href: "/transactions", label: "Export transactions", icon: PackageCheck, match: (path) => path.startsWith("/transactions") },
    { href: "/action-plan", label: "Action plan", icon: ListChecks, match: (path) => path.startsWith("/action-plan") },
    { href: "/tools/pricing", label: "Pricing calculator", icon: Percent, match: (path) => path.startsWith("/tools/pricing") },
    { href: "/ai-lab", label: "AI Practice Lab", icon: Sparkles, match: (path) => path.startsWith("/ai-lab") },
    practice,
    simulator,
    { href: "/consent", label: "What you share", icon: ShieldCheck, match: (path) => path.startsWith("/consent") },
  ];
  if (access?.hasSummit) items.push(summitItem);
  return [{ items: [...items, account] }];
}

/** Everyone gets their notifications, just above their account. */
function groupsFor(user: UserProfile | undefined): NavGroup[] {
  const groups = baseGroupsFor(user);
  const notifications: NavItem = { href: "/notifications", label: "Notifications", icon: Bell, match: (path) => path.startsWith("/notifications") };
  for (const group of groups) {
    const at = group.items.findIndex((item) => item.href === "/account");
    if (at >= 0) {
      group.items.splice(at, 0, notifications);
      break;
    }
  }
  return groups;
}

/** How many notifications are unread, asked again each minute. Quiet when the API can't be reached. */
function useUnread(enabled: boolean): number {
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    const load = async () => {
      const res = await tradeFetch<{ unread: number }>("GET", "/notifications?limit=1");
      if (live && res.data) setUnread(res.data.unread);
    };
    void load();
    const timer = setInterval(() => void load(), 60_000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [enabled]);
  return unread;
}

export function NavLinks({ onNavigate, className, user }: NavLinksProps) {
  const pathname = usePathname();
  const groups = groupsFor(user);
  const unread = useUnread(Boolean(user));

  return (
    <nav aria-label="Main Navigation" className={cn("flex flex-col gap-6", className)}>
      {groups.map((group, i) => (
        <div key={group.heading ?? `group-${i}`} role="group" aria-label={group.heading} className="flex flex-col gap-1">
          {group.heading && <p className="px-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-ink-3">{group.heading}</p>}
          {group.items.map((item) => {
            const isActive = item.match(pathname);
            const Icon = item.icon;
            if (item.external) {
              return (
                <a
                  key={item.href}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={onNavigate}
                  className="flex min-h-[44px] items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-ink-2 transition-colors hover:bg-canvas hover:text-ink focus-visible:outline-2 focus-visible:outline-brand-500"
                >
                  <Icon className="size-5 shrink-0 text-ink-3" aria-hidden="true" />
                  <span>{item.label}</span>
                  <ExternalLink className="ml-auto size-4 shrink-0 text-ink-3" aria-hidden="true" />
                  <span className="sr-only">(opens in a new tab)</span>
                </a>
              );
            }
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
                {item.href === "/notifications" && unread > 0 && (
                  <span className="ml-auto rounded-full bg-brand-600 px-2 py-0.5 text-[11px] font-bold text-white">
                    {unread > 99 ? "99+" : unread}
                    <span className="sr-only"> unread</span>
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
