"use client";

import { useState } from "react";
import Link from "next/link";
import { Building2, CheckCircle2, KeyRound, LogOut, Shield, User } from "lucide-react";
import { Button, Card, StatusBadge } from "@entrust/ui";
import { authClient } from "./auth-client";
import type { UserProfile } from "./types";
import { useSignOut } from "./use-sign-out";

export interface AccountViewProps {
  user: UserProfile;
  platformName?: string;
  organizationsHref?: string;
}

export function AccountView({
  user,
  platformName = "CLEAR",
  organizationsHref = "/organizations",
}: AccountViewProps) {
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [resetPending, setResetPending] = useState(false);

  const { signOut, signingOut, signOutError } = useSignOut();
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
        setResetSuccess(false);
      } else {
        setResetMessage("A password reset link has been sent to your email.");
        setResetSuccess(true);
      }
    } catch {
      setResetMessage("Could not send password reset email. Please try again.");
      setResetSuccess(false);
    } finally {
      setResetPending(false);
    }
  }

  return (
    <div className="w-full">
      <div>
        <p className="text-xs font-bold tracking-wider text-brand-600 uppercase">
          {platformName} · Account
        </p>
        <h1 className="mt-2 font-display text-2xl font-bold tracking-tight sm:text-3xl">
          Account settings
        </h1>
        <p className="mt-1 text-sm text-ink-2">
          Manage your profile details, organisation association, and session.
        </p>
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
              <dd className="mt-0.5 font-mono text-xs text-ink-3">{user.id}</dd>
            </div>
          </dl>
        </Card>

        {/* Organisation Card */}
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
              <Building2 className="size-5" aria-hidden="true" />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold">Organisation</h2>
              <p className="text-xs text-ink-3">Your current active organisation context</p>
            </div>
          </div>

          <div className="mt-6">
            {activeOrg ? (
              <div className="rounded-md border border-line bg-canvas p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-ink">{activeOrg.name}</p>
                    <p className="text-xs text-ink-3">{activeOrg.slug}</p>
                  </div>
                  <span className="rounded bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-600">
                    Active
                  </span>
                </div>
                <div className="mt-4 border-t border-line pt-3">
                  <Link
                    href={`${organizationsHref}/${activeOrg.id}/members`}
                    className="text-xs font-semibold text-brand-600 underline-offset-4 hover:underline"
                  >
                    Manage organisation members →
                  </Link>
                </div>
              </div>
            ) : (
              <div className="rounded-md border border-line bg-canvas p-4 text-center">
                <p className="text-sm text-ink-2">No active organisation selected.</p>
                <Link
                  href={organizationsHref}
                  className="mt-2 inline-block text-xs font-semibold text-brand-600 underline-offset-4 hover:underline"
                >
                  View all organisations →
                </Link>
              </div>
            )}
          </div>
        </Card>

        {/* Security & Password Card */}
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
              <KeyRound className="size-5" aria-hidden="true" />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold">Password & Security</h2>
              <p className="text-xs text-ink-3">Request a password reset link for your account</p>
            </div>
          </div>

          <div className="mt-6">
            <p className="text-sm text-ink-2">
              To change your password, we can email you a secure reset link.
            </p>

            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="mt-4"
              loading={resetPending}
              onClick={() => void handleResetPassword()}
            >
              Send password reset email
            </Button>

            {resetMessage && (
              <p
                className={`mt-3 text-xs font-medium ${resetSuccess ? "text-brand-600" : "text-danger"}`}
                role={resetSuccess ? "status" : "alert"}
              >
                {resetMessage}
              </p>
            )}
          </div>
        </Card>

        {/* Session Card */}
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
              <Shield className="size-5" aria-hidden="true" />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold">Session</h2>
              <p className="text-xs text-ink-3">Manage your active authentication session</p>
            </div>
          </div>

          <div className="mt-6">
            <div className="flex items-center gap-2 text-xs text-ink-2">
              <CheckCircle2 className="size-4 text-ok" aria-hidden="true" />
              <span>Signed in via secure cookie</span>
            </div>

            {signOutError && (
              <p className="mt-3 text-xs text-danger" role="alert">
                {signOutError}
              </p>
            )}

            <div className="mt-6 border-t border-line pt-4">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="text-danger hover:border-danger hover:bg-danger-50 hover:text-danger"
                loading={signingOut}
                onClick={() => void signOut()}
              >
                <LogOut className="size-4" aria-hidden="true" />
                <span>Sign out of all apps</span>
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
