"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useId, useRef, useState, type FormEvent } from "react";
import { CONTACT } from "../../lib/site";
import { ErrorBanner, Field, SubmitButton, SuccessCheck, inputClasses, postJson, type FormStatus } from "../../components/ui/FormKit";

const EASE = [0.16, 1, 0.3, 1] as const;

const FIELDS = ["name", "email", "phone", "subject", "message"] as const;
type FieldName = (typeof FIELDS)[number];
type Errors = Partial<Record<FieldName, string>>;

/** Inline messages for each field, keyed by the browser's ValidityState. */
function messageFor(name: FieldName, v: Pick<ValidityState, "valid" | "valueMissing">): string | undefined {
  if (v.valid) return undefined;
  switch (name) {
    case "name":
      return "Please enter your name.";
    case "email":
      return v.valueMissing ? "Please enter your email address." : "Please enter a valid email, like you@company.com.";
    case "phone":
      return v.valueMissing ? "Please enter a phone number." : "Please enter a valid phone number, like +251 900 000 000.";
    case "subject":
      return "Please tell us what this is about.";
    case "message":
      return "Please write a short message.";
  }
}

type Control = HTMLInputElement | HTMLTextAreaElement;

/**
 * "Send us a message": posts { name, email, phone, subject, message } to /api/contact.
 * Fields use native constraints (required, type="email", pattern) and show inline
 * errors on blur and on submit; the card swaps to an animated confirmation on success.
 */
export function ContactForm() {
  const uid = useId();
  const id = (f: FieldName) => `${uid}-${f}`;
  const formRef = useRef<HTMLFormElement>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<FormStatus>("idle");
  const [serverError, setServerError] = useState<string>();
  const [sent, setSent] = useState<{ message?: string; email: string }>();

  function check(el: Control) {
    const name = el.name as FieldName;
    // Whitespace-only values pass `required`; treat them as empty, like the API does.
    const msg = el.value.trim() === "" ? messageFor(name, { valid: false, valueMissing: true }) : messageFor(name, el.validity);
    setErrors((e) => (e[name] === msg ? e : { ...e, [name]: msg }));
    return msg;
  }

  const controlProps = (name: FieldName) => ({
    id: id(name),
    name,
    required: true,
    "aria-invalid": errors[name] ? true : undefined,
    "aria-describedby": errors[name] ? `${id(name)}-error` : undefined,
    onBlur: (e: { currentTarget: Control }) => {
      if (e.currentTarget.value !== "" || errors[name]) check(e.currentTarget);
    },
    onInput: (e: { currentTarget: Control }) => {
      if (errors[name]) check(e.currentTarget);
    },
  });

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status === "submitting") return;
    const form = e.currentTarget;
    let firstInvalid: Control | undefined;
    for (const f of FIELDS) {
      const el = form.elements.namedItem(f) as Control;
      if (check(el) && !firstInvalid) firstInvalid = el;
    }
    if (firstInvalid) {
      firstInvalid.focus();
      return;
    }

    const data = Object.fromEntries(FIELDS.map((f) => [f, (form.elements.namedItem(f) as Control).value.trim()]));
    setServerError(undefined);
    setStatus("submitting");
    const res = await postJson("/api/contact", data);
    if (res.ok) {
      setSent({ message: res.message, email: data.email });
      setStatus("success");
      form.reset();
    } else {
      setServerError(res.error);
      setStatus("error");
    }
  }

  function startOver() {
    setSent(undefined);
    setStatus("idle");
    setErrors({});
    // Wait for the form to mount again, then put the cursor in the first field.
    requestAnimationFrame(() => (formRef.current?.elements.namedItem("name") as HTMLInputElement | null)?.focus());
  }

  return (
    <motion.div layout transition={{ layout: { duration: 0.5, ease: EASE } }} className="overflow-hidden rounded-lg bg-surface px-4 py-5 shadow-[0_24px_48px_-24px_rgb(0_0_0/0.5)] lg:p-6">
      <AnimatePresence mode="wait" initial={false}>
        {status === "success" && sent ? (
          <motion.div
            key="sent"
            role="status"
            className="flex flex-col items-start gap-4 py-6"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.5, ease: EASE }}
          >
            <SuccessCheck />
            <h2 className="text-xl font-semibold leading-7 text-ink">Message sent</h2>
            <p className="text-base leading-6 text-muted">
              {sent.message ?? "Your message has been sent successfully."} We’ll reply to{" "}
              <span className="font-medium text-ink">{sent.email}</span>.
            </p>
            <button
              type="button"
              onClick={startOver}
              className="group/again inline-flex h-11 items-center gap-1.5 font-semibold text-brand"
            >
              <span className="link-grow">Send another message</span>
            </button>
          </motion.div>
        ) : (
          <motion.form
            key="form"
            ref={formRef}
            noValidate
            onSubmit={onSubmit}
            aria-labelledby={`${uid}-title`}
            className="flex flex-col gap-3.5"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.4, ease: EASE }}
          >
            <h2 id={`${uid}-title`} className="text-xl font-semibold leading-7 text-ink">
              Send us a message
            </h2>
            <Field id={id("name")} label="Full name" error={errors.name}>
              <input {...controlProps("name")} type="text" autoComplete="name" maxLength={120} placeholder="Your name" className={inputClasses(!!errors.name, "h-11")} />
            </Field>
            <Field id={id("email")} label="Email" error={errors.email}>
              <input
                {...controlProps("email")}
                type="email"
                autoComplete="email"
                inputMode="email"
                maxLength={180}
                placeholder="you@company.com"
                className={inputClasses(!!errors.email, "h-11")}
              />
            </Field>
            <Field id={id("phone")} label="Phone number" error={errors.phone}>
              <input
                {...controlProps("phone")}
                type="tel"
                autoComplete="tel"
                inputMode="tel"
                maxLength={40}
                pattern="[\+0-9\s\(\)\-\.]{7,40}"
                placeholder="+251"
                className={inputClasses(!!errors.phone, "h-11")}
              />
            </Field>
            <Field id={id("subject")} label="Subject" error={errors.subject}>
              <input {...controlProps("subject")} type="text" maxLength={180} placeholder="What is this about?" className={inputClasses(!!errors.subject, "h-11")} />
            </Field>
            <Field id={id("message")} label="Message" error={errors.message}>
              <textarea
                {...controlProps("message")}
                rows={4}
                maxLength={4000}
                placeholder="How can we help?"
                className={inputClasses(!!errors.message, "h-28 min-h-28 resize-y py-2.5 leading-6")}
              />
            </Field>
            <ErrorBanner message={status === "error" ? serverError : undefined} />
            <SubmitButton submitting={status === "submitting"} label="Send message" busyLabel="Sending…" />
            {status === "error" ? (
              <p className="text-sm leading-5 text-muted">
                You can also email us at{" "}
                <a href={`mailto:${CONTACT.email}`} className="link-grow font-medium text-brand">
                  {CONTACT.email}
                </a>
                .
              </p>
            ) : null}
          </motion.form>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
