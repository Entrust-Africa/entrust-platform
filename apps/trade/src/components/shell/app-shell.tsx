import type { UserProfile } from "@/lib/types";
import { AppHeader } from "./app-header";
import { Sidebar } from "./sidebar";

interface AppShellProps {
  user: UserProfile;
  children: React.ReactNode;
}

export function AppShell({ user, children }: AppShellProps) {
  return (
    <div className="min-h-dvh bg-canvas text-ink md:flex">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-brand-600 focus:px-3 focus:py-1.5 focus:text-xs focus:font-semibold focus:text-white focus:shadow-md focus:outline-none focus:ring-2 focus:ring-brand-500"
      >
        Skip to content
      </a>
      <Sidebar user={user} />
      <div className="flex min-h-dvh min-w-0 flex-1 flex-col">
        <AppHeader user={user} />
        <main id="main" tabIndex={-1} className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 outline-none sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
