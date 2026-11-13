import { randomUUID } from "node:crypto";
import { schema } from "@entrust/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadPrincipal } from "../src/services/access";
import { assessBlockers, canReadReports, reviewBlockers } from "../src/services/mizan-access";
import { callV1, cleanup, createOrganization, db, signUp, type TestUser } from "./support";

describe("MIZAN access and roles (#223)", () => {
  const w = {} as Record<"admin" | "assessor" | "assessor2" | "manager" | "quality" | "owner" | "outsider" | "sponsor", TestUser> & {
    entrust: string;
    sme: string;
    otherSme: string;
    noGrantSme: string;
  };

  beforeAll(async () => {
    await cleanup();
    const names = ["admin", "assessor", "assessor2", "manager", "quality", "owner", "outsider", "sponsor"] as const;
    const users = await Promise.all(names.map(signUp));
    names.forEach((n, i) => (w[n] = users[i]!));
    w.entrust = await createOrganization(
      "mizan-entrust",
      [
        [w.admin, "admin"],
        [w.assessor, "reviewer"],
        [w.assessor2, "reviewer"],
        [w.manager, "facilitator"],
        [w.quality, "quality"],
      ],
      { smeProfile: false },
    );
    process.env.ENTRUST_ORG_ID = w.entrust;
    w.sme = await createOrganization("mizan-sme", [[w.owner, "owner"]], { platform: "mizan" });
    w.otherSme = await createOrganization("mizan-other-sme", [[w.outsider, "owner"]], { platform: "mizan" });
    w.noGrantSme = await createOrganization("mizan-no-grant", [[w.owner, "member"]], { platform: "trade" });
    await db.insert(schema.mizanSupportLink).values({ organizationId: w.sme, userId: w.assessor2.id, type: "training", recordedBy: w.admin.id });
  });

  afterAll(async () => {
    delete process.env.ENTRUST_ORG_ID;
    await cleanup();
  });

  const access = async (u: TestUser) => {
    const res = await callV1(u, "GET", "/mizan/access");
    expect(res.status).toBe(200);
    return res.body;
  };

  describe("GET /v1/mizan/access", () => {
    it("gives a Super Admin everything and an Assessor everything but support relationships, notices and the audit trail", async () => {
      expect((await access(w.admin)).actions).toEqual(["read_smes", "manage_smes", "manage_support", "manage_notices", "assess", "review", "read_reports", "read_dashboard", "read_audit"]);
      expect(await access(w.assessor)).toMatchObject({ staff: true, staffRole: "reviewer", actions: ["read_smes", "manage_smes", "assess", "review", "read_reports", "read_dashboard"] });
    });

    it("gives a Cohort Manager nothing and Quality reading only", async () => {
      expect(await access(w.manager)).toMatchObject({ staff: false, staffRole: "facilitator", actions: [] });
      expect(await access(w.quality)).toMatchObject({ staff: true, quality: true, actions: ["read_smes", "read_reports", "read_dashboard", "read_audit"] });
    });

    it("gives an SME member only their own organisations with MIZAN access", async () => {
      expect(await access(w.owner)).toMatchObject({ staff: false, actions: [], reportOrganizations: [{ id: w.sme, name: "mizan-sme" }] });
      expect((await access(w.sponsor)).reportOrganizations).toEqual([]);
    });

    it("needs a sign-in", async () => {
      expect((await callV1(null, "GET", "/mizan/access")).status).toBe(401);
    });
  });

  describe("who may assess and review", () => {
    const principal = (u: TestUser) => loadPrincipal(db, u.id);

    it("lets an Assessor assess, but not an SME they supported, and never a Cohort Manager", async () => {
      expect(await assessBlockers(db, await principal(w.assessor), w.sme)).toEqual([]);
      expect(await assessBlockers(db, await principal(w.assessor2), w.sme)).toEqual([
        "You are recorded as having supported this SME, so someone else must assess it (control C-1).",
      ]);
      expect(await assessBlockers(db, await principal(w.manager), w.sme)).toEqual(["Only an Assessor or Super Admin can assess an SME."]);
    });

    it("needs a second person to review: not the assessor, not a supporter, not Quality", async () => {
      const file = { id: randomUUID(), organizationId: w.sme, assessorUserId: w.assessor.id };
      expect(await reviewBlockers(db, await principal(w.admin), file)).toEqual([]);
      expect(await reviewBlockers(db, await principal(w.assessor), file)).toEqual(["You assessed this SME, so someone else must review it."]);
      expect(await reviewBlockers(db, await principal(w.assessor2), file)).toEqual([
        "You are recorded as having supported this SME, so someone else must review it (control C-1).",
      ]);
      expect(await reviewBlockers(db, await principal(w.quality), file)).toEqual(["Only an Assessor or Super Admin can review an assessment."]);
    });

    it("counts an ended support relationship too", async () => {
      await db.insert(schema.mizanSupportLink).values({ organizationId: w.otherSme, userId: w.admin.id, type: "advisory", endedAt: new Date() });
      expect(await assessBlockers(db, await principal(w.admin), w.otherSme)).toHaveLength(1);
    });
  });

  describe("who may read an SME's reports", () => {
    it("is staff who read reports, and the SME itself while it has MIZAN access", async () => {
      expect(await canReadReports(db, await loadPrincipal(db, w.quality.id), w.sme)).toBe(true);
      expect(await canReadReports(db, await loadPrincipal(db, w.owner.id), w.sme)).toBe(true);
      expect(await canReadReports(db, await loadPrincipal(db, w.owner.id), w.noGrantSme)).toBe(false);
      expect(await canReadReports(db, await loadPrincipal(db, w.outsider.id), w.sme)).toBe(false);
      expect(await canReadReports(db, await loadPrincipal(db, w.manager.id), w.sme)).toBe(false);
    });
  });
});
