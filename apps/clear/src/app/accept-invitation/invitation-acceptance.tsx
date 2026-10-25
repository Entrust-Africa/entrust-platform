"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@entrust/ui";
import { authClient } from "@/lib/auth-client";

export function InvitationAcceptance({
  invitationId,
  initialUser,
}: {
  invitationId: string;
  initialUser?: { id: string; email: string; name?: string } | null;
}) {
  const router = useRouter();
  const [message, setMessage] = useState(invitationId ? "" : "This invitation link is missing its invitation ID.");
  const [pending, setPending] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const signedIn = Boolean(initialUser);

  async function accept() {
    if (!invitationId) return;
    setPending(true);
    const result = await authClient.organization.acceptInvitation({ invitationId });
    setPending(false);
    if (result.error) {
      setMessage(result.error.message ?? "This invitation could not be accepted.");
    } else {
      setAccepted(true);
      setMessage("Invitation accepted. Welcome to the organisation.");
      router.refresh();
    }
  }

  const signInUrl = `/sign-in?invitationId=${encodeURIComponent(invitationId)}`;

  return (
    <main className="mx-auto flex min-h-screen max-w-xl items-center px-6">
      <section className="w-full rounded-lg border border-line bg-surface p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.12em] text-brand-600">Entrust Africa</p>
        <h1 className="mt-4 font-display text-3xl font-bold">Organisation invitation</h1>
        <p className="mt-3 text-ink-2">
          Sign in or create an account with the invited email address, then accept this invitation to access the
          organisation in CLEAR.
        </p>
        {signedIn && initialUser?.email && (
          <p className="mt-3 text-sm text-ink-2">
            Signed in as <strong>{initialUser.email}</strong>. Not you?{" "}
            <a href={signInUrl} className="font-semibold text-brand-600 underline-offset-4 hover:underline">
              Switch account
            </a>
          </p>
        )}
        {message && <p className="mt-6 rounded-md bg-brand-50 p-3 text-sm text-ink-2">{message}</p>}
        {accepted ? (
          <a
            className="mt-8 inline-flex h-10 items-center rounded-md bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700"
            href="/"
          >
            Go to CLEAR Dashboard →
          </a>
        ) : !signedIn ? (
          <a
            className="mt-8 inline-flex h-10 items-center rounded-md bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700"
            href={signInUrl}
          >
            Sign in to accept
          </a>
        ) : (
          <Button className="mt-8" onClick={() => void accept()} loading={pending} disabled={!invitationId}>
            Accept invitation
          </Button>
        )}
      </section>
    </main>
  );
}
