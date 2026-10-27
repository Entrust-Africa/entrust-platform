"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Field, Patchwork } from "@entrust/ui";
import { authClient } from "@/lib/auth-client";

export function ResetPassword({ token, error }: { token: string; error?: string }) {
  const router = useRouter();
  const [message, setMessage] = useState(error ? "This reset link is invalid or has expired." : "");
  const [pending, setPending] = useState(false);

  async function submit(form: FormData) {
    const password = String(form.get("password"));
    const confirmPassword = String(form.get("confirmPassword"));

    if (password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }

    setPending(true);
    setMessage("");
    const result = await authClient.resetPassword({ newPassword: password, token });
    setPending(false);

    if (result.error) {
      setMessage(result.error.message ?? "Could not reset your password.");
    } else {
      router.replace("/sign-in");
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-xl items-center px-4 py-8 sm:px-6">
      <section className="w-full overflow-hidden rounded-lg border border-line bg-surface shadow-xs">
        <Patchwork />
        <div className="p-6 sm:p-8">
          <p className="text-xs font-bold uppercase tracking-wider text-brand-600">Entrust Africa</p>
          <h1 className="mt-3 font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">
            Choose a new password
          </h1>
          <p className="mt-2 text-sm text-ink-2">Create a strong password with at least 8 characters.</p>

          {!token ? (
            <div className="mt-6 rounded-md bg-danger-50 p-4 text-sm text-danger" role="alert">
              <p className="font-semibold">This reset link is invalid or has expired</p>
              <p className="mt-1">Please request a new link to reset your account password.</p>
              <div className="mt-3">
                <Link
                  href="/forgot-password"
                  className="font-semibold text-danger underline underline-offset-4 hover:opacity-80"
                >
                  Request a new reset link →
                </Link>
              </div>
            </div>
          ) : (
            <form action={submit} className="mt-6 flex flex-col gap-5">
              <Field
                label="New password"
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                hint="At least 8 characters."
                required
              />
              <Field
                label="Confirm password"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
              />
              <Button type="submit" size="lg" loading={pending}>
                Update password
              </Button>
            </form>
          )}

          {token && message && (
            <p className="mt-4 text-sm font-medium text-danger" role="alert">
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
