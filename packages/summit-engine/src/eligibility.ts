import { YES, effectiveAnswers, isNotKnown } from "@entrust/forms";
import type { Answer, Answers } from "@entrust/forms";
import type { ApplicationTemplate, OptionRule } from "./application/types";
import { DOCUMENT_KINDS, ELIGIBILITY_CRITERIA, ELIGIBILITY_STATUS, OPPORTUNITY_PATHWAYS } from "./types";
import type { ApplicationStatus, DocumentKind, EligibilityCriterionId, EligibilityOutcome, OpportunityPathway, SummitRules } from "./types";

/** What the application says about one requirement: it holds, it fails, or the answers don't settle it yet. */
export type Finding = "met" | "not_met" | "unclear";

export interface EligibilityFinding {
  id: EligibilityCriterionId;
  result: Finding;
  /** One sentence for the officer and the administrator. */
  reason: string;
}

/** An administrator accepts an applicant that doesn't meet a requirement, and says why. */
export interface EligibilityException {
  criterion: EligibilityCriterionId;
  reason: string;
  /** The administrator who recorded it. */
  by: string;
}

export interface CriterionResult {
  id: EligibilityCriterionId;
  text: string;
  /** `excepted` is a requirement that wasn't met and has an exception recorded. */
  result: Finding | "excepted";
  reason: string;
  exception?: EligibilityException;
}

export interface EligibilityResult {
  rulesVersion: string;
  outcome: EligibilityOutcome;
  /** The application status the outcome gives. "Pending clarification" has no status of its own. */
  status: ApplicationStatus;
  criteria: readonly CriterionResult[];
  /** Required documents not yet provided. */
  missingDocuments: readonly DocumentKind[];
}

export interface ScreeningInput {
  /** The kinds of document the applicant has uploaded. */
  documents: readonly string[];
  exceptions?: readonly EligibilityException[];
}

const textOf = (answer: Answer | undefined): string | undefined => (typeof answer === "string" ? answer : undefined);

function byOption(rule: OptionRule, answers: Answers, subject: string): Pick<EligibilityFinding, "result" | "reason"> {
  const answer = textOf(answers[rule.question]);
  if (answer !== undefined && rule.met.includes(answer)) return { result: "met", reason: `${subject}: ${answer.replaceAll("_", " ")}.` };
  if (answer !== undefined && rule.notMet.includes(answer)) return { result: "not_met", reason: `${subject}: ${answer.replaceAll("_", " ")}.` };
  return { result: "unclear", reason: `${subject}: not answered.` };
}

/** The pathway an application names, or undefined if it hasn't chosen one. */
export function applicationPathway(template: ApplicationTemplate, answers: Answers): OpportunityPathway | undefined {
  const answer = textOf(effectiveAnswers(template, answers)[template.inputs.pathway]);
  return OPPORTUNITY_PATHWAYS.find((p) => p === answer);
}

/**
 * Whether investment is part of what the applicant seeks, which decides whether category D is scored.
 * The investment and combined pathways seek it; a trade or partnership applicant says so in the form.
 */
export function applicationSeeksInvestment(template: ApplicationTemplate, answers: Answers): boolean {
  const pathway = applicationPathway(template, answers);
  if (pathway === "investment" || pathway === "combined_trade_and_investment") return true;
  return effectiveAnswers(template, answers)[template.inputs.seekingInvestment] === YES;
}

/** What each of the six requirements comes to for an application, before any exception. Check the answers with `checkAnswers` first. */
export function eligibilityFindings(
  rules: SummitRules,
  template: ApplicationTemplate,
  answers: Answers,
  documents: readonly string[],
): { findings: EligibilityFinding[]; missingDocuments: DocumentKind[] } {
  const effective = effectiveAnswers(template, answers);
  const { inputs } = template;

  const representative = effective[inputs.representative];
  const offering = inputs.offering.map((id) => effective[id]);
  const declaration = inputs.declaration.map((id) => effective[id]);

  const pathway = applicationPathway(template, answers);
  const required = pathway ? rules.eligibility.requiredDocuments[pathway] : [];
  const have = new Set(documents.filter((d): d is DocumentKind => (DOCUMENT_KINDS as readonly string[]).includes(d)));
  const missingDocuments = required.filter((kind) => !have.has(kind));

  const results: Record<EligibilityCriterionId, Pick<EligibilityFinding, "result" | "reason">> = {
    registered: byOption(inputs.registration, effective, "Legal status"),
    operating: byOption(inputs.operating, effective, "Operating status"),
    representative:
      representative === YES
        ? { result: "met", reason: "The applicant is an authorized representative." }
        : representative === "no"
          ? { result: "not_met", reason: "The applicant is not an authorized representative." }
          : { result: "unclear", reason: "Whether the applicant is an authorized representative isn't answered." },
    offering: offering.some((a) => a === undefined)
      ? { result: "unclear", reason: "The products or the business description isn't answered." }
      : offering.some((a) => isNotKnown(a))
        ? { result: "not_met", reason: "The applicant couldn't say what the business sells." }
        : { result: "met", reason: "The business describes what it sells." },
    declaration: declaration.some((a) => a === "no")
      ? { result: "not_met", reason: "The declaration or the data-use terms isn't accepted." }
      : declaration.every((a) => a === YES)
        ? { result: "met", reason: "The declaration and the data-use terms are accepted." }
        : { result: "unclear", reason: "The declaration or the data-use terms isn't answered." },
    documents: !pathway
      ? { result: "unclear", reason: "No opportunity pathway is chosen, so the required documents aren't known." }
      : missingDocuments.length
        ? { result: "unclear", reason: `Missing: ${missingDocuments.map((d) => d.replaceAll("_", " ")).join(", ")}.` }
        : { result: "met", reason: "The minimum supporting documents are provided." },
  };
  return { findings: ELIGIBILITY_CRITERIA.map((c) => ({ id: c.id, ...results[c.id] })), missingDocuments };
}

/**
 * Screen an application against the six requirements of section 5. A requirement that fails makes the
 * applicant ineligible, one the answers don't settle makes it pending clarification, and an
 * administrator's recorded exception counts a failed or unsettled requirement as satisfied. This says
 * nothing about the commercial score: an ineligible applicant is not scored zero, it is not scored.
 */
export function screenEligibility(rules: SummitRules, template: ApplicationTemplate, answers: Answers, input: ScreeningInput): EligibilityResult {
  const exceptions = new Map<EligibilityCriterionId, EligibilityException>();
  for (const e of input.exceptions ?? []) {
    if (!ELIGIBILITY_CRITERIA.some((c) => c.id === e.criterion)) throw new RangeError(`Unknown requirement "${e.criterion}"`);
    if (!e.reason.trim()) throw new RangeError(`An exception to "${e.criterion}" needs a reason`);
    if (!e.by.trim()) throw new RangeError(`An exception to "${e.criterion}" needs the administrator who recorded it`);
    if (exceptions.has(e.criterion)) throw new RangeError(`Two exceptions to "${e.criterion}"`);
    exceptions.set(e.criterion, e);
  }

  const { findings, missingDocuments } = eligibilityFindings(rules, template, answers, input.documents);
  const criteria: CriterionResult[] = findings.map((f) => {
    const text = ELIGIBILITY_CRITERIA.find((c) => c.id === f.id)?.text as string;
    const exception = exceptions.get(f.id);
    return exception && f.result !== "met" ? { id: f.id, text, result: "excepted", reason: f.reason, exception } : { id: f.id, text, result: f.result, reason: f.reason };
  });

  const outcome: EligibilityOutcome = criteria.some((c) => c.result === "not_met")
    ? "ineligible"
    : criteria.some((c) => c.result === "unclear")
      ? "pending_clarification"
      : "eligible";
  return { rulesVersion: rules.version, outcome, status: ELIGIBILITY_STATUS[outcome], criteria, missingDocuments };
}
