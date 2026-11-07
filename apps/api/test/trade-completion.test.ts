import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { schema } from "@entrust/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  callV1,
  cleanup,
  createOrganization,
  db,
  signUp,
  type TestUser,
} from "./support";

const w = {} as {
  admin: TestUser;
  smeLearner: TestUser;
  outsider: TestUser;
  entrustOrgId: string;
  smeOrgId: string;
  programId: string;
  cohortId: string;
  enrollmentId: string;
  planId: string;
};

beforeAll(async () => {
  await cleanup();
  const [admin, smeLearner, outsider] = await Promise.all([
    signUp("tr-comp-admin"),
    signUp("tr-comp-learner"),
    signUp("tr-comp-outsider"),
  ]);
  Object.assign(w, { admin, smeLearner, outsider });

  // 1. Entrust org with admin
  w.entrustOrgId = await createOrganization(
    "entrust-staff-completion",
    [[admin!, "admin"]],
    { smeProfile: false },
  );
  process.env.ENTRUST_ORG_ID = w.entrustOrgId;

  // 2. SME org
  w.smeOrgId = await createOrganization(
    `comp-sme-${randomUUID().slice(0, 8)}`,
    [[smeLearner!, "owner"]],
    { platform: "trade" },
  );

  // 3. Program & Cohort
  const [prog] = await db
    .insert(schema.program)
    .values({
      name: "TRADE Export Acceleration",
      description: "TRADE program for export readiness",
    })
    .returning();
  w.programId = prog!.id;

  const [cohort] = await db
    .insert(schema.cohort)
    .values({
      programId: w.programId,
      name: "Cohort 2026 Alpha",
      country: "ET",
      language: "en",
    })
    .returning();
  w.cohortId = cohort!.id;

  // 4. Enrollment
  const [enrollment] = await db
    .insert(schema.enrollment)
    .values({
      cohortId: w.cohortId,
      organizationId: w.smeOrgId,
      status: "active",
    })
    .returning();
  w.enrollmentId = enrollment!.id;

  // 5. Pathway assignment
  await db.insert(schema.pathwayAssignment).values({
    enrollmentId: w.enrollmentId,
    pathway: "A",
    status: "confirmed",
    liveOrder: false,
    rulesVersion: "0.1.0",
    reasonCodes: ["PATHWAY_DEFAULT"],
  });

  // 6. Placement assessment (scored with baseline)
  const [placement] = await db
    .insert(schema.tradeAssessment)
    .values({
      enrollmentId: w.enrollmentId,
      kind: "placement",
      templateVersion: "0.1.0",
      status: "scored",
    })
    .returning();

  // Baseline capability scores
  await db.insert(schema.capabilityScore).values([
    {
      assessmentId: placement!.id,
      kind: "domain",
      domain: "buyer_development",
      points: 6,
      maxPoints: 15,
      coverage: "1.0000",
      score: "40.00",
      band: "developing",
      evidenceStatus: "self_reported",
    },
    {
      assessmentId: placement!.id,
      kind: "domain",
      domain: "financial_records",
      points: 7,
      maxPoints: 18,
      coverage: "1.0000",
      score: "38.89",
      band: "developing",
      evidenceStatus: "self_reported",
    },
  ]);

  // 7. Active Learning Plan assigning M01 and M03
  const [plan] = await db
    .insert(schema.learningPlan)
    .values({
      enrollmentId: w.enrollmentId,
      assessmentId: placement!.id,
      rulesVersion: "0.1.0",
      pathway: "A",
      status: "active",
      acknowledgedAt: new Date(),
    })
    .returning();
  w.planId = plan!.id;

  await db.insert(schema.moduleAssignment).values([
    {
      planId: w.planId,
      moduleId: "M01",
      status: "required",
      sequence: 1,
      reasonCodes: ["CORE_ORIENTATION"],
      source: "engine",
    },
    {
      planId: w.planId,
      moduleId: "M03",
      status: "required",
      sequence: 2,
      reasonCodes: ["GAP_FINANCIAL"],
      source: "engine",
    },
  ]);
});

afterAll(async () => {
  await cleanup();
});

describe("TRADE Module & Program Completion and Certification (#71)", () => {
  it("fails manual override if caller is not an Entrust admin", async () => {
    const res = await callV1(w.smeLearner, "POST", "/trade/admin/override-module-completion", {
      enrollmentId: w.enrollmentId,
      moduleId: "M01",
      reason: "Unauthorized manual completion attempt",
    });
    expect(res.status).toBe(403);
  });

  it("allows Entrust admin to override module completion with an audited reason", async () => {
    const res = await callV1(w.admin, "POST", "/trade/admin/override-module-completion", {
      enrollmentId: w.enrollmentId,
      moduleId: "M01",
      reason: "Prior demonstrated RPL equivalent accredited by chamber",
    });
    expect(res.status).toBe(200);

    // Verify module progress is passed
    const [prog] = await db
      .select()
      .from(schema.moduleProgress)
      .where(
        and(
          eq(schema.moduleProgress.enrollmentId, w.enrollmentId),
          eq(schema.moduleProgress.moduleId, "M01")
        )
      );
    expect(prog?.status).toBe("passed");
    expect(prog?.adminOverrideReason).toBe("Prior demonstrated RPL equivalent accredited by chamber");

    // Verify audit log
    const [log] = await db
      .select()
      .from(schema.auditLog)
      .where(
        and(
          eq(schema.auditLog.organizationId, w.smeOrgId),
          eq(schema.auditLog.action, "trade.module.admin_override")
        )
      )
      .orderBy(desc(schema.auditLog.occurredAt))
      .limit(1);
    expect(log).toBeDefined();
    expect(log?.actorUserId).toBe(w.admin.id);
  });

  it("completes the program and auto-issues certificate when last assigned module is complete", async () => {
    // Before completing M03, certificate should not exist
    const preCheck = await callV1(w.smeLearner, "GET", `/trade/enrollments/${w.enrollmentId}/certificate`);
    expect(preCheck.status).toBe(404);

    // Admin overrides second module M03
    const res = await callV1(w.admin, "POST", "/trade/admin/override-module-completion", {
      enrollmentId: w.enrollmentId,
      moduleId: "M03",
      reason: "Completed in partner business accelerator program",
    });
    expect(res.status).toBe(200);

    // Verify enrollment and learning plan are completed
    const [enr] = await db
      .select()
      .from(schema.enrollment)
      .where(eq(schema.enrollment.id, w.enrollmentId));
    expect(enr?.status).toBe("completed");
    expect(enr?.completedAt).not.toBeNull();

    const [plan] = await db
      .select()
      .from(schema.learningPlan)
      .where(eq(schema.learningPlan.id, w.planId));
    expect(plan?.status).toBe("completed");

    // Learner can now retrieve certificate
    const certRes = await callV1(w.smeLearner, "GET", `/trade/enrollments/${w.enrollmentId}/certificate`);
    expect(certRes.status).toBe(200);
    const cert = certRes.body as any;
    expect(cert.code).toMatch(/^TRADE-2026-[2-9A-Z]{4}-[2-9A-Z]{4}$/);
    expect(cert.isValid).toBe(true);
    expect(cert.isRevoked).toBe(false);
    expect(cert.programName).toBe("TRADE Export Acceleration");
    expect(cert.cohortName).toBe("Cohort 2026 Alpha");

    // Store certificate code for subsequent tests
    (w as any).certCode = cert.code;
    (w as any).certId = cert.id;
  });

  it("allows public certificate verification without authentication", async () => {
    const certCode = (w as any).certCode;
    const res = await callV1(null, "GET", `/trade/certificates/${certCode}/public`);
    expect(res.status).toBe(200);
    const cert = res.body as any;
    expect(cert.code).toBe(certCode);
    expect(cert.isValid).toBe(true);
    expect(cert.isRevoked).toBe(false);
    expect(cert.programName).toBe("TRADE Export Acceleration");
  });

  it("returns 404 for non-existent public certificate code", async () => {
    const res = await callV1(null, "GET", "/trade/certificates/TRADE-2026-XXXX-YYYY/public");
    expect(res.status).toBe(404);
  });

  it("allows Entrust admin to revoke a certificate with a reason and shows revoked on public verification", async () => {
    const certId = (w as any).certId;
    const certCode = (w as any).certCode;

    // Non-admin cannot revoke
    const forbidRes = await callV1(w.smeLearner, "POST", `/trade/certificates/${certId}/revoke`, {
      reason: "Fraudulent RPL submission detected",
    });
    expect(forbidRes.status).toBe(403);

    // Admin revokes
    const revokeRes = await callV1(w.admin, "POST", `/trade/certificates/${certId}/revoke`, {
      reason: "Fraudulent RPL submission detected upon audit",
    });
    expect(revokeRes.status).toBe(200);
    const revokedData = revokeRes.body as any;
    expect(revokedData.isValid).toBe(false);
    expect(revokedData.isRevoked).toBe(true);
    expect(revokedData.revocationReason).toBe("Fraudulent RPL submission detected upon audit");

    // Public verification page now shows certificate as revoked
    const publicRes = await callV1(null, "GET", `/trade/certificates/${certCode}/public`);
    expect(publicRes.status).toBe(200);
    const pubCert = publicRes.body as any;
    expect(pubCert.isValid).toBe(false);
    expect(pubCert.isRevoked).toBe(true);
    expect(pubCert.revocationReason).toBe("Fraudulent RPL submission detected upon audit");
    expect(pubCert.revokedAt).not.toBeNull();
  });

  it("handles exit assessment submission and generates comparative capability report without altering plan", async () => {
    // 1. Start exit assessment
    const startRes = await callV1(w.smeLearner, "POST", "/trade/assessments", {
      kind: "exit",
      enrollmentId: w.enrollmentId,
    });
    expect(startRes.status).toBe(201);
    const exitAss = startRes.body as any;
    expect(exitAss.kind).toBe("exit");
    expect(exitAss.status).toBe("draft");

    // 2. Answer exit assessment capability questions (sections B-G)
    // Give higher answers than placement baseline to show capability improvement
    const answers: Record<string, string> = {
      B1: "3",
      B2: "3",
      B3: "3",
      B4: "3",
      B5: "3",
      C1: "3",
      C2: "3",
      C3: "3",
      C4: "3",
      C5: "3",
      C6: "3",
      C7: "submitted",
      D1: "2",
      D2: "2",
      D3: "2",
      D4: "2",
      D5: "2",
      E1: "2",
      E2: "2",
      E3: "2",
      E4: "2",
      E5: "2",
      E6: "2",
      F1: "3",
      F2: "3",
      F3: "3",
      F4: "3",
      F5: "3",
      G1: "2",
      G2: "2",
      G3: "2",
      G4: "2",
    };

    const saveRes = await callV1(w.smeLearner, "PUT", `/trade/assessments/${exitAss.id}/responses`, {
      answers,
    });
    expect(saveRes.status).toBe(200);

    // 3. Submit exit assessment
    const submitRes = await callV1(w.smeLearner, "POST", `/trade/assessments/${exitAss.id}/submit`);
    if (submitRes.status !== 200) {
      console.log("Submit exit assessment error:", JSON.stringify(submitRes.body));
    }
    expect(submitRes.status).toBe(200);
    const submitted = submitRes.body as any;
    expect(submitted.status).toBe("scored");

    // Verify learning plan was NOT altered or superseded!
    const [currentPlan] = await db
      .select()
      .from(schema.learningPlan)
      .where(eq(schema.learningPlan.id, w.planId));
    expect(currentPlan?.status).toBe("completed");
    expect(currentPlan?.supersededById).toBeNull();

    // 4. Retrieve comparative capability exit report
    const reportRes = await callV1(w.smeLearner, "GET", `/trade/enrollments/${w.enrollmentId}/exit-report`);
    expect(reportRes.status).toBe(200);
    const report = reportRes.body as any;
    expect(report.placementAssessmentId).toBeDefined();
    expect(report.exitAssessmentId).toBe(exitAss.id);
    expect(report.comparisons.length).toBeGreaterThan(0);

    const buyerComp = report.comparisons.find((c: any) => c.domainId === "buyer_development");
    expect(buyerComp).toBeDefined();
    expect(buyerComp.placementScore).toBe(40);
    expect(buyerComp.exitScore).toBe(100);
    expect(buyerComp.deltaScore).toBe(60);
  });
});
