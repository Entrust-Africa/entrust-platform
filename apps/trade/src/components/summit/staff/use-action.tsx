"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { errorText } from "@/lib/summit-api";

/**
 * Runs one thing a person asked for (a save, a decision), shows the sentence the API gave if it refuses, and reloads the page's
 * data when it works. `run` resolves true when it worked, so a form can clear itself.
 */
export function useAction() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [done, setDone] = useState<string>();

  async function run(work: () => Promise<unknown>, message?: string): Promise<boolean> {
    setBusy(true);
    setError(undefined);
    setDone(undefined);
    try {
      await work();
      setDone(message);
      router.refresh();
      return true;
    } catch (e) {
      setError(errorText(e));
      return false;
    } finally {
      setBusy(false);
    }
  }
  return { busy, error, done, run };
}

/** The refusal or confirmation of an action, where a screen reader will say it. */
export function Outcome({ error, done }: { error?: string | undefined; done?: string | undefined }) {
  if (error) {
    return (
      <p role="alert" className="rounded-md bg-danger-50 px-3 py-2 text-sm font-medium text-danger">
        {error}
      </p>
    );
  }
  if (done) {
    return (
      <p role="status" className="rounded-md bg-ok-50 px-3 py-2 text-sm font-medium text-ok">
        {done}
      </p>
    );
  }
  return null;
}

const base = "w-full rounded-md border border-line-strong bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-3 focus-visible:border-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/25";

/** A labelled text area. */
export function TextArea({ label, hint, ...props }: { label: string; hint?: string } & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-semibold text-ink">{label}</span>
      <textarea rows={3} className={base} {...props} />
      {hint && <span className="text-xs text-ink-3">{hint}</span>}
    </label>
  );
}

/** A labelled drop-down. */
export function Select({ label, options, ...props }: { label: string; options: readonly { id: string; label: string }[] } & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-semibold text-ink">{label}</span>
      <select className={`${base} h-10`} {...props}>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
