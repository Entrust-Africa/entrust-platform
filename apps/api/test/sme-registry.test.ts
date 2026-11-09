import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
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
import { app } from "../src/app";
import { normalizeLegalName } from "../src/services/sme-registry";

const w = {} as {
  admin: TestUser;
  facilitator: TestUser;
  smeOwner: TestUser;
  otherUser: TestUser;
  entrustOrgId: string;
};

beforeAll(async () => {
  await cleanup();
  const [admin, facilitator, smeOwner, otherUser] = await Promise.all([
    signUp("sme-reg-admin"),
    signUp("sme-reg-facil"),
    signUp("sme-reg-owner"),
    signUp("sme-reg-other"),
  ]);
  Object.assign(w, { admin, facilitator, smeOwner, otherUser });

  w.entrustOrgId = await createOrganization(
    "entrust-staff-org",
    [
      [admin!, "admin"],
      [facilitator!, "facilitator"],
    ],
    { smeProfile: false },
  );
  process.env.ENTRUST_ORG_ID = w.entrustOrgId;
});

afterAll(async () => {
  delete process.env.ENTRUST_ORG_ID;
  await cleanup();
});

describe("SME legal name normalisation", () => {
  it("normalises casing, punctuation and corporate suffixes", () => {
    expect(normalizeLegalName("Acme Trading PLC")).toBe("acme trading");
    expect(normalizeLegalName("Acme Trading, S.C.")).toBe("acme trading");
    expect(normalizeLegalName("Acme Trading Private Limited Company")).toBe("acme trading");
    expect(normalizeLegalName("  ACME   TRADING  p.l.c.  ")).toBe("acme trading");
    expect(normalizeLegalName("Acme Trading LLC")).toBe("acme trading");
    expect(normalizeLegalName("Acme Trading Limited")).toBe("acme trading");
    expect(normalizeLegalName("Acme Trading Ltd.")).toBe("acme trading");
    expect(normalizeLegalName("Acme Trading Corp.")).toBe("acme trading");
    expect(normalizeLegalName("Acme Trading Inc")).toBe("acme trading");
    expect(normalizeLegalName("Acme Trading")).toBe("acme trading");
  });
});

describe("SME duplicate registration check on creation", () => {
  const regNumber = `REG-${randomUUID().slice(0, 8)}`;
  const testName = `Test Spices ${randomUUID().slice(0, 8)}`;

  it("creates the first organisation with registration number successfully", async () => {
    const res = await callV1(w.smeOwner, "POST", "/organizations", {
      name: testName,
      slug: `test-spices-${randomUUID().slice(0, 8)}`,
      legalName: `${testName} PLC`,
      tradingName: `${testName} Coffee & Spices`,
      registrationNumber: regNumber,
      registrationStatus: "registered",
      businessStatus: "active",
      sector: "Agriculture & Spices",
      country: "ET",
    });

    expect(res.status).toBe(201);
    expect(res.body.smeId).toMatch(/^ET-SME-\d{6}$/);
  });

  it("refuses duplicate registration number in the same country", async () => {
    const res = await callV1(w.otherUser, "POST", "/organizations", {
      name: `${testName} Duplicate`,
      slug: `test-spices-dup-${randomUUID().slice(0, 8)}`,
      legalName: `${testName} Different Name`,
      registrationNumber: regNumber,
      country: "ET",
    });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("conflict");
    expect(res.body.error).toContain(
      `An organisation with registration number '${regNumber}' already exists in ET. Please ask the existing owner for an invitation.`,
    );
  });

  it("permits same registration number in a different country", async () => {
    const res = await callV1(w.otherUser, "POST", "/organizations", {
      name: `${testName} Kenya`,
      slug: `test-spices-ke-${randomUUID().slice(0, 8)}`,
      legalName: `${testName} Kenya Ltd`,
      registrationNumber: regNumber,
      country: "KE",
    });

    expect(res.status).toBe(201);
  });

  it("answers the pre-flight duplicate check only for someone signed in", async () => {
    const res = await callV1(null, "POST", "/smes/check-duplicate", { legalName: "Anyone At All Exports", country: "ET" });
    expect(res.status).toBe(401);
  });

  it("won't let an owner delete their organisation and its records", async () => {
    const org = await createOrganization("sme-reg-delete", [[w.otherUser, "owner"]]);
    const res = await app.request("/api/auth/organization/delete", {
      method: "POST",
      headers: { cookie: w.otherUser.cookie, "content-type": "application/json", origin: "http://localhost:3000" },
      body: JSON.stringify({ organizationId: org }),
    });
    expect(res.status).toBe(404);
    const [row] = await db.select({ id: schema.organization.id }).from(schema.organization).where(eq(schema.organization.id, org));
    expect(row?.id).toBe(org);
  });

  it("pre-flight duplicate check reports registration number conflict", async () => {
    const res = await callV1(w.otherUser, "POST", "/smes/check-duplicate", {
      legalName: "Some Completely Unique Name",
      registrationNumber: regNumber,
      country: "ET",
    });

    expect(res.status).toBe(200);
    expect(res.body.duplicate).toBe(true);
    expect(res.body.conflict).toBe("registration_number");
    expect(res.body.message).toContain("already exists in ET");
  });
});

describe("SME normalised legal name collision warning", () => {
  const uniquePrefix = `Orig-${randomUUID().slice(0, 6)}`;

  it("creates the original organisation", async () => {
    const res = await callV1(w.smeOwner, "POST", "/organizations", {
      name: `${uniquePrefix} Exports`,
      slug: `${uniquePrefix.toLowerCase()}-exports`,
      legalName: `${uniquePrefix} Exports PLC`,
      country: "ET",
    });
    expect(res.status).toBe(201);
  });

  it("warns with 409 when normalised legal name matches and requires confirmation", async () => {
    const res = await callV1(w.otherUser, "POST", "/organizations", {
      name: `${uniquePrefix} Different Org`,
      slug: `${uniquePrefix.toLowerCase()}-different`,
      legalName: `${uniquePrefix} Exports, Share Company`,
      country: "ET",
    });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("duplicate_legal_name_warning");
    expect(res.body.warning).toBe("duplicate_legal_name");
    expect(res.body.existingSme.legalName).toBe(`${uniquePrefix} Exports PLC`);
  });

  it("succeeds when confirmDuplicateName is true", async () => {
    const res = await callV1(w.otherUser, "POST", "/organizations", {
      name: `${uniquePrefix} Different Org`,
      slug: `${uniquePrefix.toLowerCase()}-different`,
      legalName: `${uniquePrefix} Exports, Share Company`,
      country: "ET",
      confirmDuplicateName: true,
    });

    expect(res.status).toBe(201);
  });

  it("pre-flight duplicate check reports legal name warning", async () => {
    const res = await callV1(w.otherUser, "POST", "/smes/check-duplicate", {
      legalName: `${uniquePrefix} Exports Private Limited Company`,
      country: "ET",
    });

    expect(res.status).toBe(200);
    expect(res.body.duplicate).toBe(true);
    expect(res.body.warning).toBe("legal_name");
    expect(res.body.details.legalName).toBe(`${uniquePrefix} Exports PLC`);
  });
});

describe("Sequential SME IDs", () => {
  it("allocates sequential, non-reusable SME IDs", async () => {
    const res1 = await callV1(w.smeOwner, "POST", "/organizations", {
      name: `Seq Org 1 ${randomUUID().slice(0, 6)}`,
      slug: `seq-org-1-${randomUUID().slice(0, 8)}`,
      legalName: `Seq Org 1 ${randomUUID().slice(0, 6)}`,
      country: "ET",
    });
    const res2 = await callV1(w.smeOwner, "POST", "/organizations", {
      name: `Seq Org 2 ${randomUUID().slice(0, 6)}`,
      slug: `seq-org-2-${randomUUID().slice(0, 8)}`,
      legalName: `Seq Org 2 ${randomUUID().slice(0, 6)}`,
      country: "ET",
    });

    expect(res1.status).toBe(201);
    expect(res2.status).toBe(201);

    const num1 = parseInt(res1.body.smeId.replace("ET-SME-", ""), 10);
    const num2 = parseInt(res2.body.smeId.replace("ET-SME-", ""), 10);
    expect(num2).toBe(num1 + 1);
  });
});

describe("Registry search (GET /v1/smes/search?q=)", () => {
  const searchTag = `SearchTag-${randomUUID().slice(0, 6)}`;
  let createdSmeId: string;

  beforeAll(async () => {
    const res = await callV1(w.smeOwner, "POST", "/organizations", {
      name: `${searchTag} Co`,
      slug: `${searchTag.toLowerCase()}-co`,
      legalName: `${searchTag} Coffee Exporters PLC`,
      tradingName: `${searchTag} Premium Beans`,
      registrationNumber: `REG-${searchTag}`,
      tin: `TIN-${searchTag}`,
      country: "ET",
    });
    expect(res.status).toBe(201);
    createdSmeId = res.body.smeId;
  });

  it("refuses search for non-staff callers with 403", async () => {
    const res = await callV1(w.smeOwner, "GET", `/smes/search?q=${searchTag}`);
    expect(res.status).toBe(403);
    expect(res.body.error).toContain("Only Entrust administrators and facilitators can search the SME registry");
  });

  it("finds SME by SME ID for Entrust staff", async () => {
    const res = await callV1(w.facilitator, "GET", `/smes/search?q=${createdSmeId}`);
    expect(res.status).toBe(200);
    expect(res.body.smes.length).toBeGreaterThanOrEqual(1);
    const match = res.body.smes.find((s: any) => s.smeId === createdSmeId);
    expect(match).toBeDefined();
    expect(match.legalName).toBe(`${searchTag} Coffee Exporters PLC`);
    expect(match.tradingName).toBe(`${searchTag} Premium Beans`);
  });

  it("finds SME by part of legal name for Entrust staff", async () => {
    const res = await callV1(w.admin, "GET", `/smes/search?q=${searchTag}`);
    expect(res.status).toBe(200);
    const match = res.body.smes.find((s: any) => s.smeId === createdSmeId);
    expect(match).toBeDefined();
  });

  it("finds SME by TIN for Entrust staff", async () => {
    const res = await callV1(w.admin, "GET", `/smes/search?q=TIN-${searchTag}`);
    expect(res.status).toBe(200);
    const match = res.body.smes.find((s: any) => s.smeId === createdSmeId);
    expect(match).toBeDefined();
  });
});

describe("Admin duplicate merge (POST /v1/smes/:smeId/merge)", () => {
  let targetSmeId: string;
  let targetOrgId: string;
  let duplicateSmeId: string;
  let duplicateOrgId: string;

  beforeAll(async () => {
    const uniqueMergeRun = randomUUID().slice(0, 8);
    const target = await callV1(w.smeOwner, "POST", "/organizations", {
      name: `Target Surviving SME ${uniqueMergeRun}`,
      slug: `target-sme-${uniqueMergeRun}`,
      legalName: `Target Surviving SME ${uniqueMergeRun} PLC`,
      country: "ET",
    });
    expect(target.status).toBe(201);
    targetSmeId = target.body.smeId;
    targetOrgId = target.body.id;

    const duplicate = await callV1(w.smeOwner, "POST", "/organizations", {
      name: `Duplicate SME ${uniqueMergeRun}`,
      slug: `dup-sme-${uniqueMergeRun}`,
      legalName: `Duplicate SME ${uniqueMergeRun} PLC`,
      country: "ET",
    });
    expect(duplicate.status).toBe(201);
    duplicateSmeId = duplicate.body.smeId;
    duplicateOrgId = duplicate.body.id;
  });

  it("refuses merge for non-admin callers", async () => {
    const res = await callV1(w.facilitator, "POST", `/smes/${duplicateSmeId}/merge`, {
      targetSmeId,
      reason: "Duplicate created by mistake",
    });
    expect(res.status).toBe(403);
  });

  it("refuses merge into self", async () => {
    const res = await callV1(w.admin, "POST", `/smes/${duplicateSmeId}/merge`, {
      targetSmeId: duplicateSmeId,
      reason: "Self merge",
    });
    expect(res.status).toBe(422);
    expect(res.body.error).toContain("Cannot merge an SME into itself");
  });

  it("refuses merge if duplicate SME has existing CLEAR cases", async () => {
    // Insert a case for duplicate
    const [caseRow] = await db
      .insert(schema.exportCase)
      .values({
        organizationId: duplicateOrgId,
        reference: `QZ-${randomUUID().slice(0, 6)}`,
        facts: { product: "green_coffee", destinationCountry: "US" },
        createdByUserId: w.smeOwner.id,
      })
      .returning();

    const res = await callV1(w.admin, "POST", `/smes/${duplicateSmeId}/merge`, {
      targetSmeId,
      reason: "Duplicate created by mistake",
    });
    expect(res.status).toBe(422);
    expect(res.body.error).toContain("Cannot merge an SME that has existing CLEAR export cases");

    // Clean up case
    await db.delete(schema.exportCase).where(eq(schema.exportCase.id, caseRow!.id));
  });

  it("refuses merge if duplicate SME has existing TRADE enrolments", async () => {
    // Insert program, cohort and enrollment for duplicate
    const [prog] = await db.insert(schema.program).values({ name: "Test Program" }).returning();
    const [coh] = await db.insert(schema.cohort).values({ programId: prog!.id, name: "Cohort 1" }).returning();
    const [enr] = await db
      .insert(schema.enrollment)
      .values({ cohortId: coh!.id, organizationId: duplicateOrgId })
      .returning();

    const res = await callV1(w.admin, "POST", `/smes/${duplicateSmeId}/merge`, {
      targetSmeId,
      reason: "Duplicate created by mistake",
    });
    expect(res.status).toBe(422);
    expect(res.body.error).toContain("Cannot merge an SME that has existing TRADE enrolments");

    // Clean up enrollment, cohort, program
    await db.delete(schema.enrollment).where(eq(schema.enrollment.id, enr!.id));
    await db.delete(schema.cohort).where(eq(schema.cohort.id, coh!.id));
    await db.delete(schema.program).where(eq(schema.program.id, prog!.id));
  });

  it("successfully merges duplicate SME when 0 cases and 0 enrolments", async () => {
    const res = await callV1(w.admin, "POST", `/smes/${duplicateSmeId}/merge`, {
      targetSmeId,
      reason: "Confirmed duplicate registration created during pilot onboarding",
    });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.duplicateSmeId).toBe(duplicateSmeId);
    expect(res.body.targetSmeId).toBe(targetSmeId);

    // Verify duplicate profile in DB
    const [dupProfile] = await db
      .select()
      .from(schema.smeProfile)
      .where(eq(schema.smeProfile.smeId, duplicateSmeId));
    expect(dupProfile?.mergedIntoSmeId).toBe(targetSmeId);
    expect(dupProfile?.businessStatus).toBe("closed");

    // Verify audit log
    const [audit] = await db
      .select()
      .from(schema.auditLog)
      .where(eq(schema.auditLog.entityId, dupProfile!.id));
    expect(audit).toBeDefined();
    expect(audit?.action).toBe("sme_profile.merged");
    expect((audit?.after as any)?.mergedIntoSmeId).toBe(targetSmeId);
    expect(audit?.reason).toBe("Confirmed duplicate registration created during pilot onboarding");
  });

  it("cannot merge an already merged SME again", async () => {
    const res = await callV1(w.admin, "POST", `/smes/${duplicateSmeId}/merge`, {
      targetSmeId,
      reason: "Merge again",
    });
    expect(res.status).toBe(422);
    expect(res.body.error).toContain("already been merged");
  });
});

describe("Profile update and audit trail (PATCH /organizations/:orgId/profile)", () => {
  let orgId: string;
  let profileId: string;

  beforeAll(async () => {
    const uniqueAuditRun = randomUUID().slice(0, 8);
    const res = await callV1(w.smeOwner, "POST", "/organizations", {
      name: `Audit Test Org ${uniqueAuditRun}`,
      slug: `audit-test-${uniqueAuditRun}`,
      legalName: `Audit Test Legal Name ${uniqueAuditRun} PLC`,
      tradingName: "Initial Trading Name",
      country: "ET",
    });
    expect(res.status).toBe(201);
    orgId = res.body.id;
    const [p] = await db
      .select({ id: schema.smeProfile.id })
      .from(schema.smeProfile)
      .where(eq(schema.smeProfile.organizationId, orgId));
    profileId = p!.id;
  });

  it("updates profile fields and records an audit log entry with before and after", async () => {
    const patchRes = await callV1(w.smeOwner, "PATCH", `/organizations/${orgId}/profile`, {
      tradingName: "Updated Trading Brand",
      sector: "Textiles & Apparel",
      businessStatus: "active",
      registrationStatus: "registered",
    });

    expect(patchRes.status).toBe(200);

    const [updated] = await db
      .select()
      .from(schema.smeProfile)
      .where(eq(schema.smeProfile.id, profileId));
    expect(updated?.tradingName).toBe("Updated Trading Brand");
    expect(updated?.sector).toBe("Textiles & Apparel");

    // Check audit log
    const audits = await db
      .select()
      .from(schema.auditLog)
      .where(eq(schema.auditLog.entityId, profileId));
    const updateAudit = audits.find((a) => a.action === "sme_profile.updated");
    expect(updateAudit).toBeDefined();
    expect((updateAudit?.before as any)?.tradingName).toBe("Initial Trading Name");
    expect((updateAudit?.after as any)?.tradingName).toBe("Updated Trading Brand");
    expect((updateAudit?.after as any)?.sector).toBe("Textiles & Apparel");
  });
});
