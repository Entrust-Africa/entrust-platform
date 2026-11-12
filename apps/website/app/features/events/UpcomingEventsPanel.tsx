"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useId, useState, type FormEvent, type ReactNode } from "react";
import { buttonClasses } from "../../components/ui/Button";
import { ArrowUpRight } from "../../components/ui/icons";
import type { UpcomingEvent } from "./upcoming";

const EASE = [0.16, 1, 0.3, 1] as const;

type Status = { state: "idle" | "sending" | "done" | "error"; message?: string };

async function postJson(url: string, body: object): Promise<Status> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
    if (!res.ok) return { state: "error", message: data.error ?? "Something went wrong. Please try again." };
    return { state: "done", message: data.message };
  } catch {
    return { state: "error", message: "Network error. Please try again." };
  }
}

/**
 * The white panel in the Events hero. With no upcoming events in the CMS it
 * offers a "notify me" email sign-up; otherwise it lists the events, each with
 * an inline registration form that opens under it.
 */
export function UpcomingEventsPanel({ events }: { events: UpcomingEvent[] }) {
  return (
    <div className="flex flex-col gap-4 rounded-lg bg-surface p-6 shadow-[0_24px_48px_-24px_rgb(0_0_0/0.5)]">
      <h2 className="text-xl font-semibold leading-7 text-ink">Upcoming events</h2>
      {events.length ? <EventList events={events} /> : <NotifyMe />}
    </div>
  );
}

/* ------------------------------------------------------------ No dates yet */

function NotifyMe() {
  const [status, setStatus] = useState<Status>({ state: "idle" });
  const [email, setEmail] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus({ state: "sending" });
    const result = await postJson("/api/newsletter", { email, source: "events-notify" });
    setStatus(result);
    if (result.state === "done") setEmail("");
  }

  return (
    <>
      <p className="border-t border-line pt-4 text-base leading-6 text-muted">
        No dates announced yet. Leave your email and we’ll tell you when the next forum opens for registration.
      </p>
      <SwapOnSuccess
        done={status.state === "done"}
        success="Thanks. We’ll email you when the next forum opens for registration."
      >
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <Field label="Email" type="email" autoComplete="email" placeholder="you@company.com" value={email} onChange={setEmail} />
          <SubmitButton sending={status.state === "sending"}>Notify me</SubmitButton>
          <ErrorLine status={status} />
        </form>
      </SwapOnSuccess>
    </>
  );
}

/* ------------------------------------------------------------ Event list */

function EventList({ events }: { events: UpcomingEvent[] }) {
  const [open, setOpen] = useState<string | null>(events.length === 1 ? events[0].id : null);

  return (
    <ul className="flex flex-col">
      {events.map((ev) => {
        const isOpen = open === ev.id;
        return (
          <li key={ev.id} className="border-t border-line py-4 last:pb-0">
            <div className="flex items-start gap-4">
              <div
                aria-hidden
                className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-md bg-forest text-on-forest"
              >
                <span className="text-xl font-bold leading-6">{ev.day}</span>
                <span className="text-xs font-semibold uppercase tracking-wide text-on-forest-muted">{ev.month}</span>
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <h3 className="text-base font-semibold leading-[22px] text-ink">{ev.title}</h3>
                <p className="text-sm leading-5 text-muted">
                  {ev.dateLabel}
                  {ev.location ? ` · ${ev.location}` : ""}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-x-4">
                  {events.length > 1 && (
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      aria-controls={`rsvp-${ev.id}`}
                      onClick={() => setOpen(isOpen ? null : ev.id)}
                      className="inline-flex h-11 items-center gap-1.5 font-semibold text-brand"
                    >
                      <span className="link-grow">{isOpen ? "Close" : "Register"}</span>
                      <span className="sr-only">{isOpen ? " registration form" : ` for ${ev.title}`}</span>
                      <motion.svg
                        width="16"
                        height="16"
                        viewBox="0 0 16 16"
                        fill="none"
                        aria-hidden
                        animate={{ rotate: isOpen ? 180 : 0 }}
                        transition={{ duration: 0.4, ease: EASE }}
                      >
                        <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </motion.svg>
                    </button>
                  )}
                  {ev.link && (
                    <a
                      href={ev.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group/dl inline-flex h-11 items-center gap-1 text-sm font-semibold text-muted hover:text-ink"
                    >
                      <span className="link-grow">Event details</span>
                      <ArrowUpRight className="transition-transform duration-300 group-hover/dl:-translate-y-0.5 group-hover/dl:translate-x-0.5" />
                    </a>
                  )}
                </div>
              </div>
            </div>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  id={`rsvp-${ev.id}`}
                  key="form"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.5, ease: EASE }}
                  className="overflow-hidden"
                >
                  <RsvpForm eventName={ev.title} />
                </motion.div>
              )}
            </AnimatePresence>
          </li>
        );
      })}
    </ul>
  );
}

function RsvpForm({ eventName }: { eventName: string }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState<Status>({ state: "idle" });

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus({ state: "sending" });
    const result = await postJson("/api/event-rsvp", { eventName, name, email, phone });
    setStatus(result);
  }

  return (
    <SwapOnSuccess
      done={status.state === "done"}
      success={status.message ?? "Registration received. We’ll email you the details."}
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4 pt-4">
        <Field label="Full name" autoComplete="name" value={name} onChange={setName} />
        <Field label="Email" type="email" autoComplete="email" placeholder="you@company.com" value={email} onChange={setEmail} />
        <Field label="Phone (optional)" type="tel" autoComplete="tel" value={phone} onChange={setPhone} required={false} />
        <SubmitButton sending={status.state === "sending"}>Confirm registration</SubmitButton>
        <ErrorLine status={status} />
      </form>
    </SwapOnSuccess>
  );
}

/* ------------------------------------------------------------ Form parts */

function Field({
  label,
  value,
  onChange,
  type = "text",
  required = true,
  ...rest
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  autoComplete?: string;
  placeholder?: string;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium leading-5 text-ink">
        {label}
      </label>
      <input
        id={id}
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full rounded-md border border-line-strong bg-surface px-3 text-base text-ink placeholder:text-subtle transition-[border-color,box-shadow] duration-300 ease-(--ease-out-quart) hover:border-muted focus:border-brand focus:shadow-[0_0_0_4px_rgb(25_149_79/0.18)] focus-visible:outline-none"
        {...rest}
      />
    </div>
  );
}

function SubmitButton({ sending, children }: { sending: boolean; children: ReactNode }) {
  return (
    <button type="submit" disabled={sending} className={buttonClasses("primary", "lg", "w-full disabled:opacity-70")}>
      <span>{sending ? "Sending…" : children}</span>
    </button>
  );
}

function ErrorLine({ status }: { status: Status }) {
  return (
    <p role="status" aria-live="polite" className="min-h-0 text-sm text-terracotta empty:hidden">
      {status.state === "error" ? status.message : ""}
    </p>
  );
}

/** Cross-fades the form out and a ticked confirmation in once it succeeds. */
function SwapOnSuccess({ done, success, children }: { done: boolean; success: string; children: ReactNode }) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      {done ? (
        <motion.div
          key="done"
          role="status"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE }}
          className="flex items-start gap-3 rounded-md bg-page p-4"
        >
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden className="shrink-0">
            <motion.circle
              cx="14"
              cy="14"
              r="13"
              stroke="var(--color-brand-bright)"
              strokeWidth="2"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.6, ease: EASE }}
            />
            <motion.path
              d="M8.5 14.5l3.5 3.5 7.5-8"
              stroke="var(--color-brand-bright)"
              strokeWidth="2.25"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.45, ease: EASE, delay: 0.4 }}
            />
          </svg>
          <p className="text-base leading-6 text-ink">{success}</p>
        </motion.div>
      ) : (
        <motion.div key="form" exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3, ease: EASE }}>
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
