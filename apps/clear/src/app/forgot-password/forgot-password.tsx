"use client";

import { useState } from "react";
import { Button, Field } from "@entrust/ui";
import { authClient } from "@/lib/auth-client";

export function ForgotPassword() {
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(form: FormData) {
    setPending(true);
    const result = await authClient.requestPasswordReset({ email: String(form.get("email")), redirectTo: `${window.location.origin}/reset-password` });
    setPending(false);
    setMessage(result.error ? result.error.message ?? "Could not request a password reset." : "If that account exists, a reset link is on its way.");
  }

  return <main className="mx-auto flex min-h-dvh max-w-xl items-center px-6"><section className="w-full rounded-lg border border-line bg-surface p-8"><p className="text-sm font-semibold uppercase tracking-[0.12em] text-brand-600">Entrust Africa</p><h1 className="mt-4 font-display text-3xl font-bold">Reset your password</h1><p className="mt-3 text-ink-2">Enter your account email and we will send a reset link.</p><form action={submit} className="mt-8 flex flex-col gap-5"><Field label="Email" name="email" type="email" autoComplete="email" required /><Button type="submit" loading={pending}>Send reset link</Button></form>{message && <p className="mt-4 text-sm text-ink-2" role="status">{message}</p>}</section></main>;
}
