import { eq, inArray, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { schema } from "../src";

try {
  process.loadEnvFile("../../.env");
} catch {
  // Fall back to existing environment
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

// Rows this test owns, by prefix, so it never touches anything else in the shared dev database.
const SME = "test-mizan-sme-1";
const SME_2 = "test-mizan-sme-2";
const ORGS = [SME, SME_2];
const ASSESSOR = "test-mizan-assessor";
const REVIEWER = "test-mizan-reviewer";
const USERS = [ASSESSOR, REVIEWER];

async function clean() {
  // Approved assessments can't be deleted without the escape hatch, which is what it is for.
  await db.transaction(async (tx) => {
    await tx.execute(sql`set local mizan.allow_frozen_delete = 'on'`);
    await tx.delete(schema.mizanReview).where(inArray(schema.mizanReview.reviewerUserId, USERS));
    // One statement: assessments that point at each other (previous, superseded by) go together, and the foreign keys are
    // checked at the end of the statement.
    await tx.delete(schema.mizanAssessment).where(inArray(schema.mizanAssessment.organizationId, ORGS));
  });
}

beforeAll(async () => {
  for (const id of ORGS) {
    await db.insert(schema.organization).values({ id, name: id, slug: id, createdAt: new Date(), metadata: JSON.stringify({ kind: "sme" }) }).onConflictDoNothing();
  }
  for (const id of USERS) {
    await db.insert(schema.user).values({ id, name: id, email: `${id}@example.test` }).onConflictDoNothing();
  }
});

beforeEach(clean);

afterAll(async () => {
  await clean();
  await db.delete(schema.organization).where(inArray(schema.organization.id, ORGS));
  await db.delete(schema.user).where(inArray(schema.user.id, USERS));
  await pool.end();
});

const pinned = {
  methodology: "MIZAN-Core v0.2-interim",
  configVersion: "0.2.1-interim",
  configFingerprint: "a5c40c6be7b0d0d4cee83e39a1f4639ed89a9ed4a2c1864d20d016f591d0376d",
  engineVersion: "mizan-engine 0.1.0",
  countryModule: "MIZAN-ET v0.1-draft",
  currency: "ETB",
  assessorUserId: ASSESSOR,
};

async function draft(organizationId = SME, sequence = 1, extra: Partial<typeof schema.mizanAssessment.$inferInsert> = {}) {
  const [a] = await db
    .insert(schema.mizanAssessment)
    .values({ organizationId, sequence, assessmentNo: `TEST-${organizationId}-A${sequence}`, ...pinned, ...extra })
    .returning();
  return a!;
}

const FROZEN = '{"b":"Addis Ababa — ብር","a":[1,2.5,null]}';

async function approve(id: string) {
  await db
    .update(schema.mizanAssessment)
    .set({ status: "approved", resultJson: FROZEN, resultSha256: "f".repeat(64), verificationCode: `TEST-${id}`, approvedAt: new Date(), reviewerUserId: REVIEWER })
    .where(eq(schema.mizanAssessment.id, id));
}

/** Postgres's error message for a statement that should fail. */
async function failure(statement: Promise<unknown>): Promise<string> {
  try {
    await statement;
  } catch (e) {
    const err = e as { cause?: { message?: string }; message?: string };
    return err.cause?.message ?? err.message ?? String(e);
  }
  throw new Error("expected the statement to fail");
}

describe("an approved assessment is frozen", () => {
  it("lets a draft's inputs change, then refuses every change once approved", async () => {
    const a = await draft();
    await db.insert(schema.mizanRating).values({ assessmentId: a.id, criterionId: "D1.1", rating: "3", evidence: "E3" });
    await db.update(schema.mizanRating).set({ rating: "4" }).where(eq(schema.mizanRating.assessmentId, a.id));
    await db.insert(schema.mizanGateResult).values({ assessmentId: a.id, gateId: "G1", status: "pass" });
    await approve(a.id);

    expect(await failure(db.update(schema.mizanRating).set({ rating: "2" }).where(eq(schema.mizanRating.assessmentId, a.id)))).toContain(
      "The inputs of an approved MIZAN assessment cannot be changed (rating)",
    );
    expect(await failure(db.insert(schema.mizanRating).values({ assessmentId: a.id, criterionId: "D1.2", rating: "NE" }))).toContain("cannot be changed (rating)");
    expect(await failure(db.delete(schema.mizanGateResult).where(eq(schema.mizanGateResult.assessmentId, a.id)))).toContain("cannot be changed (gate_result)");
    expect(
      await failure(db.insert(schema.mizanFinancialYear).values({ assessmentId: a.id, fiscalYear: "2025", statementBasis: "audited", data: {} as never })),
    ).toContain("cannot be changed (financial_year)");
    expect(await failure(db.insert(schema.mizanOverrideFlag).values({ assessmentId: a.id, overrideId: "O1", triggered: true, reason: "x" }))).toContain(
      "cannot be changed (override_flag)",
    );
    expect(await failure(db.update(schema.mizanAssessment).set({ status: "draft" }).where(eq(schema.mizanAssessment.id, a.id)))).toContain(
      "is approved and cannot be changed",
    );
    expect(await failure(db.update(schema.mizanAssessment).set({ resultJson: "{}" }).where(eq(schema.mizanAssessment.id, a.id)))).toContain("cannot be changed");
    expect(await failure(db.delete(schema.mizanAssessment).where(eq(schema.mizanAssessment.id, a.id)))).toContain("is approved and cannot be deleted");
  });

  it("can record the assessment that supersedes it, once", async () => {
    const a = await draft();
    await approve(a.id);
    const b = await draft(SME, 2, { kind: "amendment", previousAssessmentId: a.id, reason: "Typo in 2025 revenue" });
    await db.update(schema.mizanAssessment).set({ supersededById: b.id }).where(eq(schema.mizanAssessment.id, a.id));
    const c = await draft(SME_2, 1);
    expect(await failure(db.update(schema.mizanAssessment).set({ supersededById: c.id }).where(eq(schema.mizanAssessment.id, a.id)))).toContain("cannot be changed");
  });

  it("keeps the frozen text byte for byte", async () => {
    const a = await draft();
    await approve(a.id);
    const [row] = await db.select({ json: schema.mizanAssessment.resultJson }).from(schema.mizanAssessment).where(eq(schema.mizanAssessment.id, a.id));
    expect(row!.json).toBe(FROZEN);
  });

  it("can't be approved without its result, hash, code, date and reviewer", async () => {
    const a = await draft();
    expect(await failure(db.update(schema.mizanAssessment).set({ status: "approved" }).where(eq(schema.mizanAssessment.id, a.id)))).toContain(
      "mizan_assessment_frozen_check",
    );
  });
});

describe("assessment rules", () => {
  it("allows one open assessment per SME", async () => {
    await draft(SME, 1);
    expect(await failure(draft(SME, 2))).toContain("mizan_assessment_one_open_uidx");
    await draft(SME_2, 1);
  });

  it("gives two creates at once different numbers: the second one fails and can retry", async () => {
    const a = await draft(SME, 1);
    await approve(a.id);
    const results = await Promise.allSettled([
      draft(SME, 2, { kind: "reassessment", previousAssessmentId: a.id }),
      draft(SME, 2, { kind: "reassessment", previousAssessmentId: a.id }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual(["fulfilled", "rejected"]);
  });

  it("keeps the reviewer apart from the assessor", async () => {
    const a = await draft();
    expect(await failure(db.update(schema.mizanAssessment).set({ reviewerUserId: ASSESSOR }).where(eq(schema.mizanAssessment.id, a.id)))).toContain(
      "mizan_assessment_reviewer_check",
    );
  });

  it("links every follow-on record to the one before, and only those", async () => {
    expect(await failure(draft(SME, 1, { kind: "rescore" }))).toContain("mizan_assessment_follow_on_check");
  });

  it("needs comments to return and the declaration to approve", async () => {
    const a = await draft();
    const review = (decision: "approved" | "returned", comments: string | null, declarationConfirmed: boolean) =>
      db.insert(schema.mizanReview).values({ assessmentId: a.id, reviewerUserId: REVIEWER, decision, comments, declarationConfirmed });
    expect(await failure(review("returned", "  ", false))).toContain("mizan_review_comments_check");
    expect(await failure(review("approved", null, false))).toContain("mizan_review_declaration_check");
    await review("returned", "Add the 2024 bank statements.", false);
  });

  it("needs a reason for a triggered override, and stores ratings as scores or codes only", async () => {
    const a = await draft();
    expect(await failure(db.insert(schema.mizanOverrideFlag).values({ assessmentId: a.id, overrideId: "O1", triggered: true }))).toContain(
      "mizan_override_reason_check",
    );
    expect(await failure(db.execute(sql`insert into mizan.rating (assessment_id, criterion_id, rating) values (${a.id}, 'D1.1', '5')`))).toBeTruthy();
    expect(await failure(db.insert(schema.mizanRating).values({ assessmentId: a.id, criterionId: "D1.1", rating: "3", evidence: "E9" as never }))).toContain(
      "mizan_rating_evidence_check",
    );
  });
});
