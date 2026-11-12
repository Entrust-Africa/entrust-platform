"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useId, useState, type FormEvent } from "react";
import { Field, SubmitButton, SuccessCheck, inputClasses, postJson, type FormStatus } from "../../components/ui/FormKit";

const EASE = [0.16, 1, 0.3, 1] as const;

/** "Get the newsletter": posts { email, source: "community" } to /api/newsletter. */
export function NewsletterPanel() {
  const uid = useId();
  const inputId = `${uid}-email`;
  const [status, setStatus] = useState<FormStatus>("idle");
  const [error, setError] = useState<string>();
  const [done, setDone] = useState<string>();

  function validate(el: HTMLInputElement) {
    if (el.value.trim() === "") return "Please enter your email address.";
    if (!el.validity.valid) return "Please enter a valid email, like you@company.com.";
    return undefined;
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status === "submitting") return;
    const el = e.currentTarget.elements.namedItem("email") as HTMLInputElement;
    const msg = validate(el);
    setError(msg);
    if (msg) {
      el.focus();
      return;
    }
    setStatus("submitting");
    const res = await postJson("/api/newsletter", { email: el.value.trim(), source: "community" });
    if (res.ok) {
      setDone(res.message ?? "Thanks, you are on the list.");
      setStatus("success");
    } else {
      setError(res.error);
      setStatus("error");
    }
  }

  return (
    <motion.div
      layout
      transition={{ layout: { duration: 0.5, ease: EASE } }}
      className="overflow-hidden rounded-lg bg-surface px-4 py-5 shadow-[0_24px_48px_-24px_rgb(0_0_0/0.5)] lg:p-6"
    >
      <AnimatePresence mode="wait" initial={false}>
        {status === "success" ? (
          <motion.div
            key="done"
            role="status"
            className="flex flex-col items-start gap-4 py-4"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: EASE }}
          >
            <SuccessCheck size={48} />
            <h2 className="text-xl font-semibold leading-7 text-ink">You’re subscribed</h2>
            <p className="text-base leading-6 text-muted">{done}</p>
          </motion.div>
        ) : (
          <motion.form
            key="form"
            noValidate
            onSubmit={onSubmit}
            aria-labelledby={`${uid}-title`}
            className="flex flex-col gap-4"
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.4, ease: EASE }}
          >
            <h2 id={`${uid}-title`} className="text-xl font-semibold leading-7 text-ink">
              Get the newsletter
            </h2>
            <p className="text-base leading-6 text-muted">Updates on events, programs and community highlights.</p>
            <Field id={inputId} label="Email" error={error}>
              <input
                id={inputId}
                name="email"
                type="email"
                required
                autoComplete="email"
                inputMode="email"
                maxLength={180}
                placeholder="you@company.com"
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? `${inputId}-error` : undefined}
                onInput={(e) => {
                  if (error) setError(validate(e.currentTarget));
                }}
                className={inputClasses(!!error, "h-11")}
              />
            </Field>
            <SubmitButton submitting={status === "submitting"} label="Subscribe" busyLabel="Subscribing…" />
            <p className="sr-only" aria-live="polite">
              {status === "error" ? error : ""}
            </p>
            <p className="text-sm leading-5 text-muted">We never spam. Unsubscribe anytime.</p>
          </motion.form>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
