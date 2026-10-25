"use client";

import { useState } from "react";
import { Button } from "@entrust/ui";
import { authClient } from "@/lib/auth-client";

export function CheckEmail({ email }: { email: string }) {
  const [message, setMessage] = useState("Check your inbox for a verification link.");
  const [pending, setPending] = useState(false);

  async function resend() {
    if (!email) return;
    setPending(true);
    const result = await authClient.sendVerificationEmail({ email, callbackURL: `${window.location.origin}/email-verified` });
    setPending(false);
    setMessage(result.error ? result.error.message ?? "Could not send the verification email." : "Verification email sent.");
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-xl items-center px-6">
      <section className="w-full rounded-lg border border-line bg-surface p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.12em] text-brand-600">Entrust Africa</p>
        <h1 className="mt-4 font-display text-3xl font-bold">Check your email</h1>
        <p className="mt-3 text-ink-2">We sent a verification link{email ? ` to ${email}` : ""}. Verify your address before signing in.</p>
        <Button className="mt-8" onClick={() => void resend()} loading={pending} disabled={!email}>
          Resend verification email
        </Button>
        <div className="mt-6 border-t border-line pt-4">
          <a href="/sign-in" className="text-sm font-semibold text-brand-600 underline-offset-4 hover:underline">
            Return to sign in
          </a>
        </div>
        <p className="mt-4 text-sm text-ink-2" role="status">
          {message}
        </p>
      </section>
    </main>
  );
}
