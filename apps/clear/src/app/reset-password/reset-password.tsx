"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Field } from "@entrust/ui";
import { authClient } from "@/lib/auth-client";

export function ResetPassword({ token, error }: { token: string; error?: string }) {
  const router = useRouter();
  const [message, setMessage] = useState(error ? "This reset link is invalid or has expired." : "");
  const [pending, setPending] = useState(false);

  async function submit(form: FormData) {
    const password = String(form.get("password"));
    if (password !== String(form.get("confirmPassword"))) {
      setMessage("Passwords do not match.");
      return;
    }
    setPending(true);
    const result = await authClient.resetPassword({ newPassword: password, token });
    setPending(false);
    if (result.error) setMessage(result.error.message ?? "Could not reset your password.");
    else router.replace("/sign-in");
  }

  return <main className="mx-auto flex min-h-dvh max-w-xl items-center px-6"><section className="w-full rounded-lg border border-line bg-surface p-8"><p className="text-sm font-semibold uppercase tracking-[0.12em] text-brand-600">Entrust Africa</p><h1 className="mt-4 font-display text-3xl font-bold">Choose a new password</h1>{!token ? <p className="mt-3 text-danger">This reset link is missing its token.</p> : <form action={submit} className="mt-8 flex flex-col gap-5"><Field label="New password" name="password" type="password" autoComplete="new-password" minLength={8} required /><Field label="Confirm password" name="confirmPassword" type="password" autoComplete="new-password" minLength={8} required /><Button type="submit" loading={pending}>Update password</Button></form>}{message && <p className="mt-4 text-sm text-danger" role="alert">{message}</p>}</section></main>;
}
