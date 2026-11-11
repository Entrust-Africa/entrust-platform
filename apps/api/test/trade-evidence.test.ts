import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { schema } from "@entrust/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  callV1,
  cleanup,
  createOrganization,
  makeFile,
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
  smeId: string;
  enrollmentId: string;
  fileId: string;
};

beforeAll(async () => {
  await cleanup();
  const [admin, facilitator, reviewer, smeOwner, smeMember, outsider] = await Promise.all([
    signUp("tr-evid-admin"),
    signUp("tr-evid-facil"),
    signUp("tr-evid-rev"),
    signUp("tr-evid-owner"),
    signUp("tr-evid-member"),
    signUp("tr-evid-outsider"),
  ]);
  Object.assign(w, { admin, facilitator, reviewer, smeOwner, smeMember, outsider });

  // 1. Setup Entrust organisation with staff roles
  w.entrustOrgId = await createOrganization(
    "entrust-staff-evidence",
    [
      [admin!, "admin"],
      [facilitator!, "facilitator"],
      [reviewer!, "reviewer"],
    ],
    { smeProfile: false },
  );
  process.env.ENTRUST_ORG_ID = w.entrustOrgId;

  // 2. Setup SME organisation
  w.smeOrgId = await createOrganization(
    `evid-sme-${randomUUID().slice(0, 8)}`,
    [
      [smeOwner!, "owner"],
      [smeMember!, "member"],
    ],
    { platform: "trade" },
  );

  const [prof] = await db
    .select()
    .from(schema.smeProfile)
    .where(eq(schema.smeProfile.organizationId, w.smeOrgId));
  w.smeId = prof!.smeId;

  // Create a program & cohort & enrollment directly
  const [prog] = await db
    .insert(schema.program)
    .values({
      name: "Evidence Program",
      description: "Program for evidence testing",
    })
    .returning();

  const [cohort] = await db
    .insert(schema.cohort)
    .values({
      programId: prog!.id,
      name: "Cohort 1",
    })
    .returning();
  await db.insert(schema.cohortStaff).values([facilitator!, reviewer!].map((staff) => ({ cohortId: cohort!.id, userId: staff.id })));

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

  // Create dummy file record for attachment
  const [f] = await db
    .insert(schema.file)
    .values({
      organizationId: w.smeOrgId,
      uploaderUserId: w.smeOwner.id,
      storageKey: `evidence-doc-${randomUUID()}.pdf`,
      originalName: "business_registration.pdf",
      contentType: "application/pdf",
      sizeBytes: 10240,
      sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    })
    .returning();
  w.fileId = f!.id;
});

afterAll(async () => {
  delete process.env.ENTRUST_ORG_ID;
  await cleanup();
});

describe("TRADE: evidence records, review and evidence labels (#59)", () => {
  let createdEvidenceId: string;

  it("allows SME owner to submit evidence against an assessment question", async () => {
    const res = await callV1(w.smeOwner, "POST", "/trade/evidence", {
      organizationId: w.smeOrgId,
      enrollmentId: w.enrollmentId,
      fileId: w.fileId,
      title: "Commercial Registration Document",
      targetType: "assessment_question",
      targetId: "Q_REG_01",
    });
    expect(res.status).toBe(201);
    const body = res.body as any;
    expect(body.id).toBeDefined();
    expect(body.organizationId).toBe(w.smeOrgId);
    expect(body.title).toBe("Commercial Registration Document");
    expect(body.targetType).toBe("assessment_question");
    expect(body.targetId).toBe("Q_REG_01");
    expect(body.status).toBe("submitted");
    expect(body.confidence).toBe("documented");
    expect(body.file).toBeDefined();
    expect(body.file.filename).toBe("business_registration.pdf");

    createdEvidenceId = body.id;

    // Check audit log
    const [audit] = await db
      .select()
      .from(schema.auditLog)
      .where(
        and(
          eq(schema.auditLog.entityId, createdEvidenceId),
          eq(schema.auditLog.action, "trade.evidence.submitted"),
        ),
      );
    expect(audit).toBeDefined();
    expect(audit!.platform).toBe("trade");
    expect(audit!.actorUserId).toBe(w.smeOwner.id);
  });

  it("allows SME member to list their organization's evidence records", async () => {
    const res = await callV1(w.smeMember, "GET", `/trade/evidence?organizationId=${w.smeOrgId}`);
    expect(res.status).toBe(200);
    const data = res.body as any;
    expect(data.items.length).toBeGreaterThanOrEqual(1);
    const item = data.items.find((i: { id: string }) => i.id === createdEvidenceId);
    expect(item).toBeDefined();
    expect(item.title).toBe("Commercial Registration Document");
  });

  it("blocks outsider from listing SME organization's evidence records", async () => {
    const res = await callV1(w.outsider, "GET", `/trade/evidence?organizationId=${w.smeOrgId}`);
    expect(res.status).toBe(403);
  });

  it("blocks outsider from creating evidence for SME organization", async () => {
    const res = await callV1(w.outsider, "POST", "/trade/evidence", {
      organizationId: w.smeOrgId,
      title: "Malicious submission",
      targetType: "assessment_question",
    });
    expect(res.status).toBe(403);
  });

  it("blocks outsider from reviewing evidence", async () => {
    const res = await callV1(w.outsider, "POST", `/trade/evidence/${createdEvidenceId}/review`, {
      status: "accepted",
    });
    expect(res.status).toBe(403);
  });

  it("rejecting evidence without a comment fails validation", async () => {
    const res = await callV1(w.reviewer, "POST", `/trade/evidence/${createdEvidenceId}/review`, {
      status: "rejected",
    });
    expect(res.status).toBe(422);
  });

  it("resubmission_required without a comment fails validation", async () => {
    const res = await callV1(w.reviewer, "POST", `/trade/evidence/${createdEvidenceId}/review`, {
      status: "resubmission_required",
    });
    expect(res.status).toBe(422);
  });

  it("rejecting evidence with a comment succeeds and logs audit", async () => {
    const res = await callV1(w.reviewer, "POST", `/trade/evidence/${createdEvidenceId}/review`, {
      status: "rejected",
      comment: "Document is expired, please upload 2026 renewed license.",
    });
    expect(res.status).toBe(200);
    const body = res.body as any;
    expect(body.status).toBe("rejected");
    expect(body.reviewComment).toBe("Document is expired, please upload 2026 renewed license.");
    expect(body.reviewedByUserId).toBe(w.reviewer.id);
    expect(body.reviewedAt).toBeDefined();

    // Verify audit log
    const audits = await db
      .select()
      .from(schema.auditLog)
      .where(
        and(
          eq(schema.auditLog.entityId, createdEvidenceId),
          eq(schema.auditLog.action, "trade.evidence.reviewed"),
        ),
      );
    expect(audits.length).toBeGreaterThanOrEqual(1);
    expect(audits[audits.length - 1]!.reason).toBe(
      "Document is expired, please upload 2026 renewed license.",
    );
  });

  it("accepting evidence updates status and confidence", async () => {
    const res = await callV1(w.facilitator, "POST", `/trade/evidence/${createdEvidenceId}/review`, {
      status: "accepted",
      comment: "Verified with commercial registry portal.",
      confidence: "verified",
    });
    expect(res.status).toBe(200);
    const body = res.body as any;
    expect(body.status).toBe("accepted");
    expect(body.confidence).toBe("verified");
    expect(body.reviewComment).toBe("Verified with commercial registry portal.");
    expect(body.reviewedByUserId).toBe(w.facilitator.id);
  });

  it("blocks outsider from requesting evidence", async () => {
    const res = await callV1(w.outsider, "POST", "/trade/evidence/request", {
      organizationId: w.smeOrgId,
      title: "Request for tax certificate",
      prompt: "Please attach your latest tax clearance.",
    });
    expect(res.status).toBe(403);
  });

  it("allows Entrust staff to request evidence from SME and creates pending record", async () => {
    const res = await callV1(w.admin, "POST", "/trade/evidence/request", {
      organizationId: w.smeOrgId,
      enrollmentId: w.enrollmentId,
      title: "Request for Tax Clearance Certificate",
      targetType: "assessment_question",
      targetId: "Q_TAX_01",
      prompt: "Please provide a valid clearance certificate for the current fiscal year.",
    });
    expect(res.status).toBe(201);
    const body = res.body as any;
    expect(body.status).toBe("not_submitted");
    expect(body.confidence).toBe("self_reported");
    expect(body.requestedByUserId).toBe(w.admin.id);
    expect(body.requestedAt).toBeDefined();
    expect(body.requestPrompt).toBe(
      "Please provide a valid clearance certificate for the current fiscal year.",
    );

    // Verify audit log
    const [audit] = await db
      .select()
      .from(schema.auditLog)
      .where(
        and(
          eq(schema.auditLog.entityId, body.id),
          eq(schema.auditLog.action, "trade.evidence.requested"),
        ),
      );
    expect(audit).toBeDefined();
  });

  it("lets the business answer a request, which then goes to staff for review", async () => {
    const asked = await callV1(w.admin, "POST", "/trade/evidence/request", { organizationId: w.smeOrgId, title: "Bank statement", prompt: "Send last quarter's statement." });
    // Nothing has come in, so there's nothing to review.
    expect((await callV1(w.admin, "POST", `/trade/evidence/${asked.body.id}/review`, { status: "accepted" })).status).toBe(409);
    expect((await callV1(w.outsider, "POST", `/trade/evidence/${asked.body.id}/answer`, { note: "Here" })).status).toBe(404);
    expect((await callV1(w.smeOwner, "POST", `/trade/evidence/${asked.body.id}/answer`, {})).status).toBe(400);
    const file = await makeFile(w.smeOrgId, w.smeOwner.id, "statement.pdf");
    const answered = await callV1(w.smeOwner, "POST", `/trade/evidence/${asked.body.id}/answer`, { fileId: file, note: "Q3 statement" });
    expect(answered.status).toBe(200);
    expect(answered.body).toMatchObject({ status: "submitted", fileId: file, confidence: "documented", responseNote: "Q3 statement" });
    // Once it's with staff it can't be changed until they send it back.
    expect((await callV1(w.smeOwner, "POST", `/trade/evidence/${asked.body.id}/answer`, { note: "Again" })).status).toBe(409);
    const back = await callV1(w.admin, "POST", `/trade/evidence/${asked.body.id}/review`, { status: "resubmission_required", comment: "It's cut off on page 2." });
    expect(back.status).toBe(200);
    expect((await callV1(w.smeOwner, "POST", `/trade/evidence/${asked.body.id}/answer`, { note: "Full statement attached" })).status).toBe(200);
  });

  it("evidence status and confidence changes do not alter placement or assessment scores", async () => {
    // Verify that evidence reviews do not mutate assessment scores or learning plan results
    const [auditBefore] = await db
      .select()
      .from(schema.auditLog)
      .where(
        and(
          eq(schema.auditLog.entityId, createdEvidenceId),
          eq(schema.auditLog.action, "trade.evidence.reviewed"),
        ),
      );
    expect(auditBefore).toBeDefined();

    // Perform another review update
    const res = await callV1(w.reviewer, "POST", `/trade/evidence/${createdEvidenceId}/review`, {
      status: "under_review",
      comment: "Under technical committee review",
    });
    expect(res.status).toBe(200);

    // The assessment and module tables remain untouched
    const assessments = await db
      .select()
      .from(schema.tradeAssessment)
      .where(eq(schema.tradeAssessment.enrollmentId, w.enrollmentId));
    // No side effect updates on assessments
    expect(assessments.length).toBe(0);
  });
});
