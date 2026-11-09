import { eq } from "drizzle-orm";
import { schema } from "@entrust/db";
import { latestDiagnosticTemplate } from "@entrust/trade-rules";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PREFIX, callV1, cleanup, createOrganization, db, signUp, type Json, type TestUser } from "./support";

// The six readiness profiles (spec 6.5): separate results, never one score.

const w = {} as { owner: TestUser; stranger: TestUser; admin: TestUser; org: string; enrollment: string; placement: string; exit: string };
const get = (u: TestUser | null, path: string) => callV1(u, "GET", `/trade${path}`);

const score = (assessmentId: string, domain: string, points: number, maxPoints: number, coverage: string, band: string | null) => ({
  assessmentId,
  kind: "domain" as const,
  domain,
  points,
  maxPoints,
  coverage,
  score: maxPoints > 0 ? ((points / maxPoints) * 100).toFixed(2) : null,
  band,
  evidenceStatus: "self_reported" as const,
});

beforeAll(async () => {
  await cleanup();
  const [owner, stranger, admin] = (await Promise.all(["rd-owner", "rd-stranger", "rd-admin"].map(signUp))) as [TestUser, TestUser, TestUser];
  Object.assign(w, { owner, stranger, admin });
  process.env.ENTRUST_ORG_ID = await createOrganization("rd-entrust", [[admin, "admin"]], { smeProfile: false });
  w.org = await createOrganization("rd-sme", [[owner, "owner"]], { platform: "trade" });
  await createOrganization("rd-other", [[stranger, "owner"]], { platform: "trade" });
  const [program] = await db.insert(schema.program).values({ name: `${PREFIX}rd-program` }).returning();
  const [cohort] = await db.insert(schema.cohort).values({ programId: program!.id, name: `${PREFIX}rd-cohort`, country: "ET" }).returning();
  const [enrollment] = await db.insert(schema.enrollment).values({ cohortId: cohort!.id, organizationId: w.org, status: "active" }).returning();
  w.enrollment = enrollment!.id;
});

afterAll(async () => {
  delete process.env.ENTRUST_ORG_ID;
  await cleanup();
});

describe("readiness profiles", () => {
  it("are six areas, all not assessed, before any assessment", async () => {
    const res = (await get(w.owner, `/readiness-profiles?organizationId=${w.org}`)).body;
    expect(res.current.map((a: Json) => a.area)).toEqual(["financial", "insurance_risk", "production_operations", "market_buyers", "export_execution", "management_digital"]);
    expect(res.current.every((a: Json) => a.score === null && a.reviewStatus === "not_assessed")).toBe(true);
    expect(res.earlier).toBeNull();
    expect(res.note).toContain("six separate results");
  });

  it("read each area from the placement sections that make it up, and never add them into one score", async () => {
    const [placement] = await db.insert(schema.tradeAssessment).values({ enrollmentId: w.enrollment, kind: "placement", templateVersion: "t", status: "scored", assessedAt: new Date() }).returning();
    w.placement = placement!.id;
    await db.insert(schema.capabilityScore).values([
      score(w.placement, "B", 6, 12, "1.0000", "Developing"),
      score(w.placement, "C", 9, 12, "1.0000", "Functional"),
      score(w.placement, "D", 3, 12, "0.5000", "Basic"),
      score(w.placement, "E", 12, 12, "1.0000", "Strong"),
      // Everything answered "not known", so nothing was scored: that is no result, not zero.
      { ...score(w.placement, "F", 0, 0, "0.0000", null), score: null },
      score(w.placement, "G", 4, 12, "1.0000", "Basic"),
    ]);
    const res = (await get(w.owner, `/readiness-profiles?organizationId=${w.org}`)).body;
    const area = (name: string) => res.current.find((a: Json) => a.area === name);
    expect(area("market_buyers")).toMatchObject({ score: 50, classification: "Developing", reviewStatus: "complete" });
    expect(area("export_execution")).toMatchObject({ score: 100, classification: "Strong" });
    expect(area("production_operations")).toMatchObject({ score: 33.33, classification: "Basic" });
    // Financial is two sections: points over points available across both, with each section shown.
    expect(area("financial")).toMatchObject({ score: 50, classification: null, evidenceCoverage: 0.75 });
    expect(area("financial").sections.map((s: Json) => [s.section, s.score])).toEqual([["C", 75], ["D", 25]]);
    expect(area("management_digital")).toMatchObject({ score: null });
    // There is no combined score anywhere in the answer.
    expect(JSON.stringify(res)).not.toMatch(/overall|total|combined_score|average/i);
  });

  it("show staff review when the placement is waiting for it, and compare an exit assessment with the placement", async () => {
    await db.update(schema.tradeAssessment).set({ status: "review_required" }).where(eq(schema.tradeAssessment.id, w.placement));
    expect((await get(w.owner, `/readiness-profiles?organizationId=${w.org}`)).body.current[3].reviewStatus).toBe("awaiting_staff_review");
    await db.update(schema.tradeAssessment).set({ status: "scored" }).where(eq(schema.tradeAssessment.id, w.placement));
    const [exit] = await db.insert(schema.tradeAssessment).values({ enrollmentId: w.enrollment, kind: "exit", templateVersion: "t", status: "scored", assessedAt: new Date() }).returning();
    await db.insert(schema.capabilityScore).values([score(exit!.id, "B", 10, 12, "1.0000", "Strong"), score(exit!.id, "G", 8, 12, "1.0000", "Functional")]);
    const res = (await get(w.owner, `/readiness-profiles?organizationId=${w.org}`)).body;
    expect(res.current.find((a: Json) => a.area === "market_buyers").score).toBe(83.33);
    expect(res.earlier.find((a: Json) => a.area === "market_buyers").score).toBe(50);
  });

  it("take the insurance profile from the diagnostic, without scoring it", async () => {
    const template = latestDiagnosticTemplate();
    const [diagnostic] = await db.insert(schema.tradeAssessment).values({ enrollmentId: w.enrollment, kind: "diagnostic", templateVersion: template.version, status: "submitted", assessedAt: new Date() }).returning();
    const insurance = template.questions.filter((q) => template.storage[q.section] === "insurance_profile");
    expect(insurance.length).toBeGreaterThan(2);
    await db.insert(schema.assessmentResponse).values(insurance.slice(0, 2).map((q) => ({ assessmentId: diagnostic!.id, questionId: q.id, answer: { v: "yes" } })));
    const area = (await get(w.owner, `/readiness-profiles?organizationId=${w.org}`)).body.current.find((a: Json) => a.area === "insurance_risk");
    expect(area).toMatchObject({ score: null, classification: null, reviewStatus: "awaiting_ethiolife_review", assessmentId: diagnostic!.id });
    expect(area.evidenceCoverage).toBeCloseTo(2 / insurance.length, 2);
  });

  it("are private to the business and the staff who can reach it", async () => {
    expect((await get(w.stranger, `/readiness-profiles?organizationId=${w.org}`)).status).toBe(404);
    expect((await get(w.admin, `/readiness-profiles?organizationId=${w.org}`)).status).toBe(200);
  });
});
