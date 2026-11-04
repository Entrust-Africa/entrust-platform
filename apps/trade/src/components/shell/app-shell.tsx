import type { UserProfile } from "@/lib/types";
import { AppHeader } from "./app-header";

interface AppShellProps {
  user: UserProfile;
  children: React.ReactNode;
}

export function AppShell({ user, children }: AppShellProps) {
  return (
    <div className="flex min-h-dvh flex-col bg-canvas text-ink">
      <AppHeader user={user} />
      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 outline-none">
        {children}
      </main>
    </div>
  );
}
