import { and, eq } from "drizzle-orm";
import { schema } from "@entrust/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadPrincipal } from "../src/services/access";
import { requireAssessmentNotice, requirePlatformData } from "../src/services/mizan-consents";
import { callV1, cleanup, createOrganization, db, makeFile, PREFIX, signUp, type TestUser } from "./support";

describe("MIZAN data notice and data permission (#227)", () => {
  const w = {} as Record<"admin" | "assessor" | "quality" | "manager" | "owner" | "outsider", TestUser> & { entrust: string; sme: string; otherSme: string };
  const today = () => new Date().toISOString().slice(0, 10);
  const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);

  beforeAll(async () => {
    await cleanup();
    const names = ["admin", "assessor", "quality", "manager", "owner", "outsider"] as const;
    const users = await Promise.all(names.map(signUp));
    names.forEach((n, i) => (w[n] = users[i]!));
    w.entrust = await createOrganization(
      "mizan-consent-entrust",
      [
        [w.admin, "admin"],
        [w.assessor, "reviewer"],
        [w.quality, "quality"],
        [w.manager, "facilitator"],
      ],
      { smeProfile: false },
    );
    process.env.ENTRUST_ORG_ID = w.entrust;
    w.sme = await createOrganization("mizan-consent-sme", [[w.owner, "owner"]], { platform: "mizan" });
    w.otherSme = await createOrganization("mizan-consent-other", [[w.outsider, "owner"]], { platform: "mizan" });
  });

  afterAll(async () => {
    delete process.env.ENTRUST_ORG_ID;
    await cleanup();
  });

  const consents = (u: TestUser, org = w.sme) => callV1(u, "GET", `/mizan/smes/${org}/consents`);
  const accept = (u: TestUser, body: object, org = w.sme) => callV1(u, "POST", `/mizan/smes/${org}/consents`, body);
  const withdraw = (u: TestUser, kind: string, body: object = {}, org = w.sme) => callV1(u, "POST", `/mizan/smes/${org}/consents/${kind}/withdraw`, body);
  const notice = (body: { kinds: { kind: string; inForce: boolean }[] }, kind = "assessment_notice") => body.kinds.find((k) => k.kind === kind)!;

  it("serves the wording in use, which a Super Admin alone can reword", async () => {
    const res = await callV1(w.owner, "GET", "/mizan/notices");
    expect(res.status).toBe(200);
    expect(res.body.items.map((n: { kind: string }) => n.kind)).toEqual(["assessment_notice", "platform_data"]);
    expect(res.body.items[0].body).toContain("does not send it to lenders");

    const wording = { kind: "platform_data", version: `${PREFIX}2.0`, title: "Using your TRADE and CLEAR records", body: "New wording." };
    expect((await callV1(w.assessor, "POST", "/mizan/notices", wording)).status).toBe(403);
    const published = await callV1(w.admin, "POST", "/mizan/notices", wording);
    expect(published.status).toBe(201);
    expect((await callV1(w.admin, "POST", "/mizan/notices", wording)).status).toBe(409);
    const now = await callV1(w.owner, "GET", "/mizan/notices");
    expect(now.body.items[1].version).toBe(`${PREFIX}2.0`);
  });

  it("starts with nothing in force, so no assessment can start", async () => {
    const res = await consents(w.assessor);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ canRecord: true, canAccept: false, history: [] });
    expect(notice(res.body).inForce).toBe(false);
    await expect(requireAssessmentNotice(db, w.sme, "start an assessment")).rejects.toThrow("hasn't accepted the assessment notice");
  });

  it("lets the SME accept in MIZAN, and staff record a signed paper notice or one from TRADE", async () => {
    expect((await accept(w.assessor, { kind: "assessment_notice", method: "in_platform" })).status).toBe(403);
    expect((await accept(w.owner, { kind: "assessment_notice", method: "paper", signatoryName: "A", givenOn: today() })).status).toBe(403);
    expect((await accept(w.quality, { kind: "assessment_notice", method: "paper", signatoryName: "A", givenOn: today() })).status).toBe(403);

    // A paper notice needs its scan, and the scan must be the SME's own.
    const paper = { kind: "assessment_notice", method: "paper", signatoryName: "Hana Bekele", signatoryRole: "General manager", givenOn: daysAgo(3) };
    expect((await accept(w.assessor, paper)).status).toBe(422);
    const foreign = await makeFile(w.otherSme, w.assessor.id, "notice.pdf");
    expect((await accept(w.assessor, { ...paper, fileId: foreign })).body.error).toContain("isn't one of this SME's uploads");
    const scan = await makeFile(w.sme, w.assessor.id, "notice.pdf");
    const signed = await accept(w.assessor, { ...paper, fileId: scan });
    expect(signed.status).toBe(200);
    expect(notice(signed.body).inForce).toBe(true);
    expect(signed.body.history[0]).toMatchObject({ method: "paper", source: "mizan", signatoryName: "Hana Bekele", noticeVersion: "1.0", fileId: scan });
    expect((await accept(w.assessor, { ...paper, fileId: scan })).status).toBe(409);
    await expect(requireAssessmentNotice(db, w.sme, "start an assessment")).resolves.toMatchObject({ method: "paper" });

    // The data permission, given in TRADE.
    const trade = { kind: "platform_data", method: "trade", signatoryName: "Hana Bekele", noticeVersion: "trade-consent 1", givenOn: daysAgo(2) };
    expect((await accept(w.assessor, trade)).body.error).toContain("TRADE's reference");
    const fromTrade = await accept(w.assessor, { ...trade, sourceRef: "diagnostic-123" });
    expect(fromTrade.status).toBe(200);
    expect(fromTrade.body.history[0]).toMatchObject({ kind: "platform_data", method: "trade", source: "trade", sourceRef: "diagnostic-123" });
  });

  it("refuses a TRADE export without the data permission", async () => {
    await expect(requirePlatformData(db, w.otherSme)).rejects.toThrow("permission to use its TRADE and CLEAR records");
    await expect(requirePlatformData(db, w.sme)).resolves.toMatchObject({ kind: "platform_data" });
  });

  it("keeps every record when the SME withdraws and accepts again, and the latest one wins", async () => {
    expect((await withdraw(w.assessor, "assessment_notice")).body.error).toContain("name of the person");
    expect((await withdraw(w.assessor, "assessment_notice", { signatoryName: "Hana Bekele", givenOn: daysAgo(10) })).body.error).toContain("before the acceptance");
    const withdrawn = await withdraw(w.assessor, "assessment_notice", { signatoryName: "Hana Bekele", givenOn: daysAgo(1), reason: "Asked by phone" });
    expect(withdrawn.status).toBe(200);
    expect(notice(withdrawn.body).inForce).toBe(false);
    expect((await withdraw(w.assessor, "assessment_notice", { signatoryName: "Hana Bekele" })).status).toBe(409);
    await expect(requireAssessmentNotice(db, w.sme, "submit it")).rejects.toThrow("withdrew the assessment notice");

    // One dated before the withdrawal can't bring it back.
    const scan = await makeFile(w.sme, w.assessor.id, "old.pdf");
    const late = await accept(w.assessor, { kind: "assessment_notice", method: "paper", signatoryName: "Hana Bekele", givenOn: daysAgo(2), fileId: scan });
    expect(late.body.error).toContain("withdrew on");

    // The owner accepts again in MIZAN: the current wording, under their own name.
    const again = await accept(w.owner, { kind: "assessment_notice", method: "in_platform" });
    expect(again.status).toBe(200);
    expect(again.body.canAccept).toBe(true);
    expect(notice(again.body).inForce).toBe(true);
    const history = again.body.history.filter((h: { kind: string }) => h.kind === "assessment_notice");
    expect(history.map((h: { accepted: boolean; method: string }) => [h.accepted, h.method])).toEqual([
      [true, "in_platform"],
      [false, "in_platform"],
      [true, "paper"],
    ]);
    expect(history[0]).toMatchObject({ signatoryName: "owner", signatoryRole: "Owner", withdrawnAt: null });
    expect(history[2].withdrawnAt).not.toBeNull();
    expect(history[2].withdrawnBy).toBe("assessor");

    // The owner can withdraw for themselves too.
    const own = await withdraw(w.owner, "platform_data");
    expect(own.status).toBe(200);
    expect(notice(own.body, "platform_data").inForce).toBe(false);

    const audit = await db
      .select({ action: schema.auditLog.action })
      .from(schema.auditLog)
      .where(and(eq(schema.auditLog.organizationId, w.sme), eq(schema.auditLog.entityType, "mizan_consent")));
    expect(audit.filter((a) => a.action === "mizan.consent.accepted")).toHaveLength(3);
    expect(audit.filter((a) => a.action === "mizan.consent.withdrawn")).toHaveLength(2);
  });

  it("lets an Assessor upload a signed notice for any SME and open the scans MIZAN holds, but no other file", async () => {
    const upload = { organizationId: w.sme, originalName: "notice.pdf", contentType: "application/pdf", sizeBytes: 1024, sha256: "b".repeat(64) };
    expect((await callV1(w.assessor, "POST", "/files/upload-url", upload)).status).toBe(200);
    expect((await callV1(w.manager, "POST", "/files/upload-url", upload)).status).toBe(403);

    const [held] = await db.select({ fileId: schema.mizanConsent.fileId }).from(schema.mizanConsent).where(and(eq(schema.mizanConsent.organizationId, w.sme), eq(schema.mizanConsent.method, "paper")));
    expect((await callV1(w.quality, "GET", `/files/${held!.fileId}/download-url`)).status).toBe(200);
    const unrelated = await makeFile(w.sme, w.owner.id, "private.pdf");
    expect((await callV1(w.quality, "GET", `/files/${unrelated}/download-url`)).status).toBe(404);
    expect((await callV1(w.assessor, "GET", `/files/${unrelated}/download-url`)).status).toBe(404);
  });

  it("doesn't show an SME member another organisation's records, nor a Cohort Manager anyone's", async () => {
    expect((await consents(w.outsider)).status).toBe(404);
    expect((await accept(w.outsider, { kind: "assessment_notice", method: "in_platform" })).status).toBe(404);
    expect((await withdraw(w.outsider, "assessment_notice")).status).toBe(404);
    expect((await consents(w.manager)).status).toBe(404);
    expect((await consents(w.quality)).body).toMatchObject({ canRecord: false, canAccept: false });
    expect((await consents(w.assessor, `${PREFIX}no-such-org`)).status).toBe(404);
    // Quality reads, and its principal is not staff.
    expect((await loadPrincipal(db, w.quality.id)).staffRole).toBeNull();
  });
});
