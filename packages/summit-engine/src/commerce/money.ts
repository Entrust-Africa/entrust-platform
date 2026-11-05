// Every commercial price is in US dollars (section 1), kept as whole cents so a later tax or part payment adds up exactly.

export const CURRENCY = "USD";

/** Dollars to cents, for prices typed in by a person. Rounds to the nearest cent. */
export const toCents = (dollars: number): number => Math.round(dollars * 100);

/** "$1,560", or "$1,560.50" when there are cents. */
export function formatUsd(cents: number): string {
  const whole = cents % 100 === 0;
  const text = (cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  });
  return `$${text}`;
}

/** What a price card shows: "Complimentary" for zero, otherwise the amount. */
export const priceLabel = (cents: number): string => (cents === 0 ? "Complimentary" : formatUsd(cents));
