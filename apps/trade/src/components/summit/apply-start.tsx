"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@entrust/account";
import { Button } from "@entrust/ui";
import { countryName } from "@/lib/summit";
import { rememberBusiness } from "@/lib/summit-business";
import { signInHref } from "@/lib/next-path";
import { textInput } from "@/components/form-runner/styles";

const label = "block text-base font-semibold text-ink";

/**
 * The first step of the application, for a visitor with no account: the business and the person applying for it. It
 * creates the account (a link to confirm the email address follows) and keeps the business for when they come back.
 */
export function ApplyStart({ countries }: { countries: readonly string[] }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<{ message: string; haveAccount?: boolean }>();

  async function start(form: FormData) {
    const business = { name: String(form.get("business") ?? "").trim(), country: String(form.get("country") ?? "") };
    const email = String(form.get("email") ?? "").trim();
    setPending(true);
    setError(undefined);
    rememberBusiness(business);
    // The link in the email brings them back to the application, signed in.
    const result = await authClient.signUp.email({
      name: String(form.get("name") ?? "").trim(),
      email,
      password: String(form.get("password") ?? ""),
      callbackURL: `${window.location.origin}/summit/apply`,
    });
    if (result.error) {
      const message = result.error.message ?? "";
      const exists = result.error.code?.includes("ALREADY_EXISTS") || /already exists/i.test(message);
      setError(
        exists
          ? { message: "There is already an account with this email address.", haveAccount: true }
          : { message: message || "We couldn't create your account. Please try again." },
      );
      setPending(false);
      return;
    }
    router.replace(`/check-email?email=${encodeURIComponent(email)}`);
  }

  return (
    <form action={start} className="space-y-5">
      <div className="space-y-1.5">
        <label htmlFor="apply-business" className={label}>
          Business name
        </label>
        <input id="apply-business" name="business" required maxLength={160} autoComplete="organization" className={textInput(false)} />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="apply-country" className={label}>
          Country
        </label>
        <select id="apply-country" name="country" required defaultValue="" className={`${textInput(false)} appearance-auto`}>
          <option value="" disabled>
            Choose your country
          </option>
          {countries.map((code) => (
            <option key={code} value={code}>
              {countryName(code)}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-5 border-t border-line pt-5">
        <p className="text-sm text-ink-2">Now your details. You will use them to sign in and follow your application.</p>
        <div className="space-y-1.5">
          <label htmlFor="apply-name" className={label}>
            Your full name
          </label>
          <input id="apply-name" name="name" required maxLength={120} autoComplete="name" className={textInput(false)} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="apply-email" className={label}>
            Email
          </label>
          <input id="apply-email" name="email" type="email" required autoComplete="email" className={textInput(false)} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="apply-password" className={label}>
            Password
          </label>
          <input
            id="apply-password"
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            aria-describedby="apply-password-hint"
            className={textInput(false)}
          />
          <p id="apply-password-hint" className="text-sm text-ink-3">
            At least 8 characters.
          </p>
        </div>
      </div>

      {error && (
        <p className="rounded-md bg-danger-50 px-3 py-2 text-sm font-medium text-danger" role="alert">
          {error.message}
          {error.haveAccount && (
            <>
              {" "}
              <Link href={signInHref("/summit/apply")} className="underline underline-offset-2">
                Sign in to continue your application.
              </Link>
            </>
          )}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <Button type="submit" size="lg" className="w-full sm:w-auto" loading={pending}>
          Start my application
        </Button>
        <p className="text-sm text-ink-2">
          Already have an account?{" "}
          <Link href={signInHref("/summit/apply")} className="font-semibold text-brand-700 underline underline-offset-4">
            Sign in
          </Link>
        </p>
      </div>
      <p className="text-sm text-ink-3">We will email you a link to confirm your address, then you carry on with the application.</p>
    </form>
  );
}
