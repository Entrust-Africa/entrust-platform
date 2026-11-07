import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
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
  facilitator: TestUser;
  reviewer: TestUser;
  smeOwner: TestUser;
  smeMember: TestUser;
  outsider: TestUser;
  entrustOrgId: string;
  smeOrgId: string;
  enrollmentId: string;
  planId: string;
  evidenceRecordId: string;
};

beforeAll(async () => {
  await cleanup();
  const [admin, facilitator, reviewer, smeOwner, smeMember, outsider] = await Promise.all([
    signUp("tr-plan-admin"),
    signUp("tr-plan-facil"),
    signUp("tr-plan-rev"),
    signUp("tr-plan-owner"),
    signUp("tr-plan-member"),
    signUp("tr-plan-outsider"),
  ]);
  Object.assign(w, { admin, facilitator, reviewer, smeOwner, smeMember, outsider });

  // 1. Entrust org
  w.entrustOrgId = await createOrganization(
    "entrust-staff-plans",
    [
      [admin!, "admin"],
      [facilitator!, "facilitator"],
      [reviewer!, "reviewer"],
    ],
    { smeProfile: false },
  );
  process.env.ENTRUST_ORG_ID = w.entrustOrgId;

  // 2. SME org
  w.smeOrgId = await createOrganization(
    `plan-sme-${randomUUID().slice(0, 8)}`,
    [
      [smeOwner!, "owner"],
      [smeMember!, "member"],
    ],
    { platform: "trade" },
  );

  // 3. Program & Cohort & Enrollment
  const [prog] = await db
    .insert(schema.program)
    .values({
      name: "Plan Testing Program",
      description: "Program for plan review and exemption testing",
    })
    .returning();

  const [cohort] = await db
    .insert(schema.cohort)
    .values({
      programId: prog!.id,
      name: "Plan Cohort 1",
    })
    .returning();

  const [enr] = await db
    .insert(schema.enrollment)
    .values({
      cohortId: cohort!.id,
      organizationId: w.smeOrgId,
      status: "active",
      enrolledAt: new Date(),
    })
    .returning();
  w.enrollmentId = enr!.id;

  // 4. Learning Plan & Initial Module Assignments
  const [plan] = await db
    .insert(schema.learningPlan)
    .values({
      enrollmentId: w.enrollmentId,
      rulesVersion: "1.0.0",
      pathway: "A",
      status: "review_required",
      requiresHumanReview: true,
      reviewReasons: ["provisional_pathway"],
    })
    .returning();
  w.planId = plan!.id;

  await db.insert(schema.moduleAssignment).values([
    {
      planId: w.planId,
      moduleId: "M01",
      status: "required",
      sequence: 1,
      reasonCodes: ["foundation"],
      source: "engine",
    },
    {
      planId: w.planId,
      moduleId: "M02",
      status: "required",
      sequence: 2,
      reasonCodes: ["foundation"],
      source: "engine",
    },
    {
      planId: w.planId,
      moduleId: "M03",
      status: "optional",
      sequence: 3,
      reasonCodes: ["score_threshold"],
      source: "engine",
    },
  ]);

  // 5. Evidence record for exemption backing
  const [evidence] = await db
    .insert(schema.evidenceRecord)
    .values({
      organizationId: w.smeOrgId,
      enrollmentId: w.enrollmentId,
      title: "Previous Export Certificate ISO 9001",
      targetType: "exemption_request",
      targetId: "M02",
      status: "accepted",
      confidence: "verified",
    })
    .returning();
  w.evidenceRecordId = evidence!.id;
});

afterAll(async () => {
  delete process.env.ENTRUST_ORG_ID;
  await cleanup();
});

describe("TRADE: plan review, overrides and exemptions (#60)", () => {
  let createdExemptionId: string;

  it("lists plans with review queue filters", async () => {
    // Staff queries review queue
    const res = await callV1(
      w.facilitator,
      "GET",
      "/trade/plans?requiresHumanReview=true&status=review_required",
    );
    expect(res.status).toBe(200);
    const data = res.body as any;
    expect(data.items.length).toBeGreaterThanOrEqual(1);
    const found = data.items.find((p: any) => p.id === w.planId);
    expect(found).toBeDefined();
    expect(found.requiresHumanReview).toBe(true);
    expect(found.reviewReasons).toContain("provisional_pathway");
    expect(found.modules.length).toBe(3);
  });

  it("blocks outsider from viewing SME plans", async () => {
    const res = await callV1(
      w.outsider,
      "GET",
      `/trade/plans?organizationId=${w.smeOrgId}`,
    );
    expect(res.status).toBe(403);
  });

  it("allows SME owner to view their learning plan", async () => {
    const res = await callV1(w.smeOwner, "GET", `/trade/plans/${w.planId}`);
    expect(res.status).toBe(200);
    const body = res.body as any;
    expect(body.id).toBe(w.planId);
    expect(body.modules.map((m: any) => m.moduleId)).toEqual(["M01", "M02", "M03"]);
  });

  it("blocks outsider from approving a plan", async () => {
    const res = await callV1(w.outsider, "POST", `/trade/plans/${w.planId}/approve`, {
      notes: "Unauthorized attempt",
    });
    expect(res.status).toBe(403);
  });

  it("allows staff to approve a plan and audits the decision", async () => {
    const res = await callV1(w.facilitator, "POST", `/trade/plans/${w.planId}/approve`, {
      notes: "Pathway confirmed after review of SME profile.",
    });
    expect(res.status).toBe(200);
    const body = res.body as any;
    expect(body.status).toBe("approved");
    expect(body.requiresHumanReview).toBe(false);
    expect(body.reviewedByUserId).toBe(w.facilitator.id);
    expect(body.reviewNotes).toBe("Pathway confirmed after review of SME profile.");

    // Check audit log
    const [audit] = await db
      .select()
      .from(schema.auditLog)
      .where(
        and(
          eq(schema.auditLog.entityId, w.planId),
          eq(schema.auditLog.action, "trade.learning_plan.approved"),
        ),
      );
    expect(audit).toBeDefined();
    expect(audit!.platform).toBe("trade");
    expect(audit!.actorUserId).toBe(w.facilitator.id);
  });

  it("blocks plan override without a mandatory reason", async () => {
    const res = await callV1(w.admin, "POST", `/trade/plans/${w.planId}/override`, {
      reason: "   ",
      removals: ["M03"],
    });
    expect(res.status).toBe(400);
  });

  it("allows staff to override a plan by adding and removing modules", async () => {
    const res = await callV1(w.admin, "POST", `/trade/plans/${w.planId}/override`, {
      reason: "Buyer requirement demands M04 Quality Control; M03 optional removed.",
      removals: ["M03"],
      additions: [
        {
          moduleId: "M04",
          status: "required",
          sequence: 4,
        },
      ],
    });
    expect(res.status).toBe(200);
    const body = res.body as any;
    expect(body.status).toBe("approved");
    const moduleIds = body.modules.map((m: any) => m.moduleId);
    expect(moduleIds).toContain("M01");
    expect(moduleIds).toContain("M02");
    expect(moduleIds).toContain("M04");
    expect(moduleIds).not.toContain("M03");

    const added = body.modules.find((m: any) => m.moduleId === "M04");
    expect(added.source).toBe("staff_override");

    // Check audit log
    const [audit] = await db
      .select()
      .from(schema.auditLog)
      .where(
        and(
          eq(schema.auditLog.entityId, w.planId),
          eq(schema.auditLog.action, "trade.learning_plan.overridden"),
        ),
      );
    expect(audit).toBeDefined();
    expect(audit!.reason).toBe(
      "Buyer requirement demands M04 Quality Control; M03 optional removed.",
    );
  });

  it("fails exemption creation if evidence record does not exist", async () => {
    const res = await callV1(w.smeOwner, "POST", "/trade/exemptions", {
      enrollmentId: w.enrollmentId,
      moduleId: "M02",
      evidenceRecordId: randomUUID(),
      reason: "Already certified",
    });
    expect(res.status).toBe(404);
  });

  it("allows SME owner to submit evidence-backed module exemption request", async () => {
    const res = await callV1(w.smeOwner, "POST", "/trade/exemptions", {
      enrollmentId: w.enrollmentId,
      moduleId: "M02",
      evidenceRecordId: w.evidenceRecordId,
      reason: "Holder of valid international export compliance certificate.",
    });
    expect(res.status).toBe(201);
    const body = res.body as any;
    expect(body.id).toBeDefined();
    expect(body.enrollmentId).toBe(w.enrollmentId);
    expect(body.moduleId).toBe("M02");
    expect(body.evidenceRecordId).toBe(w.evidenceRecordId);
    expect(body.status).toBe("pending");
    expect(body.reason).toBe("Holder of valid international export compliance certificate.");

    createdExemptionId = body.id;

    // Verify audit log
    const [audit] = await db
      .select()
      .from(schema.auditLog)
      .where(
        and(
          eq(schema.auditLog.entityId, createdExemptionId),
          eq(schema.auditLog.action, "trade.module_exemption.requested"),
        ),
      );
    expect(audit).toBeDefined();
    expect(audit!.platform).toBe("trade");
  });

  it("blocks outsider from reviewing exemption request", async () => {
    const res = await callV1(
      w.outsider,
      "POST",
      `/trade/exemptions/${createdExemptionId}/review`,
      { status: "approved" },
    );
    expect(res.status).toBe(403);
  });

  it("rejecting exemption without comment fails validation", async () => {
    const res = await callV1(
      w.reviewer,
      "POST",
      `/trade/exemptions/${createdExemptionId}/review`,
      { status: "rejected" },
    );
    expect(res.status).toBe(422);
  });

  it("staff approving exemption marks module progress as exempted and logs audit", async () => {
    const res = await callV1(
      w.facilitator,
      "POST",
      `/trade/exemptions/${createdExemptionId}/review`,
      {
        status: "approved",
        comment: "Certificate verified with issuing body.",
      },
    );
    expect(res.status).toBe(200);
    const body = res.body as any;
    expect(body.status).toBe("approved");
    expect(body.reviewedByUserId).toBe(w.facilitator.id);
    expect(body.reviewComment).toBe("Certificate verified with issuing body.");

    // Verify module progress was marked as exempted!
    const [progress] = await db
      .select()
      .from(schema.moduleProgress)
      .where(
        and(
          eq(schema.moduleProgress.enrollmentId, w.enrollmentId),
          eq(schema.moduleProgress.moduleId, "M02"),
        ),
      );
    expect(progress).toBeDefined();
    expect(progress!.status).toBe("exempted");

    // Verify audit log
    const [audit] = await db
      .select()
      .from(schema.auditLog)
      .where(
        and(
          eq(schema.auditLog.entityId, createdExemptionId),
          eq(schema.auditLog.action, "trade.module_exemption.reviewed"),
        ),
      );
    expect(audit).toBeDefined();
    expect(audit!.reason).toBe("Certificate verified with issuing body.");
  });
});
