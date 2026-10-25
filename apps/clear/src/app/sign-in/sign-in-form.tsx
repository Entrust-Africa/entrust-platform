"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Button, Field } from "@entrust/ui";

type Mode = "sign-in" | "sign-up";

export function SignInForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("sign-in");
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function onSubmit(form: FormData) {
    setPending(true);
    setError(undefined);
    const email = String(form.get("email"));
    const password = String(form.get("password"));
    const result =
      mode === "sign-in"
        ? await authClient.signIn.email({ email, password })
        : await authClient.signUp.email({
            email,
            password,
            name: String(form.get("name")),
            callbackURL: `${window.location.origin}/email-verified`,
          });
    setPending(false);
    if (result.error) {
      if (
        mode === "sign-in" &&
        (result.error.status === 403 ||
          result.error.code === "EMAIL_NOT_VERIFIED" ||
          result.error.message?.toLowerCase().includes("not verified"))
      ) {
        setError("Please verify your email address before signing in. Check your inbox for the link.");
        return;
      }
      setError(
        mode === "sign-in"
          ? "That email and password don't match. Check them and try again."
          : (result.error.message ?? "We couldn't create the account. Try again."),
      );
      return;
    }
    router.replace(mode === "sign-up" ? `/check-email?email=${encodeURIComponent(email)}` : "/");
    router.refresh();
  }

  return (
    <div className="w-full max-w-sm">
      <h2 className="font-display text-2xl font-bold">
        {mode === "sign-in" ? "Sign in to CLEAR" : "Create your account"}
      </h2>
      <p className="mt-2 text-sm text-ink-2">
        {mode === "sign-in"
          ? "Use the email your Entrust facilitator registered."
          : "You'll use this account across Entrust platforms."}
      </p>
      <form action={onSubmit} className="mt-8 flex flex-col gap-5">
        {mode === "sign-up" && <Field label="Full name" name="name" autoComplete="name" required />}
        <Field label="Email" name="email" type="email" autoComplete="email" required />
        <Field
          label="Password"
          name="password"
          type="password"
          autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
          minLength={8}
          hint={mode === "sign-up" ? "At least 8 characters." : undefined}
          error={error}
          required
        />
        <Button type="submit" size="lg" loading={pending}>
          {mode === "sign-in" ? "Sign in" : "Create account"}
        </Button>
      </form>
      <p className="mt-6 text-sm text-ink-2">
        {mode === "sign-in" ? "New to CLEAR? " : "Already have an account? "}
        <button
          type="button"
          className="font-semibold text-brand-600 underline-offset-4 hover:underline"
          onClick={() => {
            setMode(mode === "sign-in" ? "sign-up" : "sign-in");
            setError(undefined);
          }}
        >
          {mode === "sign-in" ? "Create an account" : "Sign in"}
        </button>
      </p>
      {mode === "sign-in" && (
        <a className="mt-4 block text-sm font-semibold text-brand-600 underline-offset-4 hover:underline" href="/forgot-password">
          Forgot your password?
        </a>
      )}
    </div>
  );
}
