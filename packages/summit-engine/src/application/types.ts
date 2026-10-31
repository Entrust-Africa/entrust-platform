import type { FormDefinition } from "@entrust/forms";

/** A question whose answer is one of a set of options that mean yes, no or "not decided" to a rule. */
export interface OptionRule {
  question: string;
  /** Answers that satisfy the requirement. */
  met: readonly string[];
  /** Answers that fail it. Any other answer leaves it unclear. */
  notMet: readonly string[];
}

/** The questions eligibility and scoring read, named here so a new version can move them. */
export interface ApplicationInputs {
  /** The primary opportunity pathway: a single-choice question offering exactly the four pathways. */
  pathway: string;
  /** "Are you seeking investment?" Asked only of a trade or partnership applicant, since the other two pathways seek it. */
  seekingInvestment: string;
  registration: OptionRule;
  operating: OptionRule;
  /** A yes/no question: the applicant is an authorized representative. */
  representative: string;
  /** Questions that have to hold a real answer for the commercial offering to be identifiable. */
  offering: readonly string[];
  /** Yes/no questions that have to be yes for the declaration and data-use terms to be accepted. */
  declaration: readonly string[];
}

/**
 * The Summit application form. A draft can change and can't take applications yet. A published version
 * never changes, because every application stores the version it was answered on.
 */
export interface ApplicationTemplate extends FormDefinition {
  status: "draft" | "published";
  /** Questions the SME registry fills in ahead of time, so the applicant isn't asked again. Edits write back to it. */
  registry: readonly string[];
  inputs: ApplicationInputs;
}
