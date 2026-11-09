import { and, desc, eq, like } from "drizzle-orm";
import { schema } from "@entrust/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PREFIX, callV1, cleanup, createOrganization, db, signUp, type TestUser } from "./support";

// A business's own claims stay labelled as its own, its records stay its own, and changes to who's in it are on the record.

const w = {} as { owner: TestUser; colleague: TestUser; rival: TestUser; admin: TestUser; org: string; rivalOrg: string; rivalFile: string };

const addFile = async (organizationId: string, userId: string) => {
  const [row] = await db
    .insert(schema.file)
    .values({ organizationId, uploaderUserId: userId, storageKey: `orgs/${organizationId}/ri-${userId}.pdf`, originalName: "secret-accounts.pdf", contentType: "application/pdf", sizeBytes: 1000, sha256: "a".repeat(64) })
    .returning();
  return row!.id;
};

beforeAll(async () => {
  await cleanup();
  const [owner, colleague, rival, admin] = (await Promise.all(["ri-owner", "ri-colleague", "ri-rival", "ri-admin"].map(signUp))) as [TestUser, TestUser, TestUser, TestUser];
  Object.assign(w, { owner, colleague, rival, admin });
  process.env.ENTRUST_ORG_ID = await createOrganization("ri-entrust", [[admin, "admin"]], { smeProfile: false });
  w.org = await createOrganization("ri-sme", [[owner, "owner"], [colleague, "member"]], { platform: "trade" });
  w.rivalOrg = await createOrganization("ri-rival-sme", [[rival, "owner"]], { platform: "trade" });
  w.rivalFile = await addFile(w.rivalOrg, rival.id);
});

afterAll(async () => {
  await cleanup();
  await db.delete(schema.program).where(like(schema.program.name, `${PREFIX}ri-%`));
});

describe("evidence", () => {
  const body = (change: Record<string, unknown>) => ({ organizationId: w.org, targetType: "outcome", targetId: "x", title: "Sales ledger", label: "Sales ledger", ...change });

  it("won't let a business mark its own evidence as reviewed or verified", async () => {
    for (const confidence of ["reviewed", "verified"]) {
      expect((await callV1(w.owner, "POST", "/trade/evidence", body({ confidence }))).status, confidence).toBe(403);
    }
    const own = await callV1(w.owner, "POST", "/trade/evidence", body({ confidence: "self_reported" }));
    expect(own.status).toBe(201);
  });

  it("won't attach another business's file, or say anything about it", async () => {
    const res = await callV1(w.owner, "POST", "/trade/evidence", body({ fileId: w.rivalFile }));
    expect(res.status).toBe(404);
    expect(JSON.stringify(res.body)).not.toContain("secret-accounts");
  });
});

describe("the people in a business", () => {
  it("records a role change and a removal", async () => {
    const changed = await callV1(w.owner, "PATCH", `/organizations/${w.org}/members/${w.colleague.id}`, { role: "owner" });
    expect(changed.status).toBe(200);
    const [roleLog] = await db
      .select()
      .from(schema.auditLog)
      .where(and(eq(schema.auditLog.organizationId, w.org), eq(schema.auditLog.action, "organization.member.role_changed")))
      .orderBy(desc(schema.auditLog.occurredAt));
    expect(roleLog).toMatchObject({ actorUserId: w.owner.id, before: { userId: w.colleague.id, role: "member" }, after: { userId: w.colleague.id, role: "owner" } });

    expect((await callV1(w.owner, "DELETE", `/organizations/${w.org}/members/${w.colleague.id}`)).status).toBe(200);
    const [removed] = await db
      .select()
      .from(schema.auditLog)
      .where(and(eq(schema.auditLog.organizationId, w.org), eq(schema.auditLog.action, "organization.member.removed")));
    expect(removed).toMatchObject({ actorUserId: w.owner.id, before: { userId: w.colleague.id, role: "owner" } });
  });
});

describe("enrolment", () => {
  it("won't enrol an organisation with no SME ID", async () => {
    // Made outside the registration form: an SME with no registry entry.
    const noProfile = await createOrganization("ri-no-profile", [[w.rival, "owner"]]);
    await db.delete(schema.smeProfile).where(eq(schema.smeProfile.organizationId, noProfile));
    const program = await callV1(w.admin, "POST", "/trade/programs", { name: `${PREFIX}ri-program` });
    const cohort = await callV1(w.admin, "POST", "/trade/cohorts", { programId: program.body.id, name: `${PREFIX}ri-cohort`, country: "ET" });
    const res = await callV1(w.admin, "POST", "/trade/enrollments", { cohortId: cohort.body.id, organizationId: noProfile });
    expect(res.status).toBe(422);
    expect(res.body.error).toContain("SME ID");
    expect((await callV1(w.admin, "POST", "/trade/enrollments", { cohortId: cohort.body.id, organizationId: w.org })).status).toBe(201);
  });
});
