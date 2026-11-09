import { eq } from "drizzle-orm";
import { schema } from "@entrust/db";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PREFIX, callV1, cleanup, createOrganization, db, makeFile, signUp, type Json, type TestUser } from "./support";

// Output attachments and review, evidence on action items, and learning resources (#195).

vi.mock("@entrust/jobs", async (importOriginal) => ({ ...(await importOriginal<typeof import("@entrust/jobs")>()), enqueue: vi.fn(async () => "job") }));

const w = {} as { owner: TestUser; stranger: TestUser; admin: TestUser; assessor: TestUser; org: string; otherOrg: string; entrust: string; draft: string; submitted: string; item: string };
const get = (u: TestUser | null, path: string) => callV1(u, "GET", `/trade${path}`);
const post = (u: TestUser | null, path: string, body?: unknown) => callV1(u, "POST", `/trade${path}`, body);
const del = (u: TestUser | null, path: string) => callV1(u, "DELETE", `/trade${path}`);
const ok = (res: { status: number; body: Json }) => {
  expect(res.status, JSON.stringify(res.body).slice(0, 400)).toBeLessThan(300);
  return res.body;
};

beforeAll(async () => {
  process.env.FILE_STORAGE = "memory";
  await cleanup();
  const [owner, stranger, admin, assessor] = (await Promise.all(["op-owner", "op-stranger", "op-admin", "op-assessor"].map(signUp))) as [TestUser, TestUser, TestUser, TestUser];
  Object.assign(w, { owner, stranger, admin, assessor });
  w.entrust = await createOrganization("op-entrust", [[admin, "admin"], [assessor, "reviewer"]], { smeProfile: false });
  process.env.ENTRUST_ORG_ID = w.entrust;
  w.org = await createOrganization("op-sme", [[owner, "owner"]], { platform: "trade" });
  w.otherOrg = await createOrganization("op-other", [[stranger, "owner"]], { platform: "trade" });
  const [program] = await db.insert(schema.program).values({ name: `${PREFIX}op-program` }).returning();
  const [cohort] = await db.insert(schema.cohort).values({ programId: program!.id, name: `${PREFIX}op-cohort`, country: "ET" }).returning();
  const [enrollment] = await db.insert(schema.enrollment).values({ cohortId: cohort!.id, organizationId: w.org, status: "active" }).returning();
  await db.insert(schema.cohortStaff).values({ cohortId: cohort!.id, userId: assessor.id });
  const [draft, submitted] = await db
    .insert(schema.worksheetVersion)
    .values([
      { enrollmentId: enrollment!.id, worksheetId: "m05-buyer-research-sheet", moduleId: "M05", version: 2, status: "draft" },
      { enrollmentId: enrollment!.id, worksheetId: "m05-buyer-research-sheet", moduleId: "M05", version: 1, status: "submitted", submittedAt: new Date() },
    ])
    .returning();
  w.draft = draft!.id;
  w.submitted = submitted!.id;
  const [item] = await db.insert(schema.actionItem).values({ organizationId: w.org, description: "Register with customs", responsible: "Owner" }).returning();
  w.item = item!.id;
});

afterAll(async () => {
  delete process.env.ENTRUST_ORG_ID;
  await cleanup();
});

describe("attachments on an output", () => {
  it("takes the business's own file on a draft, once", async () => {
    const mine = await makeFile(w.org, w.owner.id, "costing.pdf");
    const details = ok(await post(w.owner, `/worksheet-versions/${w.draft}/attachments`, { fileId: mine, description: "Costing sheet" }));
    expect(details.attachments).toHaveLength(1);
    expect(details.attachments[0]).toMatchObject({ description: "Costing sheet", file: { name: "costing.pdf", scanStatus: "unscanned" } });
    expect((await post(w.owner, `/worksheet-versions/${w.draft}/attachments`, { fileId: mine })).status).toBe(409);
    expect(ok(await get(w.owner, `/worksheet-versions/${w.draft}/details`)).review.status).toBe("pending");
  });

  it("refuses another business's file, a flagged file and a submitted version", async () => {
    const theirs = await makeFile(w.otherOrg, w.stranger.id, "theirs.pdf");
    expect((await post(w.owner, `/worksheet-versions/${w.draft}/attachments`, { fileId: theirs })).status).toBe(404);
    const bad = await makeFile(w.org, w.owner.id, "bad.pdf");
    await db.update(schema.file).set({ scanStatus: "infected" }).where(eq(schema.file.id, bad));
    expect((await post(w.owner, `/worksheet-versions/${w.draft}/attachments`, { fileId: bad })).status).toBe(422);
    const another = await makeFile(w.org, w.owner.id, "late.pdf");
    expect((await post(w.owner, `/worksheet-versions/${w.submitted}/attachments`, { fileId: another })).status).toBe(409);
  });

  it("lets the business remove one from a draft, and keeps others out", async () => {
    const [{ id: attachmentId }] = ok(await get(w.owner, `/worksheet-versions/${w.draft}/details`)).attachments;
    expect((await del(w.stranger, `/worksheet-versions/${w.draft}/attachments/${attachmentId}`)).status).toBe(404);
    expect((await get(w.stranger, `/worksheet-versions/${w.draft}/details`)).status).toBe(404);
    expect(ok(await del(w.owner, `/worksheet-versions/${w.draft}/attachments/${attachmentId}`)).attachments).toEqual([]);
  });
});

describe("reviewing an output", () => {
  it("is for staff on a submitted version, and sending it back needs comments", async () => {
    expect((await post(w.owner, `/worksheet-versions/${w.submitted}/review`, { status: "reviewed" })).status).toBe(403);
    expect((await post(w.admin, `/worksheet-versions/${w.draft}/review`, { status: "reviewed" })).status).toBe(409);
    expect((await post(w.admin, `/worksheet-versions/${w.submitted}/review`, { status: "changes_requested" })).status).toBe(422);
    ok(await post(w.assessor, `/worksheet-versions/${w.submitted}/review`, { status: "under_review" }));
    expect(ok(await get(w.owner, `/worksheet-versions/${w.submitted}/details`)).review.status).toBe("under_review");
  });

  it("tells the business what was decided", async () => {
    const sent = ok(await post(w.assessor, `/worksheet-versions/${w.submitted}/review`, { status: "changes_requested", comments: "Add the buyer's website" }));
    expect(sent.review).toMatchObject({ status: "changes_requested", comments: "Add the buyer's website" });
    const told = await db.select().from(schema.notification).where(eq(schema.notification.userId, w.owner.id));
    expect(told.at(-1)).toMatchObject({ title: expect.stringContaining("needs changes"), body: "Add the buyer's website" });
    expect(ok(await post(w.assessor, `/worksheet-versions/${w.submitted}/review`, { status: "reviewed" })).review.status).toBe("reviewed");
  });
});

describe("evidence on an action item", () => {
  it("takes the business's own files and lists them with what they show", async () => {
    const proof = await makeFile(w.org, w.owner.id, "licence.pdf");
    const added = ok(await post(w.owner, `/action-plan/items/${w.item}/evidence`, { fileId: proof, description: "Customs registration certificate" }));
    expect(added.items).toHaveLength(1);
    expect(added.items[0]).toMatchObject({ description: "Customs registration certificate", file: { name: "licence.pdf" } });
    expect((await post(w.owner, `/action-plan/items/${w.item}/evidence`, { fileId: proof })).status).toBe(409);
    const theirs = await makeFile(w.otherOrg, w.stranger.id, "theirs.pdf");
    expect((await post(w.owner, `/action-plan/items/${w.item}/evidence`, { fileId: theirs })).status).toBe(404);
    expect((await get(w.stranger, `/action-plan/items/${w.item}/evidence`)).status).toBe(404);
    expect((await get(w.assessor, `/action-plan/items/${w.item}/evidence`)).status).toBe(200);
    expect((await post(w.assessor, `/action-plan/items/${w.item}/evidence`, { fileId: proof })).status).toBe(403);
    expect(ok(await del(w.owner, `/action-plan/items/${w.item}/evidence/${added.items[0].id}`)).items).toEqual([]);
  });
});

describe("learning resources", () => {
  let learnerResource: string;
  let staffResource: string;

  it("are added by a Super Admin or Cohort Manager, from Entrust's own files", async () => {
    const guide = await makeFile(w.entrust, w.admin.id, "m04-template.pdf");
    const pack = await makeFile(w.entrust, w.admin.id, "m04-facilitator-pack.pdf");
    const smeFile = await makeFile(w.org, w.owner.id, "sme.pdf");
    expect((await post(w.assessor, "/modules/M04/resources", { name: "x", fileId: guide, resourceType: "guide", accessLevel: "learner" })).status).toBe(403);
    expect((await post(w.admin, "/modules/M04/resources", { name: "x", fileId: smeFile, resourceType: "guide", accessLevel: "learner" })).status).toBe(404);
    expect((await post(w.admin, "/modules/M99/resources", { name: "x", fileId: guide, resourceType: "guide", accessLevel: "learner" })).status).toBe(404);
    learnerResource = ok(await post(w.admin, "/modules/M04/resources", { name: "Costing template", fileId: guide, resourceType: "template", accessLevel: "learner", lessonId: "lesson-5" })).id;
    staffResource = ok(await post(w.admin, "/modules/M04/resources", { name: "Facilitator pack", fileId: pack, resourceType: "guide", accessLevel: "staff" })).id;
  });

  it("show a learner only the learner resources, and staff all of them", async () => {
    expect(ok(await get(w.owner, "/modules/M04/resources")).items.map((r: Json) => r.name)).toEqual(["Costing template"]);
    expect(ok(await get(w.admin, "/modules/M04/resources")).items.map((r: Json) => r.name)).toEqual(["Costing template", "Facilitator pack"]);
    // A person with no TRADE access sees nothing of the module.
    const nobody = await signUp("op-nobody");
    expect((await get(nobody, "/modules/M04/resources")).status).toBe(404);
  });

  it("download for a learner for a learner resource, and never a staff one", async () => {
    const link = ok(await get(w.owner, `/resources/${learnerResource}/download-url`));
    expect(link.fileName).toBe("m04-template.pdf");
    expect(link.downloadUrl).toContain("m04-template.pdf");
    expect((await get(w.owner, `/resources/${staffResource}/download-url`)).status).toBe(404);
    expect((await get(w.stranger, `/resources/${learnerResource}/download-url`)).status).toBe(200);
    expect((await get(w.admin, `/resources/${staffResource}/download-url`)).status).toBe(200);
  });

  it("can be archived, after which no one downloads it", async () => {
    expect((await del(w.assessor, `/resources/${learnerResource}`)).status).toBe(403);
    ok(await del(w.admin, `/resources/${learnerResource}`));
    expect((await get(w.owner, `/resources/${learnerResource}/download-url`)).status).toBe(404);
    expect(ok(await get(w.owner, "/modules/M04/resources")).items).toEqual([]);
    expect(ok(await get(w.admin, "/modules/M04/resources?includeArchived=true")).items.find((r: Json) => r.id === learnerResource).archived).toBe(true);
  });
});
