"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { ReactNode } from "react";
import { buttonClasses } from "./Button";

/*
 * Small form toolkit shared by the Contact form and the Community newsletter panel:
 * labelled fields with an animated focus ring, inline errors that slide open,
 * a submit button with a sending state, and an animated success / failure message.
 */

const EASE = [0.16, 1, 0.3, 1] as const;

export type FormStatus = "idle" | "submitting" | "success" | "error";

/** Input / textarea classes. The ring grows from 0 to 4px on focus; invalid fields turn terracotta. */
export function inputClasses(invalid: boolean, extra = "") {
  return (
    "w-full rounded-md border bg-surface px-3 text-base text-ink placeholder:text-subtle " +
    "transition-[border-color,box-shadow] duration-300 ease-(--ease-out-quart) focus:outline-none focus-visible:outline-none " +
    (invalid
      ? "border-terracotta shadow-[0_0_0_0_rgb(200_85_61/0)] focus:shadow-[0_0_0_4px_rgb(200_85_61/0.16)] "
      : "border-line-strong shadow-[0_0_0_0_rgb(25_149_79/0)] hover:border-subtle focus:border-brand focus:shadow-[0_0_0_4px_rgb(25_149_79/0.16)] ") +
    extra
  );
}

/** Label + control + inline error. The label turns green while the field has focus. */
export function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="group/field flex flex-col gap-1.5">
      <label
        htmlFor={id}
        className="text-sm font-medium leading-5 text-ink transition-colors duration-300 group-focus-within/field:text-brand-deep"
      >
        {label}
      </label>
      {children}
      <AnimatePresence initial={false}>
        {error ? (
          <motion.p
            key="err"
            id={`${id}-error`}
            className="overflow-hidden text-sm leading-5 text-[#a63f2a]"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease: EASE }}
          >
            {error}
          </motion.p>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function Spinner() {
  return (
    <svg className="size-[18px] animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.3" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/** Full-width primary submit button. While sending it shows a spinner and the busy label. */
export function SubmitButton({
  submitting,
  label,
  busyLabel,
}: {
  submitting: boolean;
  label: string;
  busyLabel: string;
}) {
  return (
    <button
      type="submit"
      disabled={submitting}
      aria-disabled={submitting}
      className={buttonClasses("primary", "lg", "w-full disabled:cursor-wait disabled:before:scale-x-100")}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={submitting ? "busy" : "idle"}
          className="inline-flex items-center gap-2"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25, ease: EASE }}
        >
          {submitting ? <Spinner /> : null}
          {submitting ? busyLabel : label}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}

/** Banner for a failed submission (slides open, announced to screen readers). */
export function ErrorBanner({ message }: { message?: string }) {
  return (
    <AnimatePresence initial={false}>
      {message ? (
        <motion.div
          key={message}
          role="alert"
          className="overflow-hidden"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.4, ease: EASE }}
        >
          <div className="flex items-start gap-2.5 rounded-md border border-terracotta/35 bg-terracotta/8 px-3 py-2.5 text-sm leading-5 text-[#8f3522]">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden className="mt-px shrink-0">
              <circle cx="9" cy="9" r="7.5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M9 5.5v4M9 12.25v.01" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
            </svg>
            <span>{message}</span>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

/** A green check whose circle and tick draw themselves in. */
export function SuccessCheck({ size = 56 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 56 56" fill="none" aria-hidden>
      <motion.circle
        cx="28"
        cy="28"
        r="26"
        fill="rgb(25 149 79 / 0.1)"
        stroke="#19954f"
        strokeWidth="2.5"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 0.7, ease: EASE }}
      />
      <motion.path
        d="M17 29l7.5 7.5L39 21"
        stroke="#157642"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.5, ease: EASE, delay: 0.45 }}
      />
    </svg>
  );
}

/** Reads `{ message }` / `{ error }` from one of the site's form APIs. */
export async function postJson(url: string, body: unknown): Promise<{ ok: true; message?: string } | { ok: false; error: string }> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    let data: { message?: string; error?: string } = {};
    try {
      data = (await res.json()) as typeof data;
    } catch {
      // Non-JSON response; fall through to the generic messages below.
    }
    if (res.ok) return { ok: true, message: data.message };
    return { ok: false, error: data.error || "Something went wrong. Please try again." };
  } catch {
    return { ok: false, error: "We couldn’t reach the server. Check your connection and try again." };
  }
}
