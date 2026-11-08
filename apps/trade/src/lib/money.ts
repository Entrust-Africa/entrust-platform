/**
 * Adds amounts up per currency, one line each: ["KES 400,000", "EUR 60,000"]. Amounts in different currencies are never
 * added together. Past three currencies the rest are summed up as "+ 2 more", so a summary card stays short.
 */
export function totalsByCurrency(items: ReadonlyArray<{ currency: string | null | undefined; amount: number | null | undefined }>, none = "None yet"): string[] {
  const totals = new Map<string, number>();
  for (const { currency, amount } of items) {
    if (!amount) continue;
    const code = currency ?? "USD";
    totals.set(code, (totals.get(code) ?? 0) + amount);
  }
  const parts = [...totals.entries()].sort((a, b) => b[1] - a[1]).map(([code, total]) => `${code} ${total.toLocaleString("en-GB")}`);
  if (parts.length === 0) return [none];
  return parts.length > 3 ? [...parts.slice(0, 2), `+ ${parts.length - 2} more`] : parts;
}

/** "self_reported" read as "Self reported". */
export const humanise = (value: string): string => {
  const text = value.replace(/_/g, " ").trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
};
