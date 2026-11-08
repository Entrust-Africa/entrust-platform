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

  async function confirm() {
    setPending(true);
    const result = await tradeFetch<{ token?: string }>("POST", `/public/diagnostic/${encodeURIComponent(token)}/verify-email`, { proof });
    // A spent or wrong proof changes nothing: carry on with the draft as it is.
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
        <Button type="button" size="lg" loading={pending} onClick={() => void confirm()}>
          Confirm and continue
        </Button>
      </Card>
    </div>
  );
}
