"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Patchwork } from "@entrust/ui";

const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

async function call<T>(method: "POST", path: string, body?: unknown): Promise<{ ok: boolean; data: (T & { error?: string }) | null }> {
  try {
    const res = await fetch(`${api}/v1/mfa${path}`, { method, credentials: "include", headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { ok: res.ok, data: (await res.json().catch(() => null)) as never };
  } catch {
    return { ok: false, data: { error: "Couldn't reach the server. Check your connection and try again." } as never };
  }
}

/** Staff sign-in's second step: enter a code, or set up the authenticator app first. */
export function MfaView({ email, enrolled }: { email: string; enrolled: boolean }) {
  const router = useRouter();
  const [setup, setSetup] = useState<{ secret: string; otpauthUrl: string } | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [useRecovery, setUseRecovery] = useState(false);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function start() {
    setPending(true);
    setMessage("");
    const res = await call<{ secret: string; otpauthUrl: string }>("POST", "/enrol");
    setPending(false);
    if (res.ok && res.data) setSetup(res.data);
    else setMessage(res.data?.error ?? "Couldn't start setup.");
  }

  async function confirm(form: FormData) {
    setPending(true);
    setMessage("");
    const res = await call<{ recoveryCodes: string[] }>("POST", "/confirm", { code: String(form.get("code")).trim() });
    setPending(false);
    if (res.ok && res.data) setRecoveryCodes(res.data.recoveryCodes);
    else setMessage(res.data?.error ?? "That code isn't right.");
  }

  async function verify(form: FormData) {
    setPending(true);
    setMessage("");
    const value = String(form.get("code")).trim();
    const res = await call<unknown>("POST", "/verify", useRecovery ? { recoveryCode: value } : { code: value });
    setPending(false);
    if (res.ok) {
      router.replace("/");
      router.refresh();
    } else setMessage(res.data?.error ?? "That code isn't right.");
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-xl items-center px-4 py-8 sm:px-6">
      <section className="w-full overflow-hidden rounded-lg border border-line bg-surface shadow-xs">
        <Patchwork />
        <div className="p-6 sm:p-8">
          <p className="text-xs font-bold tracking-wider text-brand-600 uppercase">Entrust Africa</p>
          <h1 className="mt-3 font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">Two-step sign-in</h1>

          {recoveryCodes ? (
            <div className="mt-4 space-y-4">
              <p className="text-sm text-ink-2">You're set up. Save these recovery codes somewhere safe, such as a password manager. Each works once if you lose your phone, and they won't be shown again.</p>
              <ul className="grid grid-cols-2 gap-2 rounded-md border border-line bg-surface-2 p-4 font-mono text-sm text-ink" aria-label="Recovery codes">
                {recoveryCodes.map((code) => (
                  <li key={code}>{code}</li>
                ))}
              </ul>
              <Button size="lg" onClick={() => { router.replace("/"); router.refresh(); }}>
                I've saved them, continue
              </Button>
            </div>
          ) : enrolled ? (
            <>
              <p className="mt-2 text-sm text-ink-2">
                {useRecovery ? "Enter one of your recovery codes." : `Enter the 6-digit code from your authenticator app for ${email}.`}
              </p>
              <form action={verify} className="mt-6 flex flex-col gap-5">
                <Field label={useRecovery ? "Recovery code" : "Code"} name="code" autoComplete="one-time-code" inputMode={useRecovery ? "text" : "numeric"} required />
                <Button type="submit" size="lg" loading={pending}>
                  Continue
                </Button>
              </form>
              <button type="button" className="mt-4 text-xs font-semibold text-brand-600 underline-offset-4 hover:underline" onClick={() => { setUseRecovery(!useRecovery); setMessage(""); }}>
                {useRecovery ? "Use my authenticator app instead" : "I can't use my authenticator app"}
              </button>
            </>
          ) : setup ? (
            <>
              <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-ink-2">
                <li>Open an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password or similar).</li>
                <li>
                  Add an account with this key, set to time-based: <span className="break-all font-mono font-semibold text-ink">{setup.secret}</span>
                </li>
                <li>
                  On a phone you can also <a className="font-semibold text-brand-600 underline" href={setup.otpauthUrl}>open the setup link</a>.
                </li>
                <li>Enter the 6-digit code the app shows.</li>
              </ol>
              <form action={confirm} className="mt-6 flex flex-col gap-5">
                <Field label="Code" name="code" autoComplete="one-time-code" inputMode="numeric" required />
                <Button type="submit" size="lg" loading={pending}>
                  Confirm and continue
                </Button>
              </form>
            </>
          ) : (
            <>
              <p className="mt-2 text-sm text-ink-2">Entrust asks staff for a second step when they sign in. Set up an authenticator app on your phone; it takes about two minutes.</p>
              <Button className="mt-6" size="lg" onClick={() => void start()} loading={pending}>
                Set up two-step sign-in
              </Button>
            </>
          )}

          {message && (
            <p className="mt-4 text-sm font-medium text-danger" role="alert">
              {message}
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
