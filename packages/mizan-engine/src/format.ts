// Number formatting that gives the same text everywhere (Worker, Node, browser), unlike toLocaleString, so a message in a
// frozen result never depends on where it was computed.

/** Rounds half away from zero, after clearing binary noise (64.95 stays 64.95, not 64.94999…). */
export function roundTo(value: number, decimals: number): number {
  const f = 10 ** decimals;
  const scaled = Number((Math.abs(value) * f).toPrecision(12));
  return (Math.sign(value) * Math.round(scaled)) / f;
}

/** A whole amount with comma thousands separators: 1234567.8 gives "1,234,568". */
export function formatAmount(value: number): string {
  const n = roundTo(value, 0);
  const digits = String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return n < 0 ? `-${digits}` : digits;
}

/** A share as a whole percentage: 0.756 gives "76%". */
export function formatPercent(share: number): string {
  return `${roundTo(share * 100, 0)}%`;
}
