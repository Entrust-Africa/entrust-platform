// Class names the form inputs share, so the runner's controls look alike and are easy to tap on a phone.

// No width here: `cn` doesn't merge Tailwind classes, so a `w-full` here would beat a narrower width given beside it
// (the currency picker's `w-28`), and the picker would squeeze the amount box beside it to nothing.
export const inputBase =
  "rounded-md border bg-surface px-3 text-base text-ink placeholder:text-ink-3 transition-colors duration-150 " +
  "focus-visible:border-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/25 " +
  "disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-ink-3";

export const inputBorder = (invalid: boolean) => (invalid ? "border-danger" : "border-line-strong hover:border-ink-3");

export const textInput = (invalid: boolean) => `${inputBase} w-full h-12 ${inputBorder(invalid)}`;

/** The same box at 40px, the height of the staff screens' buttons and the shared Field. The 48px one is for forms people fill in on a phone. */
export const staffInput = (invalid: boolean) => `${inputBase} w-full h-10 sm:text-sm ${inputBorder(invalid)}`;

export const textArea = (invalid: boolean) => `${inputBase} w-full min-h-32 py-3 leading-relaxed ${inputBorder(invalid)}`;

/** A tappable choice row: at least 48px tall. */
export const choiceRow = (selected: boolean, disabled: boolean) =>
  [
    "flex min-h-12 w-full cursor-pointer items-center gap-3 rounded-md border px-3 py-2.5 text-left text-base transition-colors",
    "focus-within:ring-2 focus-within:ring-brand-600/25",
    selected ? "border-brand-600 bg-brand-50 text-brand-900" : "border-line-strong bg-surface text-ink hover:border-ink-3",
    disabled ? "cursor-not-allowed opacity-60" : "",
  ].join(" ");
