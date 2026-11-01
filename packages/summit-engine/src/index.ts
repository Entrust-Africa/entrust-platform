import { compareVersions } from "@entrust/forms";
import { APPLICATION_0_1_0 } from "./application/v1";
import { validateApplicationTemplates } from "./application/validate";
import { validateSummitRules } from "./validate";
import { SUMMIT_RULES_0_1_0 } from "./versions/v0-1-0";
import { SUMMIT_RULES_1_0_0 } from "./versions/v1-0-0";
import type { ApplicationTemplate } from "./application/types";
import type { SummitRules } from "./types";

export * from "./types";
export * from "./application/types";
export { validateApplicationTemplates } from "./application/validate";
export { validateSummitRules } from "./validate";
export { applicationPathway, applicationSeeksInvestment, eligibilityFindings, screenEligibility } from "./eligibility";
export type { CriterionResult, EligibilityException, EligibilityFinding, EligibilityResult, Finding, ScreeningInput } from "./eligibility";
export { categoryNoteProblems } from "./assessment";
export type { CategoryNote, NoteProblem } from "./assessment";
export { applicableCriteria, canAssess, scoreApplication, seeksInvestment } from "./scoring";
export type { CategoryScore, ScoreInput, ScoreProblem, ScoreProblemCode, ScoreResult } from "./scoring";
export { COMMITTEE_STATUSES, READINESS_CATEGORIES, applicantProfile, rankByScore, readinessPercent } from "./committee";
export type { ApplicantProfile } from "./committee";
export { verificationProblems } from "./verification";
export type { VerificationRecord } from "./verification";

// Every version of the Summit's rules and application form. Each score and application stores the version
// it used, so an approved or published version stays here after a newer one is added, and
// test/summit-engine.test.ts fails if one is edited. A draft can change, because nothing is scored or
// answered against it. Put a correction to an approved version in a new one.
export const SUMMIT_RULES: readonly SummitRules[] = [SUMMIT_RULES_0_1_0, SUMMIT_RULES_1_0_0];
export const APPLICATION_TEMPLATES: readonly ApplicationTemplate[] = [APPLICATION_0_1_0];

// Rules that don't validate never reach a score: loading the package fails instead.
const errors = [...validateSummitRules(SUMMIT_RULES), ...validateApplicationTemplates(APPLICATION_TEMPLATES)];
if (errors.length) throw new Error(`Invalid Summit rules:\n${errors.join("\n")}`);

export const findSummitRules = (version: string): SummitRules | undefined => SUMMIT_RULES.find((r) => r.version === version);
export const findApplicationTemplate = (version: string): ApplicationTemplate | undefined => APPLICATION_TEMPLATES.find((t) => t.version === version);

const newest = <T extends { version: string }>(versions: readonly T[]): T =>
  versions.reduce((latest, v) => (compareVersions(v.version, latest.version) > 0 ? v : latest));

/** The newest approved rules, for assessing now. Absent while every version is a draft. */
export function latestApprovedRules(): SummitRules | undefined {
  const approved = SUMMIT_RULES.filter((r) => r.status === "approved");
  return approved.length ? newest(approved) : undefined;
}

/** The newest published application form, for new applications. Absent while every version is a draft. */
export function latestPublishedTemplate(): ApplicationTemplate | undefined {
  const published = APPLICATION_TEMPLATES.filter((t) => t.status === "published");
  return published.length ? newest(published) : undefined;
}
