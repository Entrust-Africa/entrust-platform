"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card } from "@entrust/ui";
import { tradeFetch } from "@/lib/trade-client";

/**
 * The emailed link carries a proof that the visitor reads that address's mail. It is spent by this button, not by
 * opening the page, so a mail scanner that follows links proves nothing. Confirming gives the draft a new private
 * link (the page moves to it) and, where AfriConnect sign-in is on, makes the visitor's account.
 */
export function ConfirmEmail({ token, proof, email, afriConnect }: { token: string; proof: string; email: string; afriConnect: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  async function confirm() {
    setPending(true);
    setError(undefined);
    const result = await tradeFetch<{ token?: string }>("POST", `/public/diagnostic/${encodeURIComponent(token)}/verify-email`, { proof });
    // The request failed, so nothing is confirmed: stay here, with the proof still in the address, to try again.
    if (!result.ok) {
      setError(result.error ?? "Something went wrong. Try again.");
      setPending(false);
      return;
    }
    // A spent or wrong proof changes nothing (it answers 200 with no token): carry on with the draft as it is.
    router.replace(`/onboarding/${encodeURIComponent(result.data?.token ?? token)}`);
  }

  return (
    <div className="mx-auto max-w-xl py-8">
      <Card className="space-y-4 p-6">
        <h1 className="font-display text-xl font-bold text-ink">Confirm your email</h1>
        <p className="text-sm leading-relaxed text-ink-2">
          Confirm that <span className="font-semibold text-ink">{email}</span> is your email address. Your diagnostic then gets a new private link, which we email
          to you, so only you can open it.
          {afriConnect ? " It also creates your Entrust Africa account with this email, so you can sign in later." : ""}
        </p>
        {error && (
          <p className="rounded-md bg-danger-50 px-3 py-2 text-sm font-medium text-danger" role="alert">
            {error}
          </p>
        )}
        <Button type="button" size="lg" loading={pending} onClick={() => void confirm()}>
          Confirm and continue
        </Button>
      </Card>
    </div>
  );
}
