import { and, eq } from "drizzle-orm";
import { schema } from "@entrust/db";
import { analyseYears, FINANCIAL_FIELDS, suggestRating, type FinancialYear } from "@entrust/mizan-engine";
import { configFingerprint, findCriterion, type MizanConfig } from "@entrust/mizan-rules";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { loadPrincipal } from "../src/services/access";
import { reviewBlockers } from "../src/services/mizan-access";
import { callV1, cleanup, createOrganization, db, signUp, type TestUser } from "./support";

// Lets a test publish a newer configuration, as a release would, without touching the real list.
const published = vi.hoisted(() => ({ newer: null as MizanConfig | null }));
vi.mock("@entrust/mizan-rules", async (importOriginal) => {
  const real = await importOriginal<typeof import("@entrust/mizan-rules")>();
  return {
    ...real,
    currentMizanConfig: () => published.newer ?? real.currentMizanConfig(),
    getMizanConfig: (version: string) => (published.newer?.version === version ? published.newer : real.getMizanConfig(version)),
  };
});

const { currentMizanConfig, allCriteria } = await vi.importActual<typeof import("@entrust/mizan-rules")>("@entrust/mizan-rules");

describe("MIZAN assessment lifecycle (#229)", () => {
  const w = {} as Record<"admin" | "assessor" | "assessor2" | "supporter" | "manager" | "quality" | "owner", TestUser> & {
    entrust: string;
    sme: string;
    sme2: string;
    noNotice: string;
    kenya: string;
  };
  const cfg = currentMizanConfig();
  let assessmentId = "";
  let smeId = "";

  const notice = (organizationId: string, accepted = true, givenAt = new Date()) =>
    db.insert(schema.mizanConsent).values({
      organizationId,
      kind: "assessment_notice",
      accepted,
      signatoryName: "Hana Bekele",
      method: "in_platform",
      noticeVersion: "1.0",
      givenAt,
      capturedBy: w.owner.id,
    });

  beforeAll(async () => {
    await cleanup();
    const names = ["admin", "assessor", "assessor2", "supporter", "manager", "quality", "owner"] as const;
    const users = await Promise.all(names.map(signUp));
    names.forEach((n, i) => (w[n] = users[i]!));
    w.entrust = await createOrganization(
      "mizan-life-entrust",
      [
        [w.admin, "admin"],
        [w.assessor, "reviewer"],
        [w.assessor2, "reviewer"],
        [w.supporter, "reviewer"],
        [w.manager, "facilitator"],
        [w.quality, "quality"],
      ],
      { smeProfile: false },
    );
    process.env.ENTRUST_ORG_ID = w.entrust;
    w.sme = await createOrganization("mizan-life-sme", [[w.owner, "owner"]], { platform: "mizan" });
    w.sme2 = await createOrganization("mizan-life-sme2", [], { platform: "mizan" });
    w.noNotice = await createOrganization("mizan-life-no-notice", [], { platform: "mizan" });
    w.kenya = await createOrganization("mizan-life-kenya", [], { platform: "mizan" });
    // MIZAN assesses Ethiopia and Kenya; the tests' SMEs are in QZ.
    for (const [org, country] of [[w.sme, "ET"], [w.sme2, "ET"], [w.noNotice, "ET"], [w.kenya, "KE"]] as const) {
      await db.update(schema.smeProfile).set({ country }).where(eq(schema.smeProfile.organizationId, org));
    }
    const [profile] = await db.select({ smeId: schema.smeProfile.smeId }).from(schema.smeProfile).where(eq(schema.smeProfile.organizationId, w.sme));
    smeId = profile!.smeId;
    for (const org of [w.sme, w.sme2, w.kenya]) await notice(org, true, new Date(Date.now() - 86_400_000));
    await db.insert(schema.mizanSupportLink).values({ organizationId: w.sme, userId: w.supporter.id, type: "training", recordedBy: w.admin.id });
  });

  afterAll(async () => {
    published.newer = null;
    delete process.env.ENTRUST_ORG_ID;
    await cleanup();
  });

  const create = (u: TestUser, body: object) => callV1(u, "POST", "/mizan/assessments", body);
  const get = (u: TestUser, id = assessmentId) => callV1(u, "GET", `/mizan/assessments/${id}`);
  const submit = (u: TestUser, id = assessmentId) => callV1(u, "POST", `/mizan/assessments/${id}/submit`);

  describe("starting one", () => {
    it("is refused without an accepted notice, to someone who supported the SME, and to anyone but an assessor, with the reason", async () => {
      const noNotice = await create(w.assessor, { organizationId: w.noNotice });
      expect(noNotice.status).toBe(422);
      expect(noNotice.body.error).toContain("hasn't accepted the assessment notice");

      const supporter = await create(w.supporter, { organizationId: w.sme });
      expect(supporter.status).toBe(403);
      expect(supporter.body.error).toContain("supported this SME");

      for (const u of [w.manager, w.quality, w.owner]) {
        const res = await create(u, { organizationId: w.sme });
        expect(res.status).toBe(403);
        expect(res.body.error).toContain("Only an Assessor or Super Admin");
      }
      expect((await create(w.assessor, { organizationId: "test-api-no-such-org" })).status).toBe(404);
    });

    it("pins the configuration, its fingerprint, the engine and the country module, and numbers it from the SME ID", async () => {
      const res = await create(w.assessor, { organizationId: w.sme });
      expect(res.status).toBe(201);
      assessmentId = res.body.id;
      expect(res.body).toMatchObject({
        assessmentNo: `${smeId}-A1`,
        status: "draft",
        kind: "initial",
        configVersion: cfg.version,
        configFingerprint: await configFingerprint(cfg),
        methodology: cfg.methodology,
        engineVersion: expect.stringMatching(/^mizan-engine /),
        countryModule: "MIZAN-ET v0.1-draft",
        currency: "ETB",
        canEdit: true,
        canSubmit: false,
        assessor: { id: w.assessor.id, name: "assessor" },
      });
      expect(res.body.computation.frozen).toBe(false);
      expect(res.body.computation.result.status).toBe("INCOMPLETE");

      const kenya = await create(w.admin, { organizationId: w.kenya, currency: "usd" });
      expect(kenya.body).toMatchObject({ countryModule: "MIZAN-KE v0.1-draft", currency: "USD" });
    });

    it("refuses a second open assessment for the same SME", async () => {
      const res = await create(w.assessor2, { organizationId: w.sme });
      expect(res.status).toBe(409);
      expect(res.body.error).toContain(`${smeId}-A1 is still open (draft)`);
    });

    it("keeps the configuration it pinned after a newer one is published", async () => {
      published.newer = { ...cfg, version: "9.9.9-test", effectiveFrom: "2099-01-01" };
      try {
        const newer = await create(w.assessor, { organizationId: w.sme2 });
        expect(newer.body.configVersion).toBe("9.9.9-test");
        expect(newer.body.configFingerprint).not.toBe(await configFingerprint(cfg));

        const old = await get(w.assessor);
        expect(old.body).toMatchObject({ configVersion: cfg.version, configFingerprint: await configFingerprint(cfg) });
        expect(old.body.computation.result.configVersion).toBe(cfg.version);
        // Nothing can move it: not the API, not the database.
        expect((await callV1(w.assessor, "PATCH", `/mizan/assessments/${assessmentId}`, { configVersion: "9.9.9-test" })).status).toBe(400);
        await expect(db.update(schema.mizanAssessment).set({ configVersion: "9.9.9-test" }).where(eq(schema.mizanAssessment.id, assessmentId))).rejects.toThrow();
        await expect(db.update(schema.mizanAssessment).set({ configFingerprint: "x" }).where(eq(schema.mizanAssessment.id, assessmentId))).rejects.toThrow();
      } finally {
        published.newer = null;
      }
    });
  });

  describe("submitting", () => {
    const mandatory = allCriteria(cfg).filter((c) => c.criterion.mandatory).map((c) => c.criterion.id);
    const year: Omit<FinancialYear, "fiscalYear"> = Object.fromEntries(FINANCIAL_FIELDS.map((f) => [f.key, null])) as Omit<FinancialYear, "fiscalYear">;
    Object.assign(year, { revenue: 1000, cash: 100, payables: 100, totalAssets: 400, equity: 300 });

    const blockers = async () => {
      const res = await submit(w.assessor);
      expect(res.status).toBe(422);
      return res.body.error as string;
    };

    it("is blocked by each missing item in turn, named", async () => {
      expect(await blockers()).toContain(`Rate every mandatory criterion: ${mandatory.join(", ")}.`);

      await db.insert(schema.mizanFinancialYear).values({ assessmentId, fiscalYear: "2025", statementBasis: "management", data: year });
      // Each rated at its ratio suggestion where it has one, so only the departure made below needs a reason.
      const ratios = analyseYears([{ ...year, fiscalYear: "2025" }])[0]!.ratios;
      const rating = (id: string) => String(suggestRating(findCriterion(cfg, id)!.criterion, ratios, { negativeEquity: false }) ?? 3) as "3";
      await db.insert(schema.mizanRating).values(mandatory.map((criterionId) => ({ assessmentId, criterionId, rating: rating(criterionId) })));
      let error = await blockers();
      expect(error).not.toContain("Rate every mandatory");
      expect(error).toContain(`Give an evidence level for: ${mandatory.join(", ")}.`);

      await db.update(schema.mizanRating).set({ evidence: "E3" }).where(eq(schema.mizanRating.assessmentId, assessmentId));
      error = await blockers();
      expect(error).not.toContain("evidence level");
      expect(error).toContain("Resolve every gate (pass or fail): G1");

      await db.insert(schema.mizanGateResult).values(cfg.gates.map((g) => ({ assessmentId, gateId: g.id, status: "pass" as const })));
      // D2.1 is rated away from what the current ratio suggests, with no reason.
      const d21 = findCriterion(cfg, "D2.1")!.criterion;
      const suggested = suggestRating(d21, ratios)!;
      const departing = String((suggested + 2) % 5) as "0";
      await db.update(schema.mizanRating).set({ rating: departing }).where(and(eq(schema.mizanRating.assessmentId, assessmentId), eq(schema.mizanRating.criterionId, "D2.1")));
      error = await blockers();
      expect(error).not.toContain("gate");
      expect(error).toContain(`Write why these ratings differ from the interim ratio suggestion: D2.1 (rated ${departing}, suggestion ${suggested}).`);

      await db.update(schema.mizanRating).set({ note: "Overdraft cleared after year end." }).where(and(eq(schema.mizanRating.assessmentId, assessmentId), eq(schema.mizanRating.criterionId, "D2.1")));
      const ready = await get(w.assessor);
      expect(ready.body).toMatchObject({ submissionBlockers: [], canSubmit: true });
      expect(ready.body.departures).toEqual([{ criterionId: "D2.1", rating: Number(departing), suggested, explained: true }]);
    });

    it("is blocked while the SME's notice is withdrawn, keeping the work", async () => {
      await notice(w.sme, false);
      const res = await submit(w.assessor);
      expect(res.status).toBe(422);
      expect(res.body.error).toContain("withdrew the assessment notice");
      expect((await get(w.assessor)).body.computation.result.total).not.toBeNull();
      await notice(w.sme, true, new Date(Date.now() + 1000));
    });

    it("is for the assessor or a Super Admin only", async () => {
      expect((await submit(w.assessor2)).status).toBe(403);
      expect((await submit(w.quality)).status).toBe(403);
    });

    it("locks the assessment", async () => {
      const res = await submit(w.assessor);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ status: "in_review", canEdit: false, canSubmit: false });
      expect(res.body.submittedAt).not.toBeNull();
    });
  });

  describe("once locked", () => {
    it("rejects every edit", async () => {
      for (const u of [w.assessor, w.admin]) {
        const patch = await callV1(u, "PATCH", `/mizan/assessments/${assessmentId}`, { topCustomerShare: 0.4 });
        expect(patch.status).toBe(409);
        expect(patch.body.error).toContain("is in review, so it is locked");
        expect((await submit(u)).status).toBe(409);
      }
    });

    it("can be edited again once returned, by its assessor or a Super Admin only", async () => {
      await db.update(schema.mizanAssessment).set({ status: "returned" }).where(eq(schema.mizanAssessment.id, assessmentId));
      expect((await callV1(w.assessor2, "PATCH", `/mizan/assessments/${assessmentId}`, { monthsOperating: 30 })).status).toBe(403);
      const res = await callV1(w.admin, "PATCH", `/mizan/assessments/${assessmentId}`, { monthsOperating: 30, topCustomerShare: 0.25 });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ monthsOperating: 30, topCustomerShare: 0.25, canEdit: true });
    });

    it("keeps anyone who worked on it from reviewing it, not only its assessor", async () => {
      const [a] = await db.select().from(schema.mizanAssessment).where(eq(schema.mizanAssessment.id, assessmentId));
      // The Super Admin changed it above, so they aren't a second person for it; another Assessor is.
      expect(await reviewBlockers(db, await loadPrincipal(db, w.admin.id), a!)).toEqual(["You worked on this assessment, so someone else must review it."]);
      expect(await reviewBlockers(db, await loadPrincipal(db, w.assessor2.id), a!)).toEqual([]);
    });

    it("checks the assessor's own support relationships when a Super Admin submits their work", async () => {
      const [link] = await db
        .insert(schema.mizanSupportLink)
        .values({ organizationId: w.sme, userId: w.assessor.id, type: "advisory", recordedBy: w.admin.id })
        .returning({ id: schema.mizanSupportLink.id });
      try {
        const res = await submit(w.admin);
        expect(res.status).toBe(403);
        expect(res.body.error).toContain("Its assessor is recorded as having supported this SME");
      } finally {
        await db.delete(schema.mizanSupportLink).where(eq(schema.mizanSupportLink.id, link!.id));
      }
    });
  });

  describe("reading", () => {
    it("lists for MIZAN staff, and shows nothing to the SME or a Cohort Manager", async () => {
      const list = await callV1(w.quality, "GET", `/mizan/assessments?organizationId=${w.sme}`);
      expect(list.status).toBe(200);
      expect(list.body.items.map((i: { assessmentNo: string }) => i.assessmentNo)).toEqual([`${smeId}-A1`]);
      expect((await callV1(w.assessor, "GET", "/mizan/assessments?mine=true&status=draft")).body.items.map((i: { organizationId: string }) => i.organizationId)).toEqual([w.sme2]);
      expect((await callV1(w.manager, "GET", "/mizan/assessments")).status).toBe(403);
      expect((await get(w.owner)).status).toBe(404);
      expect((await get(w.manager)).status).toBe(404);
    });

    it("reports financial years it can't order as something to fix, instead of failing", async () => {
      const [kenya] = await db.select({ id: schema.mizanAssessment.id }).from(schema.mizanAssessment).where(eq(schema.mizanAssessment.organizationId, w.kenya));
      const data = Object.fromEntries(FINANCIAL_FIELDS.map((f) => [f.key, null])) as Omit<FinancialYear, "fiscalYear">;
      await db.insert(schema.mizanFinancialYear).values({ assessmentId: kenya!.id, fiscalYear: "last year", statementBasis: "management", data });
      const res = await get(w.admin, kenya!.id);
      expect(res.status).toBe(200);
      expect(res.body.submissionBlockers[0]).toContain("A fiscal year needs digits to put it in order");
    });

    it("keeps every change in the audit log and the assessment's history", async () => {
      const events = await db
        .select({ type: schema.mizanAssessmentEvent.type })
        .from(schema.mizanAssessmentEvent)
        .where(eq(schema.mizanAssessmentEvent.assessmentId, assessmentId))
        .orderBy(schema.mizanAssessmentEvent.occurredAt);
      expect(events.map((e) => e.type)).toEqual(["created", "submitted", "context_saved"]);
      const audit = await db
        .select({ action: schema.auditLog.action })
        .from(schema.auditLog)
        .where(and(eq(schema.auditLog.entityType, "mizan_assessment"), eq(schema.auditLog.entityId, assessmentId)));
      expect(audit.map((a) => a.action).sort()).toEqual(["mizan.assessment.context_saved", "mizan.assessment.created", "mizan.assessment.submitted"]);
    });
  });
});
