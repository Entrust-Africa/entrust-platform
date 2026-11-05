"use client";

import { useActionState, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { registerAction, type RegistrationState } from "@/app/actions";
import { countryOptions } from "@/lib/countries";
import { PASSES, SUPPORT_EMAIL, type PassId } from "@/lib/content";

// Every "Register" or "Get ... Pass" button on the page opens one dialog. The buttons and the dialog
// don't share a parent, so the buttons announce themselves with a window event.
const OPEN_EVENT = "summit:open-registration";

/** A button that opens the participant registration dialog, with the pass the visitor picked if any. */
export function OpenRegistration({
  pass,
  className,
  children,
}: {
  pass?: PassId;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={className}
      onClick={() => window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: { pass } }))}
    >
      {children}
    </button>
  );
}

/** The participant registration form, in a modal. It is a fresh form each time the dialog opens. */
export function RegistrationDialog() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [opened, setOpened] = useState(0);
  const [pass, setPass] = useState<PassId | null>(null);

  useEffect(() => {
    function onOpen(event: Event) {
      setPass((event as CustomEvent<{ pass?: PassId }>).detail?.pass ?? null);
      setOpened((n) => n + 1);
      dialog.current?.showModal();
    }
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, []);

  return (
    <dialog
      ref={dialog}
      aria-labelledby="registration-title"
      onClick={(event) => {
        // A click on the backdrop lands on the dialog element itself.
        if (event.target === dialog.current) dialog.current?.close();
      }}
      className="m-auto w-[min(94vw,40rem)] overflow-hidden border border-amber/60 bg-white p-0 text-ink backdrop:bg-ink-deep/80"
    >
      <div className="flex max-h-[92dvh] flex-col">
        <div className="flex shrink-0 items-start justify-between gap-6 bg-ink px-6 py-5 text-white">
          <div>
            <p className="font-mono text-[11px] tracking-[0.18em] text-amber uppercase">Participant registration</p>
            <h2 id="registration-title" className="mt-2 font-display text-3xl leading-none uppercase">
              Register to attend
            </h2>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={() => dialog.current?.close()}
            className="-m-2 p-2 text-white/80 hover:text-white"
          >
            <X aria-hidden className="size-5" />
          </button>
        </div>

        <div className="overflow-y-auto">
          {/* Not rendered until the dialog has been opened, and rebuilt on each opening. */}
          {opened > 0 && <RegistrationForm key={opened} pass={pass} onClose={() => dialog.current?.close()} />}
        </div>
      </div>
    </dialog>
  );
}

const fieldLabel = "block text-sm font-semibold";
const fieldControl =
  "mt-1.5 block w-full border border-ink/25 bg-white px-3 text-sm text-ink placeholder:text-ink/40 focus:border-amber";

function Required() {
  return (
    <span aria-hidden className="ml-0.5 text-amber-ink">
      *
    </span>
  );
}

function RegistrationForm({ pass, onClose }: { pass: PassId | null; onClose: () => void }) {
  const [state, action, pending] = useActionState<RegistrationState, FormData>(registerAction, { status: "idle" });
  const countries = useMemo(countryOptions, []);

  if (state.status === "done") {
    return (
      <div className="px-6 py-8">
        <p className="font-mono text-[11px] tracking-[0.18em] text-amber-ink uppercase">Reference {state.number}</p>
        <h3 className="mt-3 font-display text-3xl leading-none uppercase">You&apos;re registered</h3>
        <p className="mt-4 text-base leading-relaxed text-ink/80">
          We have you down for the {state.passName}. We&apos;ll send a confirmation to <strong>{state.email}</strong>.
          Nothing is charged yet: we&apos;ll write to you with the next steps for your ticket.
        </p>
        <button
          type="button"
          onClick={onClose}
          className="mt-6 inline-flex h-12 items-center bg-amber px-6 text-sm font-semibold text-ink hover:brightness-110"
        >
          Close
        </button>
      </div>
    );
  }

  const values = state.status === "error" ? state.values : {};

  return (
    <form action={action} className="relative space-y-4 px-6 py-6">
      <p className="text-sm leading-relaxed text-ink/70">
        Tell us who is coming and which pass you want. Fields marked <span className="text-amber-ink">*</span> are
        required.
      </p>

      <div>
        <label htmlFor="reg-pass" className={fieldLabel}>
          Pass
          <Required />
        </label>
        {/* A select ignores a new defaultValue once it is on the page, so the key rebuilds it with the values kept after an error. */}
        <select
          key={`pass-${values.pass ?? ""}`}
          id="reg-pass"
          name="pass"
          required
          defaultValue={values.pass ?? pass ?? ""}
          className={`${fieldControl} h-11`}
        >
          <option value="" disabled>
            Choose a pass
          </option>
          {PASSES.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} · {p.price}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="reg-name" className={fieldLabel}>
            Full name
            <Required />
          </label>
          <input
            id="reg-name"
            name="fullName"
            required
            minLength={2}
            maxLength={120}
            autoComplete="name"
            defaultValue={values.fullName}
            className={`${fieldControl} h-11`}
          />
        </div>
        <div>
          <label htmlFor="reg-email" className={fieldLabel}>
            Email
            <Required />
          </label>
          <input
            id="reg-email"
            name="email"
            type="email"
            required
            maxLength={254}
            autoComplete="email"
            defaultValue={values.email}
            className={`${fieldControl} h-11`}
          />
        </div>
        <div>
          <label htmlFor="reg-organisation" className={fieldLabel}>
            Organisation
            <Required />
          </label>
          <input
            id="reg-organisation"
            name="organisation"
            required
            maxLength={160}
            autoComplete="organization"
            defaultValue={values.organisation}
            className={`${fieldControl} h-11`}
          />
        </div>
        <div>
          <label htmlFor="reg-title" className={fieldLabel}>
            Job title
            <Required />
          </label>
          <input
            id="reg-title"
            name="jobTitle"
            required
            maxLength={120}
            autoComplete="organization-title"
            defaultValue={values.jobTitle}
            className={`${fieldControl} h-11`}
          />
        </div>
        <div>
          <label htmlFor="reg-country" className={fieldLabel}>
            Country you are based in
            <Required />
          </label>
          <select
            key={`country-${values.country ?? ""}`}
            id="reg-country"
            name="country"
            required
            autoComplete="country"
            defaultValue={values.country ?? ""}
            className={`${fieldControl} h-11`}
          >
            <option value="" disabled>
              Choose a country
            </option>
            {countries.map(({ code, name }) => (
              <option key={code} value={code}>
                {name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="reg-phone" className={fieldLabel}>
            Phone <span className="font-normal text-ink/55">(optional)</span>
          </label>
          <input
            id="reg-phone"
            name="phone"
            type="tel"
            maxLength={40}
            autoComplete="tel"
            defaultValue={values.phone}
            className={`${fieldControl} h-11`}
          />
        </div>
      </div>

      <div>
        <label htmlFor="reg-notes" className={fieldLabel}>
          Anything we should know? <span className="font-normal text-ink/55">(optional)</span>
        </label>
        <textarea
          id="reg-notes"
          name="notes"
          rows={3}
          maxLength={1000}
          defaultValue={values.notes}
          className={`${fieldControl} py-2.5`}
        />
      </div>

      {/* A trap for bots. People never see it or reach it with the keyboard. */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Leave this empty
          <input name="website" type="text" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <label className="flex items-start gap-3 text-sm leading-relaxed text-ink/80">
        <input
          name="consent"
          type="checkbox"
          required
          defaultChecked={state.status === "error"}
          className="mt-1 size-4 shrink-0 accent-amber"
        />
        <span>
          I agree that the Diaspora Trade Summit organisers may contact me about my registration and the event.
          <Required />
        </span>
      </label>

      {state.status === "error" && (
        <p role="alert" className="border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900">
          {state.message}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-4 pt-1">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-12 items-center bg-amber px-8 text-sm font-semibold text-ink hover:brightness-110 disabled:cursor-wait disabled:opacity-70"
        >
          {pending ? "Sending…" : "Register"}
        </button>
        <p className="text-xs text-ink/60">
          Questions? <a href={`mailto:${SUPPORT_EMAIL}`} className="underline underline-offset-2 hover:text-ink">{SUPPORT_EMAIL}</a>
        </p>
      </div>
    </form>
  );
}
