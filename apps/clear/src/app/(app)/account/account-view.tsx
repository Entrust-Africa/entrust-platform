"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, CheckCircle2, KeyRound, LogOut, Shield, User } from "lucide-react";
import { Button, Card, StatusBadge } from "@entrust/ui";
import { authClient } from "@/lib/auth-client";

interface UserProfile {
  id: string;
  name: string;
  email: string;
  activeOrganizationId?: string | null;
}

export function AccountView({ user }: { user: UserProfile }) {
  const router = useRouter();
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [resetPending, setResetPending] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const { data: activeOrg } = authClient.useActiveOrganization();

  async function handleResetPassword() {
    setResetPending(true);
    setResetMessage(null);
    try {
      const result = await authClient.requestPasswordReset({
        email: user.email,
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (result.error) {
        setResetMessage(result.error.message ?? "Could not request a password reset.");
      } else {
        setResetMessage("A password reset link has been sent to your email.");
      }
    } catch {
      setResetMessage("Could not send password reset email. Please try again.");
    } finally {
      setResetPending(false);
    }
  }

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await authClient.signOut();
      router.replace("/sign-in");
      router.refresh();
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <div className="w-full">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-brand-600">CLEAR · Account</p>
        <h1 className="mt-2 font-display text-2xl font-bold tracking-tight sm:text-3xl">Account settings</h1>
        <p className="mt-1 text-sm text-ink-2">Manage your profile details, organisation association, and session.</p>
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        {/* Profile Card */}
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
              <User className="size-5" aria-hidden="true" />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold">Profile</h2>
              <p className="text-xs text-ink-3">Your personal account information</p>
            </div>
          </div>

          <dl className="mt-6 space-y-4 text-sm">
            <div>
              <dt className="text-xs font-semibold text-ink-3">Full name</dt>
              <dd className="mt-0.5 font-medium text-ink">{user.name || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-ink-3">Email address</dt>
              <dd className="mt-0.5 flex items-center gap-2 font-medium text-ink">
                <span>{user.email}</span>
                <StatusBadge tone="ok">Verified</StatusBadge>
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-ink-3">User ID</dt>
              <dd className="mt-0.5 font-mono text-xs text-ink-2">{user.id}</dd>
            </div>
          </dl>
        </Card>

        {/* Organisation Card */}
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-product-50 text-product-600">
              <Building2 className="size-5" aria-hidden="true" />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold">Organisation</h2>
              <p className="text-xs text-ink-3">Current workspace association</p>
            </div>
          </div>

          <div className="mt-6">
            {activeOrg ? (
              <div className="rounded-lg border border-line bg-surface-2 p-4">
                <p className="font-semibold text-ink">{activeOrg.name}</p>
                <p className="mt-0.5 text-xs text-ink-3">Slug: {activeOrg.slug}</p>
              </div>
            ) : (
              <div className="rounded-lg border border-line bg-surface-2 p-4">
                <p className="text-sm text-ink-2">No active organisation currently selected.</p>
              </div>
            )}

            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                href="/organizations"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-600 hover:text-brand-700 hover:underline"
              >
                <span>Manage organisations</span>
                <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
        </Card>

        {/* Security & Password Card */}
        <Card className="p-6 md:col-span-2">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-surface-2 text-ink-2">
              <Shield className="size-5" aria-hidden="true" />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold">Security & session</h2>
              <p className="text-xs text-ink-3">Password and authentication controls</p>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between border-t border-line pt-6">
            <div>
              <p className="text-sm font-semibold text-ink">Change password</p>
              <p className="mt-0.5 text-xs text-ink-3">We will send a password reset link to your email address.</p>
              {resetMessage && (
                <p className="mt-2 text-xs font-medium text-brand-600" role="status">
                  {resetMessage}
                </p>
              )}
            </div>
            <Button
              variant="secondary"
              size="sm"
              loading={resetPending}
              onClick={() => void handleResetPassword()}
            >
              <KeyRound className="size-3.5 mr-1.5" aria-hidden="true" />
              Send reset link
            </Button>
          </div>

          <div className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between border-t border-line pt-6">
            <div>
              <p className="text-sm font-semibold text-ink">Sign out</p>
              <p className="mt-0.5 text-xs text-ink-3">Terminate your active session on this browser.</p>
            </div>
            <Button
              variant="danger"
              size="sm"
              loading={signingOut}
              onClick={() => void handleSignOut()}
            >
              <LogOut className="size-3.5 mr-1.5" aria-hidden="true" />
              Sign out
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
