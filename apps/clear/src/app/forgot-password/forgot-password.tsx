"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Field, Patchwork } from "@entrust/ui";
import { authClient } from "@/lib/auth-client";

export function ForgotPassword() {
  const [message, setMessage] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const [pending, setPending] = useState(false);

  async function submit(form: FormData) {
    setPending(true);
    setMessage("");
    const email = String(form.get("email"));
    const result = await authClient.requestPasswordReset({
      email,
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setPending(false);
    if (result.error) {
      setMessage(result.error.message ?? "Could not request a password reset.");
      setIsSuccess(false);
    } else {
      setMessage("If that account exists, a reset link has been sent to your email.");
      setIsSuccess(true);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-xl items-center px-4 py-8 sm:px-6">
      <section className="w-full overflow-hidden rounded-lg border border-line bg-surface shadow-xs">
        <Patchwork />
        <div className="p-6 sm:p-8">
          <p className="text-xs font-bold uppercase tracking-wider text-brand-600">Entrust Africa</p>
          <h1 className="mt-3 font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">
            Reset your password
          </h1>
          <p className="mt-2 text-sm text-ink-2">
            Enter your account email and we will send a link to reset your password.
          </p>

          <form action={submit} className="mt-6 flex flex-col gap-5">
            <Field label="Email" name="email" type="email" autoComplete="email" required />
            <Button type="submit" size="lg" loading={pending}>
              Send reset link
            </Button>
          </form>

          {message && (
            <p
              className={`mt-4 text-sm font-medium ${isSuccess ? "text-brand-600" : "text-danger"}`}
              role={isSuccess ? "status" : "alert"}
            >
              {message}
            </p>
          )}

          <div className="mt-6 border-t border-line pt-4">
            <Link
              href="/sign-in"
              className="text-xs font-semibold text-brand-600 underline-offset-4 hover:underline"
            >
              ← Return to sign in
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
