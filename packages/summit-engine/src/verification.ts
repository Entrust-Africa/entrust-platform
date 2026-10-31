import type { VerificationClass } from "./types";

/** An officer's classification of one claim in an application. */
export interface VerificationRecord {
  /** A claim ID from `VERIFIABLE_CLAIMS`, or any other important claim the officer names. */
  claim: string;
  class: VerificationClass;
  /** The uploaded files that support the claim. */
  documents?: readonly string[];
  /** What was checked outside the applicant's own submission: a registry lookup, a call to the bank, a site visit. */
  independentCheck?: string;
}

/**
 * What is wrong with a classification, one sentence each. Uploading a document never makes a claim
 * independently verified: that class needs a check the officer made outside the application.
 */
export function verificationProblems(record: VerificationRecord): string[] {
  const problems: string[] = [];
  const documents = record.documents?.length ?? 0;
  const check = record.independentCheck?.trim();
  if (!record.claim.trim()) problems.push("Name the claim.");
  if (record.class === "document_supported" && documents === 0) problems.push("A claim supported by documents needs at least one document.");
  if (record.class === "independently_verified" && !check) {
    problems.push("A claim can't be independently verified by an uploaded document alone: say what was checked outside the application.");
  }
  if (check && record.class !== "independently_verified") problems.push("An independent check belongs only on a claim classed as independently verified.");
  if (record.class === "not_applicable" && documents > 0) problems.push("A claim that doesn't apply has no documents.");
  return problems;
}
