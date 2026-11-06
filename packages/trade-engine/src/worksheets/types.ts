import type { ModuleId } from "@entrust/trade-rules";

// Worksheets (#64, #65) are structured forms, not uploaded files. Each is defined here as data (its fields, tables and computed
// results) and worked out by `computeWorksheet`, which calls the calculators in this package. The arithmetic is never AI. The
// field kinds match the module content schema in @entrust/trade-content, so a content package can carry its own worksheets later.

export const FIELD_KINDS = ["text", "long_text", "number", "money", "percent", "date", "choice", "checkbox"] as const;
export type FieldKind = (typeof FIELD_KINDS)[number];

export interface WorksheetField {
  id: string;
  label: string;
  kind: FieldKind;
  required?: boolean;
  help?: string;
  /** The answers a choice field offers. */
  options?: readonly { value: string; label: string }[];
  /** Shown only while another field holds one of these values. */
  showWhen?: { field: string; in: readonly string[] };
}

export type ResultKind = "money" | "number" | "percent" | "days" | "text";

export interface WorksheetTable {
  id: string;
  label: string;
  columns: readonly WorksheetField[];
  /** Read-only columns the worksheet works out for each row. */
  computedColumns?: readonly { id: string; label: string; kind: ResultKind }[];
  minRows?: number;
  maxRows?: number;
}

export interface WorksheetComputed {
  id: string;
  label: string;
  kind: ResultKind;
  /** A money result that is also shown in ETB when the worksheet isn't in ETB. */
  etb?: boolean;
}

/** One block of the worksheet's layout, by the IDs of the fields, tables and results in it. */
export interface WorksheetSection {
  id: string;
  title: string;
  description?: string;
  items: readonly string[];
}

export interface WorksheetDefinition {
  id: string;
  module: ModuleId;
  title: string;
  description: string;
  /** Has amounts: the worksheet then opens with a currency and, when it isn't ETB, the rate and its date. */
  money: boolean;
  fields: readonly WorksheetField[];
  tables: readonly WorksheetTable[];
  computed: readonly WorksheetComputed[];
  sections: readonly WorksheetSection[];
  /** The worksheet that prefills this one when a new draft starts. */
  prefillFrom?: string;
  /** Section IDs that carry the brief's printable summary for a bank (M04). */
  printable?: boolean;
}

/** What the learner entered: a scalar for each field, and a list of rows for each table. */
export type WorksheetValues = Readonly<Record<string, unknown>>;

export type ResultValue = number | string | null;

export interface WorksheetFlag {
  code: string;
  /** A warning is for the learner. A critical-failure candidate is for the assessor to confirm; code never decides one. */
  severity: "warning" | "critical_candidate";
  message: string;
  /** The fields to mark. */
  fields: readonly string[];
}

export interface WorksheetProblem {
  /** The field, or `table.row.column`. */
  field: string;
  message: string;
}

export interface WorksheetResult {
  computed: Readonly<Record<string, ResultValue>>;
  /** Per table, one object per row with its computed columns. */
  rows: Readonly<Record<string, readonly Readonly<Record<string, ResultValue>>[]>>;
  /** The ETB equivalents of the money results marked `etb`, when the worksheet isn't in ETB. */
  etb: Readonly<Record<string, number | null>>;
  flags: readonly WorksheetFlag[];
  problems: readonly WorksheetProblem[];
}

export interface WorksheetContext {
  /** The enrolment's avenue, which decides whether M04 expects a verified order. */
  pathway?: "A" | "B" | undefined;
  /** The SME's live-order flag from the diagnostic. */
  liveOrder?: boolean | undefined;
}
