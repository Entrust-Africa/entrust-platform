import { and, eq, ne } from "drizzle-orm";
import { schema } from "@entrust/db";
import { checkAnswers, isNotKnown } from "@entrust/forms";
import { findDiagnosticTemplate, type DiagnosticTemplate } from "@entrust/trade-rules";
import type { Executor } from "./db";
import { recordTradeChange, wrapAnswer } from "./trade-shared";

// Section 1 of the onboarding diagnostic is the SME's registry entry (the template's `storage` says "sme_profile"). When a
// diagnostic is submitted its answers are written to core.sme_profile, and every change is audited with the values before
// and after. When one is started, the profile's values are filled in, so the form is also the place to correct them.

type ProfileRow = typeof schema.smeProfile.$inferSelect;

/** The profile columns section 1 maps onto. */
export type ProfileColumn =
  | "legalName"
  | "tradingName"
  | "registrationNumber"
  | "tin"
  | "yearEstablished"
  | "ownershipType"
  | "businessEmail"
  | "businessPhone"
  | "address"
  | "website"
  | "socialPages"
  | "sector"
  | "mainActivity"
  | "permanentEmployees"
  | "temporaryEmployees"
  | "womanOwned"
  | "premises";

type Kind = "text" | "number" | "yes_no" | "choice";

/** Section 1's questions, by ID, and the profile column each one fills. Q7 isn't asked: the signed-in user is the person. */
const SECTION_ONE: Readonly<Record<string, { column: ProfileColumn; kind: Kind }>> = {
  Q1: { column: "legalName", kind: "text" },
  Q2: { column: "tradingName", kind: "text" },
  Q3: { column: "registrationNumber", kind: "text" },
  Q4: { column: "tin", kind: "text" },
  Q5: { column: "yearEstablished", kind: "number" },
  Q6: { column: "ownershipType", kind: "choice" },
  Q8: { column: "businessEmail", kind: "text" },
  Q9: { column: "businessPhone", kind: "text" },
  Q10: { column: "address", kind: "text" },
  Q11: { column: "website", kind: "text" },
  Q12: { column: "socialPages", kind: "text" },
  Q13: { column: "sector", kind: "text" },
  Q14: { column: "mainActivity", kind: "choice" },
  Q15: { column: "permanentEmployees", kind: "number" },
  Q16: { column: "temporaryEmployees", kind: "number" },
  Q17: { column: "womanOwned", kind: "yes_no" },
  Q18: { column: "premises", kind: "choice" },
};

type Value = string | number | boolean | null;
export type ProfileValues = Partial<Record<ProfileColumn, Value>>;

/** Reads a stored answer as the profile column's value. Undefined means leave the column alone. */
function valueOf(kind: Kind, answer: unknown): Value | undefined {
  if (answer === undefined || answer === null) return null;
  if (isNotKnown(answer as never)) return undefined;
  switch (kind) {
    case "number":
      return typeof answer === "number" && Number.isFinite(answer) ? Math.trunc(answer) : undefined;
    case "yes_no":
      return answer === "yes" ? true : answer === "no" ? false : undefined;
    case "text":
    case "choice":
      return typeof answer === "string" ? answer.trim() || null : undefined;
  }
}

/**
 * What a submitted diagnostic's section 1 says, by profile column. A question the SME left empty (the optional ones) is
 * null, which clears the column; "I don't know" on a number leaves the column as it is.
 */
export function profileValues(answers: Readonly<Record<string, unknown>>): ProfileValues {
  const values: ProfileValues = {};
  for (const [question, { column, kind }] of Object.entries(SECTION_ONE)) {
    const value = valueOf(kind, answers[question]);
    if (value !== undefined) values[column] = value;
  }
  return values;
}

/** The answers to section 1 that a profile already holds, by question ID, in the shape the diagnostic stores them. */
export function profileAnswers(profile: ProfileRow): Record<string, string | number> {
  const answers: Record<string, string | number> = {};
  for (const [question, { column, kind }] of Object.entries(SECTION_ONE)) {
    const value = profile[column];
    if (value === null || value === undefined) continue;
    if (kind === "yes_no") answers[question] = value ? "yes" : "no";
    else if (typeof value === "string" || typeof value === "number") answers[question] = value;
  }
  return answers;
}

/**
 * Writes the diagnostic's section 1 to the organisation's profile and audits what changed. A registration number another
 * business already holds in the same country is not written (the number is unique); the audit entry says so, and Entrust
 * sees the duplicate in the register. Returns the columns that changed.
 */
export async function writeSectionOne(
  tx: Executor,
  userId: string | null,
  organizationId: string,
  assessmentId: string,
  answers: Readonly<Record<string, unknown>>,
): Promise<ProfileColumn[]> {
  const [profile] = await tx.select().from(schema.smeProfile).where(eq(schema.smeProfile.organizationId, organizationId));
  if (!profile) return [];
  const values = profileValues(answers);
  // The legal name can't be empty, whatever the form says.
  if (!values.legalName) delete values.legalName;

  const skipped: Partial<Record<ProfileColumn, string>> = {};
  if (typeof values.registrationNumber === "string" && values.registrationNumber !== profile.registrationNumber) {
    const [taken] = await tx
      .select({ id: schema.smeProfile.id })
      .from(schema.smeProfile)
      .where(and(eq(schema.smeProfile.registrationNumber, values.registrationNumber), eq(schema.smeProfile.country, profile.country), ne(schema.smeProfile.id, profile.id)));
    if (taken) {
      delete values.registrationNumber;
      skipped.registrationNumber = "another business already holds this registration number";
    }
  }

  const before: Record<string, Value> = {};
  const after: Record<string, Value> = {};
  for (const [column, value] of Object.entries(values) as [ProfileColumn, Value][]) {
    const current = profile[column] ?? null;
    if (current === value) continue;
    before[column] = current as Value;
    after[column] = value;
  }
  const changed = Object.keys(after) as ProfileColumn[];
  if (changed.length === 0 && Object.keys(skipped).length === 0) return [];

  if (changed.length) await tx.update(schema.smeProfile).set(after).where(eq(schema.smeProfile.id, profile.id));
  await recordTradeChange(tx, userId, {
    action: "sme_profile.updated",
    entityType: "sme_profile",
    organizationId,
    entityId: profile.id,
    before,
    after: Object.keys(skipped).length ? { ...after, notWritten: skipped } : after,
    reason: `Onboarding diagnostic, section 1 (assessment ${assessmentId})`,
  });
  return changed;
}

/**
 * The section 1 answers to start a new diagnostic with: what the profile holds, each checked against the form so a value
 * the form wouldn't take (a year before 1900, say) is left for the person to fill in.
 */
export function prefillAnswers(template: DiagnosticTemplate, profile: ProfileRow, today: string): Record<string, string | number> {
  const prefill: Record<string, string | number> = {};
  for (const [question, answer] of Object.entries(profileAnswers(profile))) {
    if (!template.questions.some((q) => q.id === question)) continue;
    if (checkAnswers(template, { [question]: answer } as never, { today }).errors.length === 0) prefill[question] = answer;
  }
  return prefill;
}

/** Starts a new diagnostic with the profile's section 1 answers in place, so the form shows what the registry holds. */
export async function savePrefill(tx: Executor, assessmentId: string, organizationId: string, templateVersion: string, today: string): Promise<void> {
  const template = findDiagnosticTemplate(templateVersion);
  const [profile] = await tx.select().from(schema.smeProfile).where(eq(schema.smeProfile.organizationId, organizationId));
  if (!template || !profile) return;
  const answers = Object.entries(prefillAnswers(template, profile, today));
  if (answers.length === 0) return;
  await tx.insert(schema.assessmentResponse).values(answers.map(([questionId, answer]) => ({ assessmentId, questionId, answer: wrapAnswer(answer) })));
}
