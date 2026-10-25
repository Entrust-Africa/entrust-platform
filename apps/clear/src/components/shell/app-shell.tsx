import { AppHeader } from "./app-header";

interface UserProfile {
  id: string;
  name: string;
  email: string;
  activeOrganizationId?: string | null;
}

interface AppShellProps {
  user: UserProfile;
  children: React.ReactNode;
}

export function AppShell({ user, children }: AppShellProps) {
  return (
    <div className="flex min-h-dvh flex-col bg-canvas text-ink">
      <AppHeader user={user} />
      <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">
        {children}
      </div>
    </div>
  );
}
