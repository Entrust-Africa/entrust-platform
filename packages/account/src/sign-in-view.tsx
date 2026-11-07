"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Button, Field, Patchwork } from "@entrust/ui";
import { afriConnectErrorMessage, continueWithAfriConnect, type AfriConnectProduct } from "./africonnect";
import { authClient } from "./auth-client";
import type { UserProfile } from "./types";

export interface SignInViewProps {
  appName?: string;
  tagline?: string;
  description?: string;
  logoSrc?: string;
  logoAlt?: string;
  homePath?: string;
  currentUser?: UserProfile | null;
  invitationId?: string;
  brandFooter?: ReactNode;
  /**
   * Sign in with an AfriConnect account: only the email is asked here, and AfriConnect's page (in this platform's
   * colours) takes the password or a code. Without it, the Entrust email-and-password form shows.
   */
  afriConnect?: { product: AfriConnectProduct } | null;
  /** The `?error=` code a failed AfriConnect sign-in comes back with. */
  errorCode?: string | null;
}

type Mode = "sign-in" | "sign-up";

export function SignInView({
  appName = "CLEAR",
  tagline = "Your export cases, step by step.",
  description = "CLEAR Export tracks every permit, document and deadline from first order to the final foreign exchange settlement.",
  logoSrc = "/logo.jpg",
  logoAlt = `${appName} logo`,
  homePath = "/",
  currentUser,
  invitationId,
  brandFooter,
  afriConnect,
  errorCode,
}: SignInViewProps) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("sign-in");
  const [error, setError] = useState<string | undefined>(() => (afriConnect ? afriConnectErrorMessage(errorCode) : undefined));
  const [pending, setPending] = useState(false);

  // If already signed in, redirect
  if (currentUser) {
    router.replace(invitationId ? `/accept-invitation?id=${encodeURIComponent(invitationId)}` : homePath);
  }

  const destination = invitationId ? `/accept-invitation?id=${encodeURIComponent(invitationId)}` : homePath;

  async function onContinue(form: FormData) {
    if (!afriConnect) return;
    setPending(true);
    setError(undefined);
    const failed = await continueWithAfriConnect({
      email: String(form.get("email") ?? ""),
      product: afriConnect.product,
      callbackPath: destination,
      // A failed sign-in comes back here, still holding the invitation.
      errorPath: invitationId ? `/sign-in?invitationId=${encodeURIComponent(invitationId)}` : "/sign-in",
    });
    if (failed) {
      setError(failed.error);
      setPending(false);
    }
  }

  async function onSubmit(form: FormData) {
    setPending(true);
    setError(undefined);
    const email = String(form.get("email"));
    const password = String(form.get("password"));
    const callbackTarget = invitationId
      ? `${window.location.origin}/email-verified?invitationId=${encodeURIComponent(invitationId)}`
      : `${window.location.origin}/email-verified`;

    const result =
      mode === "sign-in"
        ? await authClient.signIn.email({ email, password })
        : await authClient.signUp.email({
            email,
            password,
            name: String(form.get("name")),
            callbackURL: callbackTarget,
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
    router.replace(
      mode === "sign-up"
        ? `/check-email?email=${encodeURIComponent(email)}${invitationId ? `&invitationId=${encodeURIComponent(invitationId)}` : ""}`
        : destination,
    );
    router.refresh();
  }

  return (
    <main className="grid min-h-dvh lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
      <section className="relative flex flex-col justify-between gap-12 bg-night px-6 py-10 text-on-night sm:px-12 lg:py-14">
        <div className="flex items-center gap-3">
          {logoSrc ? (
            <Image
              src={logoSrc}
              alt={logoAlt}
              width={36}
              height={36}
              className="size-9 rounded-lg bg-white p-0.5 object-contain shadow-xs"
            />
          ) : (
            <div className="flex size-9 items-center justify-center rounded-lg bg-brand-600 font-display font-bold text-white shadow-xs">
              {appName.slice(0, 2).toUpperCase()}
            </div>
          )}
          <p className="font-display text-sm font-bold tracking-[0.18em] text-on-night-muted uppercase">
            Entrust Africa
          </p>
        </div>
        <div className="max-w-xl">
          <h1 className="font-display text-4xl font-extrabold leading-tight sm:text-display">
            {tagline}
          </h1>
          <p className="mt-5 max-w-md text-base leading-relaxed text-on-night-muted">
            {description}
          </p>
        </div>
        {brandFooter ?? <Patchwork className="max-w-xs" />}
      </section>
      <section className="flex items-center justify-center px-6 py-12 sm:px-12">
        <div className="w-full max-w-sm">
          {afriConnect ? (
            <>
              <h2 className="font-display text-2xl font-bold">Sign in to {appName}</h2>
              <p className="mt-2 text-sm text-ink-2">
                Enter your email to continue. New to {appName}? Enter it all the same, and you'll create your account on
                the next page.
              </p>
              <form action={onContinue} className="mt-8 flex flex-col gap-5">
                <Field label="Email" name="email" type="email" autoComplete="email" required error={error} />
                <Button type="submit" size="lg" loading={pending}>
                  Continue
                </Button>
              </form>
              <p className="mt-6 text-xs leading-relaxed text-ink-3">
                Your Entrust Africa account is run with AfriConnect: you use the same email and password on both.
              </p>
            </>
          ) : (
            <>
              <h2 className="font-display text-2xl font-bold">
                {mode === "sign-in" ? `Sign in to ${appName}` : "Create your account"}
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
                {mode === "sign-in" ? `New to ${appName}? ` : "Already have an account? "}
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
                <Link
                  className="mt-4 block text-sm font-semibold text-brand-600 underline-offset-4 hover:underline"
                  href="/forgot-password"
                >
                  Forgot your password?
                </Link>
              )}
            </>
          )}
        </div>
      </section>
    </main>
  );
}
