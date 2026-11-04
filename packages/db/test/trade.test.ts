import { eq, inArray } from "drizzle-orm";
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

// Isolated test country code ("ZT") and organizations
const TEST_COUNTRY = "ZT";
const SPONSOR_ORG = "test-trade-sponsor-org";
const SME_ORG_1 = "test-trade-sme-org-1";
const SME_ORG_2 = "test-trade-sme-org-2";
const ALL_ORGS = [SPONSOR_ORG, SME_ORG_1, SME_ORG_2];

async function clean() {
  await db.delete(schema.auditLog).where(inArray(schema.auditLog.organizationId, ALL_ORGS));
  await db.delete(schema.tradeOutcome).where(inArray(schema.tradeOutcome.organizationId, ALL_ORGS));
  await db.delete(schema.commercialOpportunity).where(inArray(schema.commercialOpportunity.organizationId, ALL_ORGS));
  await db.delete(schema.evidenceRecord).where(inArray(schema.evidenceRecord.organizationId, ALL_ORGS));
  await db.delete(schema.moduleProgress).where(eq(schema.moduleProgress.contentVersion, "1.0.0"));
  await db.delete(schema.moduleAssignment).where(eq(schema.moduleAssignment.source, "engine"));
  await db.delete(schema.learningPlan).where(eq(schema.learningPlan.rulesVersion, "1.0.0"));
  await db.delete(schema.capabilityScore).where(eq(schema.capabilityScore.domain, "D01"));
  await db.delete(schema.assessmentResponse).where(eq(schema.assessmentResponse.questionId, "A1"));
  await db.delete(schema.tradeAssessment).where(eq(schema.tradeAssessment.templateVersion, "1.0.0"));
  await db.delete(schema.enrollment).where(inArray(schema.enrollment.organizationId, ALL_ORGS));
  await db.delete(schema.cohort).where(eq(schema.cohort.country, TEST_COUNTRY));
  await db.delete(schema.program).where(eq(schema.program.name, "Test TRADE Program"));
}

beforeAll(async () => {
  for (const orgId of ALL_ORGS) {
    await db
      .insert(schema.organization)
      .values({
        id: orgId,
        name: orgId,
        slug: orgId,
        createdAt: new Date(),
        metadata: JSON.stringify({ kind: orgId === SPONSOR_ORG ? "sponsor" : "sme" }),
      })
      .onConflictDoNothing();
  }
});

beforeEach(clean);

afterAll(async () => {
  await clean();
  await db.delete(schema.organization).where(inArray(schema.organization.id, ALL_ORGS));
  await pool.end();
});

describe("TRADE database schema (#55)", () => {
  async function setupProgramAndCohort() {
    const [prog] = await db
      .insert(schema.program)
      .values({ name: "Test TRADE Program", description: "Zemen Bank Pilot" })
      .returning();

    const [coh] = await db
      .insert(schema.cohort)
      .values({
        programId: prog!.id,
        name: "Cohort 1 - Pilot",
        sponsorOrganizationId: SPONSOR_ORG,
        country: TEST_COUNTRY,
        language: "en",
        deliveryMode: "hybrid",
        startDate: "2026-11-01",
        endDate: "2027-02-01",
      })
      .returning();

    return { program: prog!, cohort: coh! };
  }

  describe("program, cohort and enrollment", () => {
    it("enforces unique enrollment per SME per cohort", async () => {
      const { cohort } = await setupProgramAndCohort();

      // First enrollment succeeds
      const [enr1] = await db
        .insert(schema.enrollment)
        .values({
          cohortId: cohort.id,
          organizationId: SME_ORG_1,
          status: "invited",
        })
        .returning();
      expect(enr1?.id).toBeDefined();

      // Duplicate enrollment in the same cohort fails
      await expect(
        db.insert(schema.enrollment).values({
          cohortId: cohort.id,
          organizationId: SME_ORG_1,
          status: "active",
        }),
      ).rejects.toThrow();
    });

    it("allows an SME to enrol in multiple cohorts", async () => {
      const { program, cohort: cohort1 } = await setupProgramAndCohort();
      const [cohort2] = await db
        .insert(schema.cohort)
        .values({
          programId: program.id,
          name: "Cohort 2",
          country: TEST_COUNTRY,
        })
        .returning();

      await db.insert(schema.enrollment).values({ cohortId: cohort1.id, organizationId: SME_ORG_1 });
      const [enr2] = await db
        .insert(schema.enrollment)
        .values({ cohortId: cohort2!.id, organizationId: SME_ORG_1 })
        .returning();

      expect(enr2?.id).toBeDefined();
    });
  });

  describe("assessment and one-live-row constraint", () => {
    it("allows only one live placement assessment per enrolment", async () => {
      const { cohort } = await setupProgramAndCohort();
      const [enr] = await db
        .insert(schema.enrollment)
        .values({ cohortId: cohort.id, organizationId: SME_ORG_1 })
        .returning();

      // First live placement assessment
      const [first] = await db
        .insert(schema.tradeAssessment)
        .values({
          enrollmentId: enr!.id,
          kind: "placement",
          templateVersion: "1.0.0",
          status: "draft",
        })
        .returning();
      expect(first?.id).toBeDefined();

      // A second live placement assessment for the same enrolment is rejected
      await expect(
        db.insert(schema.tradeAssessment).values({
          enrollmentId: enr!.id,
          kind: "placement",
          templateVersion: "1.0.0",
          status: "submitted",
        }),
      ).rejects.toThrow();

      // But an exit assessment can coexist
      const [exit] = await db
        .insert(schema.tradeAssessment)
        .values({
          enrollmentId: enr!.id,
          kind: "exit",
          templateVersion: "1.0.0",
          status: "draft",
        })
        .returning();
      expect(exit?.id).toBeDefined();
    });

    it("allows a new live placement assessment when the previous is superseded", async () => {
      const { cohort } = await setupProgramAndCohort();
      const [enr] = await db
        .insert(schema.enrollment)
        .values({ cohortId: cohort.id, organizationId: SME_ORG_1 })
        .returning();

      const [first] = await db
        .insert(schema.tradeAssessment)
        .values({
          enrollmentId: enr!.id,
          kind: "placement",
          templateVersion: "1.0.0",
          status: "scored",
        })
        .returning();

      // Supersede the first assessment
      await db
        .update(schema.tradeAssessment)
        .set({ status: "superseded", supersededAt: new Date() })
        .where(eq(schema.tradeAssessment.id, first!.id));

      // Now inserting a new live placement assessment succeeds
      const [second] = await db
        .insert(schema.tradeAssessment)
        .values({
          enrollmentId: enr!.id,
          kind: "placement",
          templateVersion: "1.0.0",
          status: "draft",
        })
        .returning();

      expect(second?.id).toBeDefined();

      // Link supersession reference
      await db
        .update(schema.tradeAssessment)
        .set({ supersededById: second!.id })
        .where(eq(schema.tradeAssessment.id, first!.id));

      const [loadedFirst] = await db
        .select()
        .from(schema.tradeAssessment)
        .where(eq(schema.tradeAssessment.id, first!.id));
      expect(loadedFirst?.supersededById).toBe(second!.id);
      expect(loadedFirst?.status).toBe("superseded");
    });

    it("enforces unique assessment responses per question", async () => {
      const { cohort } = await setupProgramAndCohort();
      const [enr] = await db
        .insert(schema.enrollment)
        .values({ cohortId: cohort.id, organizationId: SME_ORG_1 })
        .returning();
      const [ass] = await db
        .insert(schema.tradeAssessment)
        .values({
          enrollmentId: enr!.id,
          kind: "placement",
          templateVersion: "1.0.0",
          status: "draft",
        })
        .returning();

      await db.insert(schema.assessmentResponse).values({
        assessmentId: ass!.id,
        questionId: "A1",
        answer: 2,
        documentsAvailable: true,
      });

      // Duplicate question response fails
      await expect(
        db.insert(schema.assessmentResponse).values({
          assessmentId: ass!.id,
          questionId: "A1",
          answer: 3,
        }),
      ).rejects.toThrow();
    });
  });

  describe("capability scores and learning plans", () => {
    it("stores capability scores with null score when coverage is low", async () => {
      const { cohort } = await setupProgramAndCohort();
      const [enr] = await db
        .insert(schema.enrollment)
        .values({ cohortId: cohort.id, organizationId: SME_ORG_1 })
        .returning();
      const [ass] = await db
        .insert(schema.tradeAssessment)
        .values({
          enrollmentId: enr!.id,
          kind: "placement",
          templateVersion: "1.0.0",
          status: "draft",
        })
        .returning();

      const [score] = await db
        .insert(schema.capabilityScore)
        .values({
          assessmentId: ass!.id,
          domain: "D01",
          points: 5,
          maxPoints: 12,
          coverage: "0.5000",
          score: null, // coverage under 80%
          band: "emerging",
          evidenceStatus: "self_reported",
        })
        .returning();

      expect(score?.score).toBeNull();
      expect(score?.coverage).toBe("0.5000");

      // Duplicate domain score for same assessment fails
      await expect(
        db.insert(schema.capabilityScore).values({
          assessmentId: ass!.id,
          domain: "D01",
          points: 6,
          maxPoints: 12,
          coverage: "0.8000",
          score: 50,
          evidenceStatus: "documented",
        }),
      ).rejects.toThrow();
    });

    it("enforces at most one live learning plan per enrolment", async () => {
      const { cohort } = await setupProgramAndCohort();
      const [enr] = await db
        .insert(schema.enrollment)
        .values({ cohortId: cohort.id, organizationId: SME_ORG_1 })
        .returning();

      // First live plan
      const [plan1] = await db
        .insert(schema.learningPlan)
        .values({
          enrollmentId: enr!.id,
          rulesVersion: "1.0.0",
          pathway: "A",
          status: "generated",
          requiresHumanReview: false,
        })
        .returning();
      expect(plan1?.id).toBeDefined();

      // Second live plan fails
      await expect(
        db.insert(schema.learningPlan).values({
          enrollmentId: enr!.id,
          rulesVersion: "1.0.0",
          pathway: "B",
          status: "active",
        }),
      ).rejects.toThrow();

      // Supersede first plan
      await db
        .update(schema.learningPlan)
        .set({ status: "superseded", supersededAt: new Date() })
        .where(eq(schema.learningPlan.id, plan1!.id));

      // Now inserting new live plan succeeds
      const [plan2] = await db
        .insert(schema.learningPlan)
        .values({
          enrollmentId: enr!.id,
          rulesVersion: "1.0.0",
          pathway: "B",
          status: "active",
        })
        .returning();
      expect(plan2?.id).toBeDefined();
    });

    it("enforces unique module assignments per plan and unique module progress per enrolment", async () => {
      const { cohort } = await setupProgramAndCohort();
      const [enr] = await db
        .insert(schema.enrollment)
        .values({ cohortId: cohort.id, organizationId: SME_ORG_1 })
        .returning();
      const [plan] = await db
        .insert(schema.learningPlan)
        .values({
          enrollmentId: enr!.id,
          rulesVersion: "1.0.0",
          pathway: "A",
          status: "generated",
        })
        .returning();

      // Module assignment
      await db.insert(schema.moduleAssignment).values({
        planId: plan!.id,
        moduleId: "M01",
        status: "required",
        sequence: 1,
        reasonCodes: ["REQUIRED_ALL"],
      });
      await expect(
        db.insert(schema.moduleAssignment).values({
          planId: plan!.id,
          moduleId: "M01",
          status: "optional",
          sequence: 2,
        }),
      ).rejects.toThrow();

      // Module progress
      await db.insert(schema.moduleProgress).values({
        enrollmentId: enr!.id,
        moduleId: "M01",
        contentVersion: "1.0.0",
        status: "in_progress",
      });
      await expect(
        db.insert(schema.moduleProgress).values({
          enrollmentId: enr!.id,
          moduleId: "M01",
          contentVersion: "1.0.0",
          status: "passed",
        }),
      ).rejects.toThrow();
    });
  });

  describe("evidence, opportunity and outcome status checks", () => {
    it("validates kind-specific statuses on trade outcome", async () => {
      const { cohort } = await setupProgramAndCohort();
      const [enr] = await db
        .insert(schema.enrollment)
        .values({ cohortId: cohort.id, organizationId: SME_ORG_1 })
        .returning();

      // Valid financing status
      const [fin] = await db
        .insert(schema.tradeOutcome)
        .values({
          organizationId: SME_ORG_1,
          enrollmentId: enr!.id,
          kind: "financing",
          status: "application_prepared",
        })
        .returning();
      expect(fin?.id).toBeDefined();

      // Invalid financing status (export status given to financing outcome)
      await expect(
        db.insert(schema.tradeOutcome).values({
          organizationId: SME_ORG_1,
          enrollmentId: enr!.id,
          kind: "financing",
          status: "shipped", // invalid for financing
        }),
      ).rejects.toThrow();

      // Valid export status
      const [exp] = await db
        .insert(schema.tradeOutcome)
        .values({
          organizationId: SME_ORG_1,
          enrollmentId: enr!.id,
          kind: "export",
          status: "shipped",
        })
        .returning();
      expect(exp?.id).toBeDefined();
    });
  });

  describe("core audit log integration", () => {
    it("writes audit logs with platform = 'trade'", async () => {
      const [entry] = await db
        .insert(schema.auditLog)
        .values({
          organizationId: SME_ORG_1,
          platform: "trade",
          action: "trade.assessment.submitted",
          entityType: "trade_assessment",
          entityId: "test-assessment-id",
          after: { status: "submitted" },
        })
        .returning();

      expect(entry?.platform).toBe("trade");

      const [loaded] = await db
        .select()
        .from(schema.auditLog)
        .where(eq(schema.auditLog.id, entry!.id));
      expect(loaded?.platform).toBe("trade");
      expect(loaded?.action).toBe("trade.assessment.submitted");
    });
  });
});
