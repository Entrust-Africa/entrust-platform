import { schema } from "@entrust/db";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PREFIX, callFileV1, callV1, cleanup, createOrganization, db, signUp, type Json, type TestUser } from "./support";

// Report filters (REP-05, REP-06), exports as Excel and PDF (REP-04) and one business's report (REP-02).

vi.mock("@entrust/jobs", async (importOriginal) => ({ ...(await importOriginal<typeof import("@entrust/jobs")>()), enqueue: vi.fn(async () => "job") }));

const w = {} as { admin: TestUser; assessor: TestUser; owner: TestUser; stranger: TestUser; quality: TestUser; program: string; cohortA: string; cohortB: string; orgs: string[]; enrollments: string[] };
const get = (u: TestUser | null, path: string) => callV1(u, "GET", `/trade${path}`);

beforeAll(async () => {
  await cleanup();
  const [admin, assessor, owner, stranger, quality] = (await Promise.all(["rf2-admin", "rf2-assessor", "rf2-owner", "rf2-stranger", "rf2-quality"].map(signUp))) as [TestUser, TestUser, TestUser, TestUser, TestUser];
  Object.assign(w, { admin, assessor, owner, stranger, quality });
  process.env.ENTRUST_ORG_ID = await createOrganization("rf2-entrust", [[admin, "admin"], [assessor, "reviewer"], [quality, "quality"]], { smeProfile: false });
  const [a, b, c] = await Promise.all([
    createOrganization("rf2-sme-a", [[owner, "owner"]], { platform: "trade" }),
    createOrganization("rf2-sme-b", [[stranger, "owner"]], { platform: "trade" }),
    createOrganization("rf2-sme-c", [], { platform: "trade" }),
  ]);
  w.orgs = [a, b, c];
  const [program] = await db.insert(schema.program).values({ name: `${PREFIX}rf2-program` }).returning();
  w.program = program!.id;
  const cohorts = await db.insert(schema.cohort).values([{ programId: w.program, name: `${PREFIX}rf2-one`, country: "ET" }, { programId: w.program, name: `${PREFIX}rf2-two`, country: "ET" }]).returning();
  w.cohortA = cohorts[0]!.id;
  w.cohortB = cohorts[1]!.id;
  const enrollments = await db
    .insert(schema.enrollment)
    .values([{ cohortId: w.cohortA, organizationId: a, status: "active" }, { cohortId: w.cohortA, organizationId: b, status: "active" }, { cohortId: w.cohortB, organizationId: c, status: "active" }])
    .returning();
  w.enrollments = enrollments.map((e) => e.id);
  // a is on Pathway A, b on B, c has none yet.
  await db.insert(schema.pathwayAssignment).values([
    { enrollmentId: w.enrollments[0]!, pathway: "A", status: "confirmed", rulesVersion: "t", reasonCodes: [] },
    { enrollmentId: w.enrollments[1]!, pathway: "B", status: "confirmed", rulesVersion: "t", reasonCodes: [] },
  ]);
  await db.insert(schema.moduleProgress).values([
    { enrollmentId: w.enrollments[0]!, moduleId: "M01", contentVersion: "1.0.0", status: "passed", lessonProgress: {} },
    { enrollmentId: w.enrollments[0]!, moduleId: "M04", contentVersion: "1.0.0", status: "in_progress", lessonProgress: {} },
    { enrollmentId: w.enrollments[1]!, moduleId: "M01", contentVersion: "1.0.0", status: "passed", lessonProgress: {} },
    { enrollmentId: w.enrollments[2]!, moduleId: "M04", contentVersion: "1.0.0", status: "in_progress", lessonProgress: {} },
  ]);
  await db.insert(schema.cohortStaff).values({ cohortId: w.cohortA, userId: assessor.id });
});

afterAll(async () => {
  delete process.env.ENTRUST_ORG_ID;
  await cleanup();
});

describe("filters", () => {
  it("count everything with none", async () => {
    const res = (await get(w.admin, `/reports/programs/${w.program}`)).body;
    expect(res.reach.enrolled).toBe(3);
    expect(res.filters).toEqual({ pathway: null, moduleId: null, cohortId: null });
  });

  it("show only the businesses on a pathway, with no contamination from the other", async () => {
    const a = (await get(w.admin, `/reports/programs/${w.program}?pathway=A`)).body;
    expect(a.smes.map((s: Json) => s.name)).toEqual(["rf2-sme-a"]);
    expect(a.reach.enrolled).toBe(1);
    expect(a.reach).toMatchObject({ pathwayA: 1, pathwayB: 0 });
    const b = (await get(w.admin, `/reports/programs/${w.program}?pathway=B`)).body;
    expect(b.smes.map((s: Json) => s.name)).toEqual(["rf2-sme-b"]);
    expect(b.reach).toMatchObject({ pathwayA: 0, pathwayB: 1 });
    expect(b.filters.pathway).toBe("B");
  });

  it("narrow to a cohort and a module, and combine", async () => {
    const cohort = (await get(w.admin, `/reports/programs/${w.program}?cohortId=${w.cohortB}`)).body;
    expect(cohort.smes.map((s: Json) => s.name)).toEqual(["rf2-sme-c"]);
    const m4 = (await get(w.admin, `/reports/programs/${w.program}?moduleId=M04`)).body;
    expect(m4.engagement.modules.map((m: Json) => m.moduleId)).toEqual(["M04"]);
    expect(m4.engagement.modules[0].started).toBe(2);
    // Together: Pathway A and module M04 leaves the one business on A, with its M04 progress only.
    const both = (await get(w.admin, `/reports/programs/${w.program}?pathway=A&moduleId=M04`)).body;
    expect(both.smes.map((s: Json) => s.name)).toEqual(["rf2-sme-a"]);
    expect(both.engagement.modules).toEqual([expect.objectContaining({ moduleId: "M04", started: 1 })]);
    // A cohort the programme doesn't have is not found, and a bad value is refused.
    expect((await get(w.admin, `/reports/programs/${w.program}?cohortId=${w.program}`)).status).toBe(404);
    expect((await get(w.admin, `/reports/programs/${w.program}?pathway=C`)).status).toBe(400);
  });

  it("still keep an assessor to their own cohorts", async () => {
    const res = (await get(w.assessor, `/reports/programs/${w.program}`)).body;
    expect(res.smes.map((s: Json) => s.name).sort()).toEqual(["rf2-sme-a", "rf2-sme-b"]);
    expect((await get(w.assessor, `/reports/cohorts/${w.cohortB}`)).status).toBe(404);
  });
});

describe("exports", () => {
  it("come as Excel, CSV and PDF, with the filters in them", async () => {
    const xlsx = await callFileV1(w.admin, `/trade/reports/programs/${w.program}/export?format=xlsx&pathway=B`);
    expect(xlsx.status).toBe(200);
    expect(xlsx.headers.get("content-type")).toContain("spreadsheetml");
    expect(xlsx.headers.get("content-disposition")).toContain(".xlsx");
    const bytes = new Uint8Array(await xlsx.arrayBuffer());
    // An .xlsx file is a zip.
    expect([bytes[0], bytes[1]]).toEqual([0x50, 0x4b]);

    const pdf = await callFileV1(w.admin, `/trade/reports/programs/${w.program}/export?format=pdf`);
    expect(pdf.headers.get("content-type")).toContain("application/pdf");
    expect(new TextDecoder().decode((await pdf.arrayBuffer()).slice(0, 5))).toBe("%PDF-");

    const csv = await callFileV1(w.admin, `/trade/reports/programs/${w.program}/export?format=csv&pathway=B`);
    const text = await csv.text();
    expect(text).toContain("rf2-sme-b");
    expect(text).not.toContain("rf2-sme-a");
    expect((await callFileV1(w.admin, `/trade/reports/programs/${w.program}/export?format=docx`)).status).toBe(400);
  });

  it("are for staff only", async () => {
    expect((await callFileV1(w.owner, `/trade/reports/programs/${w.program}/export?format=xlsx`)).status).toBeGreaterThanOrEqual(403);
    // Quality reads reports but isn't staff, so it can't take the named rows out as a file.
    expect((await callFileV1(w.quality, `/trade/reports/programs/${w.program}/export?format=xlsx`)).status).toBe(403);
  });
});

describe("one business's report", () => {
  it("brings together its details, products, shipments, buyers, enrolment, progress and outputs", async () => {
    const [org] = w.orgs;
    await db.insert(schema.smeProduct).values({ organizationId: org!, name: "Washed coffee" });
    await db.insert(schema.smeExportHistory).values({ organizationId: org!, product: "Coffee", destination: "Germany", evidenceStatus: "document_supported" });
    await db.insert(schema.smeBuyer).values({ organizationId: org!, name: "Roaster GmbH", nameKey: "roaster gmbh", country: "DE" });
    const [version] = await db.insert(schema.worksheetVersion).values({ enrollmentId: w.enrollments[0]!, worksheetId: "m05-buyer-research-sheet", moduleId: "M05", version: 1, status: "submitted", submittedAt: new Date() }).returning();
    await db.insert(schema.worksheetVersionReview).values({ worksheetVersionId: version!.id, status: "reviewed" });
    await db.insert(schema.actionItem).values([{ organizationId: org!, description: "Late", responsible: "Owner", dueDate: "2020-01-01", status: "in_progress" }, { organizationId: org!, description: "Done", responsible: "Owner", status: "completed" }]);

    const report = (await get(w.owner, `/reports/smes/${org}`)).body;
    expect(report.profile.legalName).toBe("rf2-sme-a");
    expect(report.products.map((p: Json) => p.name)).toEqual(["Washed coffee"]);
    expect(report.shipments[0]).toMatchObject({ product: "Coffee", evidenceStatus: "document_supported" });
    expect(report.buyers).toEqual([{ name: "Roaster GmbH", country: "DE", verificationStatus: "unverified" }]);
    expect(report.enrolments[0]).toMatchObject({ cohort: `${PREFIX}rf2-one`, pathway: "A", status: "active" });
    expect(report.modules.map((m: Json) => [m.moduleId, m.status])).toEqual([["M01", "passed"], ["M04", "in_progress"]]);
    expect(report.outputs[0]).toMatchObject({ moduleId: "M05", version: 1, reviewStatus: "reviewed" });
    expect(report.actionPlan).toEqual({ total: 2, byStatus: { in_progress: 1, completed: 1 }, overdue: 1 });
    // Nothing from another business.
    expect(report.modules).toHaveLength(2);
  });

  it("is the business's own and staff who can reach it, and shows a referral only to staff", async () => {
    const [org, other] = w.orgs;
    expect((await get(w.stranger, `/reports/smes/${org}`)).status).toBe(404);
    expect((await get(w.owner, `/reports/smes/${other}`)).status).toBe(404);
    expect((await get(w.owner, `/reports/smes/${org}`)).body.referrals).toBeNull();
    expect((await get(w.admin, `/reports/smes/${org}`)).body.referrals).toEqual([]);
    expect((await get(w.assessor, `/reports/smes/${org}`)).status).toBe(200);
    expect((await get(w.quality, `/reports/smes/${org}`)).status).toBeGreaterThanOrEqual(403);
  });

  it("exports as Excel, CSV and PDF", async () => {
    const [org] = w.orgs;
    for (const [format, start] of [["pdf", "%PDF-"], ["csv", "Summit"], ["xlsx", "PK"]] as const) {
      const res = await callFileV1(w.owner, `/trade/reports/smes/${org}/export?format=${format}`);
      expect(res.status, format).toBe(200);
      expect(new TextDecoder().decode((await res.arrayBuffer()).slice(0, 12))).toContain(start);
    }
    const csv = await (await callFileV1(w.owner, `/trade/reports/smes/${org}/export?format=csv`)).text();
    expect(csv).toContain("Washed coffee");
    expect(csv).toContain("Roaster GmbH");
    expect((await callFileV1(w.stranger, `/trade/reports/smes/${org}/export?format=csv`)).status).toBe(404);
  });
});
