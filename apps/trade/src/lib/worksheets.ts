import type { ApiClient, Body } from "./summit-api";

// What the worksheet screens share: the shapes the API sends and how a value is shown. Nothing here talks to the network.

type Trade = ApiClient["v1"]["trade"];

export type WorksheetDefinition = Body<Awaited<ReturnType<Trade["worksheets"]["definitions"][":id"]["$get"]>>>;
export type WorksheetField = WorksheetDefinition["fields"][number];
export type WorksheetTable = WorksheetDefinition["tables"][number];
export type WorksheetVersion = Body<Awaited<ReturnType<Trade["worksheet-versions"][":id"]["$get"]>>>;
export type WorksheetSummaryList = Body<Awaited<ReturnType<Trade["worksheets"]["$get"]>>>;
export type WorksheetVersionList = Body<Awaited<ReturnType<Trade["worksheets"][":id"]["versions"]["$get"]>>>;
export type WorksheetResult = WorksheetVersion["result"];
export type WorksheetFlag = WorksheetResult["flags"][number];

export type ResultValue = number | string | null;

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** A YYYY-MM-DD date in words. Written out by hand so the server and the browser say it the same way. */
export function dayText(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return y && m && d ? `${d} ${MONTHS[m - 1]} ${y}` : day;
}

const number = (n: number): string => n.toLocaleString("en-GB", { maximumFractionDigits: 2 });

/** An amount with its currency, for example "ETB 2,400,000". */
export const moneyText = (amount: number, currency: string): string => `${currency} ${number(amount)}`;

/** A worked-out result as the learner reads it. A result that depends on something not entered yet is a dash, never a zero. */
export function resultText(kind: string, value: ResultValue | undefined, currency: string): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "string") return /^\d{4}-\d{2}-\d{2}$/.test(value) ? dayText(value) : value;
  switch (kind) {
    case "money":
      return moneyText(value, currency);
    case "percent":
      return `${number(value)}%`;
    case "days":
      return `${number(value)} day${value === 1 ? "" : "s"}`;
    default:
      return number(value);
  }
}

/** A value the learner entered, as plain text for the read-only summary. */
export function valueText(field: WorksheetField, value: unknown, currency: string): string {
  if (value === null || value === undefined || value === "") return "—";
  switch (field.kind) {
    case "money":
      return typeof value === "number" ? moneyText(value, currency) : String(value);
    case "percent":
      return typeof value === "number" ? `${number(value)}%` : String(value);
    case "number":
      return typeof value === "number" ? number(value) : String(value);
    case "date":
      return typeof value === "string" ? dayText(value) : String(value);
    case "checkbox":
      return value === true ? "Yes" : "No";
    case "choice":
      return field.options?.find((o) => o.value === value)?.label ?? String(value);
    default:
      return String(value);
  }
}

/** Whether a field is shown, given the values so far. */
export function isShown(field: WorksheetField, values: Record<string, unknown>): boolean {
  if (!field.showWhen) return true;
  const v = values[field.showWhen.field];
  return typeof v === "string" && field.showWhen.in.includes(v);
}

export const currencyOf = (values: Record<string, unknown>): string => (typeof values.currency === "string" && values.currency ? values.currency : "ETB");
