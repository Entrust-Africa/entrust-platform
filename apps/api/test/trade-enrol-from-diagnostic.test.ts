import { randomUUID } from "node:crypto";
import { and, eq, inArray, like } from "drizzle-orm";
import { schema } from "@entrust/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PREFIX, callV1, cleanup, createOrganization, db, signUp, type TestUser } from "./support";

// Staff enrol someone who only filled in the public onboarding diagnostic: the business is made from the form, enrolled,
// and given the form's avenue. The owner is their account when the email was proven, otherwise an invitation.

const w = {} as { admin: TestUser; reviewer: TestUser; sme: TestUser; proven: TestUser; cohortId: string };
const made: string[] = [];
const email = (name: string) => `${PREFIX}efd-${randomUUID().slice(0, 6)}-${name}@example.test`;

/** A submitted form, written straight to the table: the form itself is tested in trade-public-diagnostic.test.ts. */
async function submitted(values: { email: string; businessName: string | null; verifiedUserId?: string; pathway?: "A" | "B"; provisional?: boolean }) {
  const [row] = await db
    .insert(schema.publicDiagnostic)
    .values({
      tokenHash: randomUUID(),
      email: values.email,
      businessName: values.businessName,
      phone: "+251911000000",
      templateVersion: "test",
      status: "submitted",
      pathway: values.pathway ?? "A",
      pathwayProvisional: values.provisional ?? false,
      liveOrder: false,
      rulesVersion: "test",
      reasonCodes: ["TEST"],
      submittedAt: new Date(),
      ...(values.verifiedUserId ? { emailVerifiedAt: new Date(), userId: values.verifiedUserId } : {}),
    })
    .returning();
  return row!;
}

const waiting = async (user: TestUser) => callV1(user, "GET", "/trade/enrollments/waiting");
const enrol = (user: TestUser, body: Record<string, unknown>) => callV1(user, "POST", "/trade/enrollments/from-diagnostic", { cohortId: w.cohortId, ...body });

beforeAll(async () => {
  await cleanup();
  await db.delete(schema.publicDiagnostic).where(like(schema.publicDiagnostic.email, `${PREFIX}%`));
  const [admin, reviewer, sme, proven] = (await Promise.all(["efd-admin", "efd-reviewer", "efd-sme", "efd-proven"].map(signUp))) as TestUser[];
  Object.assign(w, { admin, reviewer, sme, proven });
  process.env.ENTRUST_ORG_ID = await createOrganization("efd-entrust", [[admin!, "admin"], [reviewer!, "reviewer"]], { smeProfile: false });
  await createOrganization("efd-sme-org", [[sme!, "owner"]], { platform: "trade" });
  const program = await callV1(admin!, "POST", "/trade/programs", { name: `${PREFIX}efd program` });
  const cohort = await callV1(admin!, "POST", "/trade/cohorts", { programId: program.body.id, name: `${PREFIX}efd cohort` });
  w.cohortId = cohort.body.id;
});

afterAll(async () => {
  delete process.env.ENTRUST_ORG_ID;
  await db.delete(schema.publicDiagnostic).where(like(schema.publicDiagnostic.email, `${PREFIX}%`));
  if (made.length) {
    await db.delete(schema.auditLog).where(inArray(schema.auditLog.organizationId, made));
    await db.delete(schema.platformAccess).where(inArray(schema.platformAccess.organizationId, made));
    await db.delete(schema.organization).where(inArray(schema.organization.id, made));
  }
  await cleanup();
});

describe("Enrolling from a submitted public diagnostic", () => {
  it("lists a submitted form from someone with no business, once per email, with its newest form", async () => {
    const address = email("twice");
    await submitted({ email: address, businessName: "Older Name Coffee" });
    const newer = await submitted({ email: address, businessName: `${PREFIX}Newer Name Coffee` });
    const res = await waiting(w.admin);
    expect(res.status).toBe(200);
    const rows = res.body.diagnostics.filter((d: { email: string }) => d.email === address);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ publicDiagnosticId: newer.id, businessName: `${PREFIX}Newer Name Coffee`, emailVerified: false, pathway: "A" });
  });

  it("leaves out someone whose email already belongs to a business", async () => {
    const [owner] = await db.select({ email: schema.user.email }).from(schema.user).where(eq(schema.user.id, w.sme.id));
    await submitted({ email: owner!.email, businessName: `${PREFIX}Has A Business` });
    const res = await waiting(w.admin);
    expect(res.body.diagnostics.some((d: { email: string }) => d.email === owner!.email)).toBe(false);
    const refused = await enrol(w.admin, { publicDiagnosticId: (await submitted({ email: owner!.email, businessName: `${PREFIX}Has A Business 2` })).id });
    expect(refused.status).toBe(409);
    expect(refused.body.error).toContain("already belongs to a business");
  });

  it("makes the business, invites the unproven email to own it, and gives a provisional avenue", async () => {
    const address = email("unproven");
    const form = await submitted({ email: address, businessName: `${PREFIX}Unproven Roasters`, pathway: "B" });
    const res = await enrol(w.admin, { publicDiagnosticId: form.id });
    expect(res.status).toBe(201);
    made.push(res.body.organizationId);
    expect(res.body).toMatchObject({ owner: "invited" });
    expect(res.body.smeId).toMatch(/^ET-SME-\d{6}$/);

    const [profile] = await db.select().from(schema.smeProfile).where(eq(schema.smeProfile.organizationId, res.body.organizationId));
    expect(profile).toMatchObject({ legalName: `${PREFIX}Unproven Roasters`, country: "ET" });
    expect(await db.select().from(schema.member).where(eq(schema.member.organizationId, res.body.organizationId))).toHaveLength(0);
    const [invite] = await db.select().from(schema.invitation).where(eq(schema.invitation.organizationId, res.body.organizationId));
    expect(invite).toMatchObject({ email: address, role: "owner", status: "pending", platform: "trade" });

    const [enrollment] = await db.select().from(schema.enrollment).where(eq(schema.enrollment.id, res.body.enrollmentId));
    expect(enrollment).toMatchObject({ cohortId: w.cohortId, status: "invited" });
    const [assignment] = await db.select().from(schema.pathwayAssignment).where(eq(schema.pathwayAssignment.enrollmentId, res.body.enrollmentId));
    expect(assignment).toMatchObject({ pathway: "B", status: "provisional" });
    const [linked] = await db.select().from(schema.publicDiagnostic).where(eq(schema.publicDiagnostic.id, form.id));
    expect(linked!.linkedEnrollmentId).toBe(res.body.enrollmentId);

    // Done once: the person is off the list and the form can't make a second business.
    expect((await waiting(w.admin)).body.diagnostics.some((d: { email: string }) => d.email === address)).toBe(false);
    expect((await enrol(w.admin, { publicDiagnosticId: form.id })).status).toBe(409);
    // A later form from the same address, typed in another case, doesn't put them back on the list.
    await submitted({ email: address.toUpperCase(), businessName: `${PREFIX}Unproven Roasters Again` });
    expect((await waiting(w.admin)).body.diagnostics.some((d: { email: string }) => d.email.toLowerCase() === address)).toBe(false);
  });

  it("makes a proven email's account the owner, with a confirmed avenue", async () => {
    const [person] = await db.select({ email: schema.user.email }).from(schema.user).where(eq(schema.user.id, w.proven.id));
    const form = await submitted({ email: person!.email, businessName: `${PREFIX}Proven Leather`, verifiedUserId: w.proven.id });
    const res = await enrol(w.admin, { publicDiagnosticId: form.id });
    expect(res.status).toBe(201);
    made.push(res.body.organizationId);
    expect(res.body.owner).toBe("owner");
    const members = await db.select().from(schema.member).where(eq(schema.member.organizationId, res.body.organizationId));
    expect(members).toMatchObject([{ userId: w.proven.id, role: "owner" }]);
    const [enrollment] = await db.select().from(schema.enrollment).where(eq(schema.enrollment.id, res.body.enrollmentId));
    expect(enrollment!.status).toBe("registered");
    const [assignment] = await db.select().from(schema.pathwayAssignment).where(eq(schema.pathwayAssignment.enrollmentId, res.body.enrollmentId));
    expect(assignment!.status).toBe("confirmed");
  });

  it("asks staff to confirm a name that is close to a registered business", async () => {
    const first = await submitted({ email: email("same-a"), businessName: `${PREFIX}Twin Spices` });
    const a = await enrol(w.admin, { publicDiagnosticId: first.id });
    expect(a.status).toBe(201);
    made.push(a.body.organizationId);

    const second = await submitted({ email: email("same-b"), businessName: `${PREFIX}Twin Spices` });
    const listed = (await waiting(w.admin)).body.diagnostics.find((d: { publicDiagnosticId: string }) => d.publicDiagnosticId === second.id);
    expect(listed.similarSme).toMatchObject({ legalName: `${PREFIX}Twin Spices` });
    const refused = await enrol(w.admin, { publicDiagnosticId: second.id });
    expect(refused.status).toBe(409);
    expect(refused.body.error).toContain("similar name");
    const confirmed = await enrol(w.admin, { publicDiagnosticId: second.id, confirmDuplicateName: true });
    expect(confirmed.status).toBe(201);
    made.push(confirmed.body.organizationId);
  });

  it("refuses a form without a business name, and a draft", async () => {
    const nameless = await submitted({ email: email("nameless"), businessName: null });
    expect((await enrol(w.admin, { publicDiagnosticId: nameless.id })).status).toBe(422);
    const [draft] = await db
      .insert(schema.publicDiagnostic)
      .values({ tokenHash: randomUUID(), email: email("draft"), businessName: `${PREFIX}Draft Co`, templateVersion: "test" })
      .returning();
    expect((await enrol(w.admin, { publicDiagnosticId: draft!.id })).status).toBe(422);
  });

  it("is for administrators and facilitators only", async () => {
    const form = await submitted({ email: email("reviewer"), businessName: `${PREFIX}Reviewer Try` });
    expect((await enrol(w.reviewer, { publicDiagnosticId: form.id })).status).toBe(404);
    expect((await enrol(w.sme, { publicDiagnosticId: form.id })).status).toBe(404);
    expect((await waiting(w.reviewer)).status).toBe(403);
    const untouched = await db.select().from(schema.publicDiagnostic).where(and(eq(schema.publicDiagnostic.id, form.id)));
    expect(untouched[0]!.linkedEnrollmentId).toBeNull();
  });
});
