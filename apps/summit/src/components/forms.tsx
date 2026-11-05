"use client";

import { useActionState, type ReactNode } from "react";
import type { FormState } from "@/app/commerce-actions";

// The pieces the ADTIS forms are made of, in the site's own look. A form posts to a server action, which posts to the API,
// so nothing here needs the API's address or any CORS rule.

const fieldLabel = "block text-sm font-semibold";
const control = "mt-1.5 block w-full border border-ink/25 bg-white px-3 text-sm text-ink placeholder:text-ink/40 focus:border-amber";

export function Req() {
  return (
    <span aria-hidden className="ml-0.5 text-amber-ink">
      *
    </span>
  );
}

export function Text({ name, label, required, type = "text", values, hint, placeholder, autoComplete }: {
  name: string; label: string; required?: boolean; type?: string; values: Record<string, string | undefined>; hint?: string; placeholder?: string; autoComplete?: string;
}) {
  return (
    <div>
      <label htmlFor={`f-${name}`} className={fieldLabel}>
        {label}
        {required && <Req />}
      </label>
      <input id={`f-${name}`} name={name} type={type} required={required} defaultValue={values[name] ?? ""} placeholder={placeholder} autoComplete={autoComplete} className={`${control} h-12`} />
      {hint && <p className="mt-1 text-xs text-ink/60">{hint}</p>}
    </div>
  );
}

export function Area({ name, label, required, values, hint, rows = 4 }: { name: string; label: string; required?: boolean; values: Record<string, string | undefined>; hint?: string; rows?: number }) {
  return (
    <div>
      <label htmlFor={`f-${name}`} className={fieldLabel}>
        {label}
        {required && <Req />}
      </label>
      <textarea id={`f-${name}`} name={name} rows={rows} required={required} defaultValue={values[name] ?? ""} className={`${control} py-3 leading-relaxed`} />
      {hint && <p className="mt-1 text-xs text-ink/60">{hint}</p>}
    </div>
  );
}

export function Select({ name, label, required, options, values, placeholder = "Choose", hint }: {
  name: string; label: string; required?: boolean; options: { value: string; label: string }[]; values: Record<string, string | undefined>; placeholder?: string; hint?: string;
}) {
  // A select ignores a new defaultValue once it is on the page, so the key rebuilds it with the values kept after an error.
  return (
    <div>
      <label htmlFor={`f-${name}`} className={fieldLabel}>
        {label}
        {required && <Req />}
      </label>
      <select key={`${name}-${values[name] ?? ""}`} id={`f-${name}`} name={name} required={required} defaultValue={values[name] ?? ""} className={`${control} h-12`}>
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {hint && <p className="mt-1 text-xs text-ink/60">{hint}</p>}
    </div>
  );
}

/**
 * The country list comes from the server as a prop. The browser names countries slightly differently from Node ("Türkiye" and
 * "Turkey"), so building the list on both sides would not match when the page hydrates.
 */
export function CountrySelect({ name = "country", label = "Country", required = true, values, options }: { name?: string; label?: string; required?: boolean; values: Record<string, string | undefined>; options: { code: string; name: string }[] }) {
  return <Select name={name} label={label} required={required} values={values} options={options.map((c) => ({ value: c.code, label: c.name }))} />;
}

/** The consent box. It must be ticked, and says what the visitor agrees to. */
export function Consent({ children }: { children: ReactNode }) {
  return (
    <label className="flex items-start gap-3 text-sm leading-relaxed text-ink/80">
      <input type="checkbox" name="consent" required className="mt-1 size-4 shrink-0 accent-amber" />
      <span>{children}</span>
    </label>
  );
}

/** A trap for bots: hidden from people, so only a script fills it in. */
export function Trap() {
  return (
    <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
      <label htmlFor="f-nickname">Leave this empty</label>
      <input id="f-nickname" name="nickname" tabIndex={-1} autoComplete="off" />
    </div>
  );
}

export function Submit({ pending, children }: { pending: boolean; children: ReactNode }) {
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="inline-flex h-14 items-center justify-center bg-amber px-8 text-sm font-semibold text-ink transition-[filter] hover:brightness-110 disabled:cursor-wait disabled:opacity-70"
    >
      {pending ? "Sending…" : children}
    </button>
  );
}

export function FormError({ message }: { message: string }) {
  return (
    <p role="alert" className="border border-red-700/40 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
      {message}
    </p>
  );
}

/** A form that posts to a server action and shows what comes back. `done` draws the confirmation. */
export function ActionForm({ action, children, done, className = "" }: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  children: (values: Record<string, string | undefined>, pending: boolean) => ReactNode;
  done: (state: Extract<FormState, { status: "done" }>) => ReactNode;
  className?: string;
}) {
  const [state, run, pending] = useActionState<FormState, FormData>(action, { status: "idle" });
  if (state.status === "done") return <>{done(state)}</>;
  const values = state.status === "error" ? state.values : {};
  return (
    <form action={run} className={`relative space-y-5 ${className}`}>
      {state.status === "error" && <FormError message={state.message} />}
      {children(values, pending)}
    </form>
  );
}
