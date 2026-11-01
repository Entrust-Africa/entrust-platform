import { CURRENCIES, isDate } from "@entrust/forms";
import { figure, round2 } from "./amounts";
import type { Amount } from "./amounts";

/** ETB per one unit of the currency, and the day the rate is from. The SME enters both: the platform fetches no rates. */
export interface ExchangeRate {
  rate: number;
  date: string;
}

export interface EtbEquivalent {
  /** The amount in ETB, or null while the amount or the rate is missing. */
  amount: number | null;
  currency: string;
  /** The rate used. Null for ETB itself. */
  rate: number | null;
  date: string | null;
}

/**
 * A worksheet amount in ETB (#48): an ETB amount is itself, and ETB for USD or EUR needs the SME's rate and
 * its date. Without the rate the ETB figure stays blank rather than guessing one.
 */
export function etbEquivalent(money: { amount: Amount; currency: string }, fx?: ExchangeRate | null): EtbEquivalent {
  if (!(CURRENCIES as readonly string[]).includes(money.currency)) throw new RangeError(`currency must be ${CURRENCIES.join(", ")}, not "${money.currency}"`);
  const amount = figure("amount", money.amount);
  if (money.currency === "ETB") return { amount: amount === null ? null : round2(amount), currency: "ETB", rate: null, date: null };

  if (!fx) return { amount: null, currency: money.currency, rate: null, date: null };
  if (typeof fx.rate !== "number" || !Number.isFinite(fx.rate) || fx.rate <= 0) throw new RangeError("the exchange rate must be a number above 0");
  if (!isDate(fx.date)) throw new RangeError(`the rate's date must be a real date as YYYY-MM-DD, not "${fx.date}"`);
  return { amount: amount === null ? null : round2(amount * fx.rate), currency: money.currency, rate: fx.rate, date: fx.date };
}
