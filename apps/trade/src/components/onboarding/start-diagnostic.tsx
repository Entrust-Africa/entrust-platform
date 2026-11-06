"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@entrust/ui";
import { tradeFetch } from "@/lib/trade-client";
import { textInput } from "@/components/form-runner/styles";

const REMEMBERED = "entrust-onboarding-token";

/**
 * The first step of the public diagnostic: the business's name, an email address (so the private link can be sent and
 * Entrust can match the answers to the business later) and a phone number. All three are needed. No password and no
 * account. The browser remembers the draft, so coming back to this page offers to carry on.
 */
export function StartDiagnostic() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [remembered, setRemembered] = useState<string | null>(null);

  useEffect(() => {
    setRemembered(localStorage.getItem(REMEMBERED));
  }, []);

  async function start(form: FormData) {
    setPending(true);
    setError(undefined);
    const result = await tradeFetch<{ token: string }>("POST", "/public/diagnostic", {
      businessName: String(form.get("businessName") ?? ""),
      email: String(form.get("email") ?? ""),
      phone: String(form.get("phone") ?? ""),
      website: String(form.get("website") ?? "") || undefined,
    });
    if (!result.data) {
      // The API words a refusal as "phone: Enter a phone number…": show the sentence without the field name.
      setError(result.status === 400 ? (result.error ?? "Check your details and try again.").replace(/^[a-zA-Z]+: /, "") : (result.error ?? "Something went wrong. Try again."));
      setPending(false);
      return;
    }
    localStorage.setItem(REMEMBERED, result.data.token);
    router.push(`/onboarding/${result.data.token}`);
  }

  return (
    <div className="space-y-6">
      {remembered && (
        <div className="rounded-lg border border-brand-100 bg-brand-50 p-4 text-sm text-ink">
          <p className="font-semibold">You already started this form on this device.</p>
          <Link href={`/onboarding/${remembered}`} className="mt-1 inline-block font-semibold text-brand-700 underline underline-offset-4">
            Carry on where you left off →
          </Link>
        </div>
      )}
      <form action={start} className="space-y-5">
        <div className="space-y-1.5">
          <label htmlFor="start-business" className="block text-base font-semibold text-ink">
            Business name
          </label>
          <input id="start-business" name="businessName" required maxLength={200} autoComplete="organization" className={textInput(false)} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="start-email" className="block text-base font-semibold text-ink">
            Your email address
          </label>
          <input id="start-email" name="email" type="email" required maxLength={200} autoComplete="email" inputMode="email" aria-describedby="start-email-hint" className={textInput(false)} />
          <p id="start-email-hint" className="text-sm text-ink-3">
            We send you a private link to your form, so you can stop and carry on later.
          </p>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="start-phone" className="block text-base font-semibold text-ink">
            Phone number
          </label>
          <input
            id="start-phone"
            name="phone"
            type="tel"
            required
            minLength={7}
            maxLength={30}
            autoComplete="tel"
            inputMode="tel"
            placeholder="+251 91 123 4567"
            aria-describedby="start-phone-hint"
            className={textInput(false)}
          />
          <p id="start-phone-hint" className="text-sm text-ink-3">
            So Entrust can reach you about the training. Include the country code if you can.
          </p>
        </div>
        {/* A trap for bots: people never see or fill this in. */}
        <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
          <label htmlFor="start-website">Website</label>
          <input id="start-website" name="website" tabIndex={-1} autoComplete="off" />
        </div>
        {error && (
          <p className="rounded-md bg-danger-50 px-3 py-2 text-sm font-medium text-danger" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" className="w-full sm:w-auto" loading={pending}>
          Start the diagnostic
        </Button>
      </form>
    </div>
  );
}
