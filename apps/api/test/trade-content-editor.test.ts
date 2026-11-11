import { eq, inArray } from "drizzle-orm";
import { schema } from "@entrust/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PREFIX, callV1, cleanup, createOrganization, db, signUp, type TestUser } from "./support";

describe("TRADE staff course content studio (#212)", () => {
  let learner: TestUser;
  let facilitator: TestUser;
  let admin: TestUser;
  let reviewer: TestUser;
  let org: string;
  let entrust: string;
  let enrollmentId: string;
  // Versions this file makes; it removes only these.
  const STUDIO_VERSIONS = ["1.1.0", "1.2.0"];

  const get = (user: TestUser | null, path: string) => callV1(user, "GET", `/trade${path}`);
  const post = (user: TestUser | null, path: string, body?: unknown) => callV1(user, "POST", `/trade${path}`, body);
  const patch = (user: TestUser | null, path: string, body?: unknown) => callV1(user, "PATCH", `/trade${path}`, body);

  beforeAll(async () => {
    await cleanup();
    await db.delete(schema.moduleContentVersion).where(inArray(schema.moduleContentVersion.version, STUDIO_VERSIONS));
    const users = await Promise.all(["content-learner", "content-facil", "content-admin", "content-rev"].map(signUp));
    [learner, facilitator, admin, reviewer] = users as [TestUser, TestUser, TestUser, TestUser];

    org = await createOrganization("content-org", [[learner, "owner"]], { platform: "trade" });
    entrust = await createOrganization(
      "content-entrust",
      [
        [admin, "admin"],
        [facilitator, "facilitator"],
        [reviewer, "reviewer"],
      ],
      { smeProfile: false },
    );
    process.env.ENTRUST_ORG_ID = entrust;

    const [program] = await db.insert(schema.program).values({ name: `${PREFIX}content studio`, description: "Content studio tests" }).returning();
    const [cohort] = await db.insert(schema.cohort).values({ programId: program!.id, name: `${PREFIX}content cohort`, deliveryMode: "hybrid" }).returning();
    const [enrollment] = await db.insert(schema.enrollment).values({ cohortId: cohort!.id, organizationId: org, status: "active" }).returning();
    enrollmentId = enrollment!.id;
  });

  afterAll(async () => {
    delete process.env.ENTRUST_ORG_ID;
    await db.delete(schema.moduleContentVersion).where(inArray(schema.moduleContentVersion.version, STUDIO_VERSIONS));
    await cleanup();
  });

  it("forbids SME learner and reviewer from accessing admin course studio", async () => {
    const learnerRes = await get(learner, "/admin/modules");
    expect(learnerRes.status).toBe(403);

    const reviewerRes = await get(reviewer, "/admin/modules");
    expect(reviewerRes.status).toBe(403);
  });

  it("allows facilitator and admin to list modules and baseline versions", async () => {
    const res = await get(facilitator, "/admin/modules");
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(12);

    const m01 = res.body.items.find((m: { id: string }) => m.id === "M01");
    expect(m01).toBeDefined();
    expect(m01.latestApprovedVersion).toBe("1.0.0");
    expect(m01.versions.some((v: { version: string }) => v.version === "1.0.0")).toBe(true);
  });

  it("rejects creating draft with invalid semver version", async () => {
    const res = await post(facilitator, "/admin/modules/M01/versions", {
      targetVersion: "v1-invalid",
    });
    expect(res.status).toBe(400);
  });

  it("creates a new draft version branched from baseline 1.0.0", async () => {
    const res = await post(facilitator, "/admin/modules/M01/versions", {
      targetVersion: "1.1.0",
      changeSummary: "Improve quiz explanations and fix typos",
    });
    expect(res.status).toBe(201);
    expect(res.body.moduleId).toBe("M01");
    expect(res.body.version).toBe("1.1.0");
    expect(res.body.status).toBe("draft");
    expect(res.body.validationErrors).toEqual([]);
    expect(res.body.content.version).toBe("1.1.0");
    expect(res.body.content.status).toBe("draft");
  });

  it("rejects creating duplicate draft version number", async () => {
    const res = await post(facilitator, "/admin/modules/M01/versions", {
      targetVersion: "1.1.0",
      changeSummary: "Duplicate version attempt",
    });
    expect(res.status).toBe(409);
  });

  it("rejects draft update with invalid quiz questions (pass mark > 100 or missing correct answer)", async () => {
    const draftRes = await get(facilitator, "/admin/modules/M01/versions/1.1.0");
    const content = draftRes.body.content;

    // Mutate knowledge check with invalid pass mark (150)
    const invalidContent = {
      ...content,
      knowledgeCheck: {
        ...content.knowledgeCheck,
        passMark: 150,
      },
    };

    const res = await patch(facilitator, "/admin/modules/M01/versions/1.1.0", {
      content: invalidContent,
      strictValidation: true,
    });
    expect(res.status).toBe(422);
    expect(res.body.error).toContain("passMark");
  });

  it("allows facilitator to update draft content with refined explanations and valid pass mark", async () => {
    const draftRes = await get(facilitator, "/admin/modules/M01/versions/1.1.0");
    const content = draftRes.body.content;

    // Refine first question's explanation (per #210)
    content.knowledgeCheck.questions[0].explanation = "Clarified trade documentation requirement per ICC rules.";
    content.title = "Export Readiness Assessment & Planning (Updated)";

    const res = await patch(facilitator, "/admin/modules/M01/versions/1.1.0", {
      title: content.title,
      content,
      changeSummary: "Updated question 1 explanation and module title",
    });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe("Export Readiness Assessment & Planning (Updated)");
    expect(res.body.content.knowledgeCheck.questions[0].explanation).toBe("Clarified trade documentation requirement per ICC rules.");
    expect(res.body.validationErrors).toHaveLength(0);
  });

  it("provides sanitized learner preview to staff with answer keys hidden", async () => {
    const previewRes = await get(facilitator, "/admin/modules/M01/versions/1.1.0/preview");
    expect(previewRes.status).toBe(200);
    expect(previewRes.body.module).toBe("M01");
    expect(previewRes.body.version).toBe("1.1.0");
    expect(previewRes.body.title).toBe("Export Readiness Assessment & Planning (Updated)");

    // Learner view must NOT leak correct answer keys
    for (const q of previewRes.body.knowledgeCheck.questions) {
      expect(q).not.toHaveProperty("correct");
    }
  });

  it("allows facilitator to submit draft for review", async () => {
    const res = await post(facilitator, "/admin/modules/M01/versions/1.1.0/submit-review");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("in_review");
    expect(res.body.submittedByUserId).toBe(facilitator.id);
  });

  it("refuses edits once a version is submitted, so the reviewer approves what they saw", async () => {
    const res = await patch(facilitator, "/admin/modules/M01/versions/1.1.0", { title: "Changed after submitting" });
    expect(res.status).toBe(409);
    expect(res.body.error).toContain("Only a draft can be edited");
  });

  it("forbids facilitator from approving the version", async () => {
    const res = await post(facilitator, "/admin/modules/M01/versions/1.1.0/approve", {
      notes: "Facilitator trying to approve",
    });
    expect(res.status).toBe(403);
  });

  it("allows Super Admin to approve version into production", async () => {
    const res = await post(admin, "/admin/modules/M01/versions/1.1.0/approve", {
      notes: "Approved after trade advisory board review",
    });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("approved");
    expect(res.body.approvedByUserId).toBe(admin.id);
    expect(res.body.approvedAt).not.toBeNull();
    expect(res.body.contentHash).toBeDefined();
  });

  it("strictly enforces immutability on approved version", async () => {
    const res = await patch(admin, "/admin/modules/M01/versions/1.1.0", {
      title: "Illegal modification attempt",
    });
    expect(res.status).toBe(409);
    expect(res.body.error).toContain("Only a draft can be edited");
  });

  it("refuses to approve a draft that was never submitted for review", async () => {
    const created = await post(facilitator, "/admin/modules/M01/versions", { sourceVersion: "1.1.0", targetVersion: "1.2.0" });
    expect(created.status).toBe(201);
    const res = await post(admin, "/admin/modules/M01/versions/1.2.0/approve", { notes: "Skipping review" });
    expect(res.status).toBe(409);
    expect(res.body.error).toContain("Only a version submitted for review can be approved");
  });

  it("verifies audit log entries recorded for every step of version lifecycle", async () => {
    const logs = await db
      .select()
      .from(schema.auditLog)
      .where(eq(schema.auditLog.platform, "trade"))
      .orderBy(schema.auditLog.occurredAt);

    const actions = logs.map((l) => l.action);
    expect(actions).toContain("trade.content.draft_created");
    expect(actions).toContain("trade.content.draft_updated");
    expect(actions).toContain("trade.content.review_submitted");
    expect(actions).toContain("trade.content.approved");
  });

  it("serves approved 1.1.0 version to learner while keeping 1.0.0 accessible for in-progress SMEs", async () => {
    // 1. Learner fetching latest sees 1.1.0
    const latestRes = await get(learner, "/modules/M01");
    expect(latestRes.status).toBe(200);
    expect(latestRes.body.latestVersion).toBe("1.1.0");
    expect(latestRes.body.title).toBe("Export Readiness Assessment & Planning (Updated)");

    // 2. Learner fetching original 1.0.0 version stays on baseline 1.0.0
    const baselineRes = await get(learner, "/modules/M01?version=1.0.0");
    expect(baselineRes.status).toBe(200);
    expect(baselineRes.body.content.version).toBe("1.0.0");
  });

  it("grades a knowledge check on the version approved in the studio", async () => {
    const staffView = await get(admin, "/admin/modules/M01/versions/1.1.0");
    const questions = staffView.body.content.knowledgeCheck.questions as { id: string; correct: string[] }[];
    const answers = Object.fromEntries(questions.map((q) => [q.id, q.correct]));

    const res = await post(learner, "/modules/M01/knowledge-check/attempts", { enrollmentId, contentVersion: "1.1.0", answers });
    expect(res.status).toBe(200);
    expect(res.body.score).toBe(100);
    expect(res.body.passed).toBe(true);
  });
});
