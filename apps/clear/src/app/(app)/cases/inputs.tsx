import { useId, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@entrust/ui";

// Form controls the shared UI package doesn't have yet, styled like its Field.

const control = cn(
  "rounded-md border border-line-strong bg-surface px-3 text-sm text-ink",
  "transition-colors duration-150 ease-out hover:border-ink-3",
  "focus-visible:border-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/25",
);

export function SelectField({
  label,
  hint,
  options,
  groups,
  placeholder,
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  hint?: string;
  options?: readonly { value: string; label: string }[];
  groups?: readonly { label: string; options: readonly { value: string; label: string }[] }[];
  /** An empty first option, for "not recorded" or "choose one". */
  placeholder?: string;
}) {
  const id = useId();
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-semibold text-ink">
        {label}
      </label>
      <select id={id} className={cn(control, "h-10 w-full")} aria-describedby={hint ? `${id}-hint` : undefined} {...props}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options?.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
        {groups?.map((g) => (
          <optgroup key={g.label} label={g.label}>
            {g.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      {hint && (
        <p id={`${id}-hint`} className="text-sm text-ink-3">
          {hint}
        </p>
      )}
    </div>
  );
}

export function CheckboxGroup({
  legend,
  name,
  options,
  defaultValues = [],
  hint,
}: {
  legend: string;
  name: string;
  options: readonly { value: string; label: string }[];
  defaultValues?: readonly string[];
  hint?: string;
}) {
  return (
    <fieldset className="flex min-w-0 flex-col gap-2">
      <legend className="text-sm font-semibold text-ink">{legend}</legend>
      {hint && <p className="text-sm text-ink-3">{hint}</p>}
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        {options.map((o) => (
          <label key={o.value} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name={name}
              value={o.value}
              defaultChecked={defaultValues.includes(o.value)}
              className="size-4 accent-brand-600"
            />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function NoteField({ label, className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }) {
  const id = useId();
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-semibold text-ink">
        {label}
      </label>
      <textarea id={id} rows={2} className={cn(control, "w-full py-2")} {...props} />
    </div>
  );
}
