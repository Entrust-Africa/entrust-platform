"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@entrust/ui";
import { authClient } from "@/lib/auth-client";

export function InvitationAcceptance({ invitationId }: { invitationId: string }) {
  const router = useRouter();
  const [message, setMessage] = useState(invitationId ? "" : "This invitation link is missing its invitation ID.");
  const [pending, setPending] = useState(false);

  async function accept() {
    if (!invitationId) return;
    setPending(true);
    const result = await authClient.organization.acceptInvitation({ invitationId });
    setPending(false);
    if (result.error) setMessage(result.error.message ?? "This invitation could not be accepted.");
    else {
      setMessage("Invitation accepted. Welcome to the organisation.");
      router.refresh();
    }
  }

  return <main className="mx-auto flex min-h-screen max-w-xl items-center px-6"><section className="w-full rounded-lg border border-line bg-surface p-8"><p className="text-sm font-semibold uppercase tracking-[0.12em] text-brand-600">Entrust Africa</p><h1 className="mt-4 font-display text-3xl font-bold">Organisation invitation</h1><p className="mt-3 text-ink-2">Sign in with the invited email address, then accept this invitation to access the organisation in CLEAR.</p>{message && <p className="mt-6 rounded-md bg-brand-50 p-3 text-sm text-ink-2">{message}</p>}<Button className="mt-8" onClick={accept} loading={pending} disabled={!invitationId}>Accept invitation</Button></section></main>;
}
