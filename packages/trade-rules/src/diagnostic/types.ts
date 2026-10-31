import type { FormDefinition } from "@entrust/forms";

/**
 * Where the answers to a section go once the diagnostic is submitted. The SME registry keeps section 1
 * and writes edits to the audit log, the insurance profile is for EthioLife's review and only Entrust
 * staff see it, and section 10 becomes consent records. Everything else is stored as responses.
 */
export const DIAGNOSTIC_STORAGE = ["sme_profile", "responses", "insurance_profile", "consent"] as const;
export type DiagnosticStorage = (typeof DIAGNOSTIC_STORAGE)[number];

/** The questions the pathway rule reads. They are named here so a new version can move them. */
export interface PathwayInputs {
  /** "Have you completed an export transaction?" A yes/no question. */
  exported: string;
  /** The date of the most recent shipment, asked only after a yes to `exported`. */
  lastShipment: string;
  /** Yes/no questions where a yes means a confirmed order or an active contract. */
  liveOrder: readonly string[];
}

/**
 * The TRADE SME Onboarding and Business Diagnostic. It is not scored: it gathers information and sorts
 * an SME onto Pathway A or B. The placement assessment (the TradeRules template) is a different form.
 */
export interface DiagnosticTemplate extends FormDefinition {
  /** By section ID. */
  storage: Readonly<Record<string, DiagnosticStorage>>;
  pathwayInputs: PathwayInputs;
  /** Questions in the document that the form doesn't ask, with the reason. */
  omitted: Readonly<Record<string, string>>;
}
