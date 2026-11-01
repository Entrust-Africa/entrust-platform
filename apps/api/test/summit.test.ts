import { randomUUID } from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import { schema } from "@entrust/db";
import { visibleQuestions, type Answers, type FormQuestion } from "@entrust/forms";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { callV1, cleanup, COUNTRY, createOrganization, db, PREFIX, signUp, type Json, type TestUser } from "./support";

// The real application form is still a draft until Entrust confirms the questions, and a period needs a published
// one. These tests publish a copy of it.
vi.mock("../src/services/summit-forms", async (importOriginal) => {
  const original = await importOriginal<typeof import("../src/services/summit-forms")>();
  const published = { ...(original.findApplicationTemplate("0.1.0") as object), status: "published" } as NonNullable<
    ReturnType<typeof original.findApplicationTemplate>
  >;
  return {
    ...original,
    findApplicationTemplate: (version: string) => (version === published.version ? published : original.findApplicationTemplate(version)),
    latestPublishedTemplate: () => published,
  };
});

// Organisation A is the applicant the main flow follows. Organisation B is in a country the period doesn't take.
// "entrust" is the Entrust team.
const w = {} as {
  ownerA: TestUser; memberA: TestUser; ownerB: TestUser; ownerC: TestUser; ownerD: TestUser; ownerE: TestUser; outsider: TestUser;
  admin: TestUser; facilitator: TestUser; reviewer: TestUser; reviewer2: TestUser; strayOwner: TestUser;
  orgA: string; orgB: string; orgC: string; orgD: string; orgE: string; entrust: string;
  periodId: string; appA: string; appC: string; appD: string;
};

const S = "/summit";
const call = (user: TestUser | null, method: string, path: string, body?: unknown) => callV1(user, method, `${S}${path}`, body);

const WINDOW = { opensAt: "2030-01-01T00:00:00Z", closesAt: "2030-02-01T00:00:00Z" };
const OPEN = "2030-01-15T10:00:00Z";

let form: { questions: FormQuestion[] };

/** A valid answer to a question: the first option, yes, some text, or the least number. */
function answerFor(q: FormQuestion) {
  switch (q.type) {
    case "single_choice":
      return q.options?.[0]?.value as string;
    case "multiple_choice":
      return [q.options?.[0]?.value as string];
    case "yes_no":
      return "yes";
    case "short_text":
    case "long_text":
      return "An answer";
    case "number":
      return q.min ?? 1;
    case "money":
      return { amount: 1000, currency: "USD" };
    case "date":
      return "2026-10-01";
    case "list":
      return ["one", "two"];
  }
}

/** Answers to every question the form shows, with the given ones kept. */
function completeAnswers(overrides: Answers = {}): Answers {
  let answers: Answers = { ...overrides };
  for (let pass = 0; pass < 6; pass++) {
    for (const q of visibleQuestions(form as never, answers)) {
      if (answers[q.id] === undefined) answers = { ...answers, [q.id]: answerFor(q) as never };
    }
  }
  return answers;
}

async function makeFile(organizationId: string, userId: string, name = "document.pdf") {
  const [row] = await db
    .insert(schema.file)
    .values({
      organizationId,
      uploaderUserId: userId,
      storageKey: `orgs/${organizationId}/${randomUUID()}/${name}`,
      originalName: name,
      contentType: "application/pdf",
      sizeBytes: 1000,
      sha256: "a".repeat(64),
    })
    .returning();
  return row!.id;
}

const attach = (user: TestUser, id: string, fileId: string, kind: string) => call(user, "POST", `/applications/${id}/documents`, { fileId, kind });
const detail = (user: TestUser | null, id: string) => call(user, "GET", `/applications/${id}`);

beforeAll(async () => {
  await cleanup();
  const names = ["owner-a", "member-a", "owner-b", "owner-c", "owner-d", "owner-e", "outsider", "admin", "facilitator", "reviewer", "reviewer2", "stray-owner"];
  const users = await Promise.all(names.map(signUp));
  const [ownerA, memberA, ownerB, ownerC, ownerD, ownerE, outsider, admin, facilitator, reviewer, reviewer2, strayOwner] = users;
  Object.assign(w, { ownerA, memberA, ownerB, ownerC, ownerD, ownerE, outsider, admin, facilitator, reviewer, reviewer2, strayOwner });
  w.orgA = await createOrganization("org-a", [[ownerA!, "owner"], [memberA!, "member"]]);
  w.orgB = await createOrganization("org-b", [[ownerB!, "owner"]]);
  w.orgC = await createOrganization("org-c", [[ownerC!, "owner"]]);
  w.orgD = await createOrganization("org-d", [[ownerD!, "owner"]]);
  w.orgE = await createOrganization("org-e", [[ownerE!, "owner"]]);
  // Organisation B is in a country the period doesn't take.
  await db.update(schema.smeProfile).set({ country: "ET" }).where(eq(schema.smeProfile.organizationId, w.orgB));
  w.entrust = await createOrganization(
    "entrust",
    [[admin!, "admin"], [facilitator!, "facilitator"], [reviewer!, "reviewer"], [reviewer2!, "reviewer"], [strayOwner!, "owner"]],
    { smeProfile: false },
  );
  process.env.ENTRUST_ORG_ID = w.entrust;
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(OPEN);
});

afterAll(async () => {
  vi.useRealTimers();
  delete process.env.ENTRUST_ORG_ID;
  await cleanup();
});

describe("signed out", () => {
  it("is refused everywhere except the public period, before the request is even read", async () => {
    const id = randomUUID();
    for (const [method, path, body] of [
      ["GET", "/periods"],
      ["POST", "/periods", { nonsense: true }],
      ["PATCH", `/periods/${id}`, {}],
      ["GET", "/forms/0.1.0"],
      ["GET", "/applications"],
      ["POST", "/applications", { nonsense: true }],
      ["GET", `/applications/${id}`],
      ["PATCH", `/applications/${id}/answers`, {}],
      ["POST", `/applications/${id}/documents`, {}],
      ["DELETE", `/applications/${id}/documents/${id}`],
      ["GET", `/applications/${id}/documents/${id}/download-url`],
      ["POST", `/applications/${id}/submit`],
      ["POST", `/applications/${id}/withdraw`, {}],
      ["GET", "/officers"],
      ["PUT", `/applications/${id}/officer`, {}],
      ["POST", `/applications/${id}/eligibility-exceptions`, {}],
    ] as const) {
      const res = await call(null, method, path, body);
      expect([method, path, res.status, res.body.code]).toEqual([method, path, 401, "unauthenticated"]);
    }
    expect((await call(null, "GET", "/period")).status).toBe(200);
  });
});

describe("application periods", () => {
  it("lets only a super administrator open one, and only on a published form", async () => {
    const body = { name: `${PREFIX}summit`, ...WINDOW, countries: [COUNTRY.toLowerCase(), "ke"] };
    for (const user of [w.facilitator, w.reviewer, w.ownerA, w.strayOwner]) {
      expect((await call(user, "POST", "/periods", body)).status).toBe(403);
    }
    const created = await call(w.admin, "POST", "/periods", body);
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    expect(created.body).toMatchObject({ name: `${PREFIX}summit`, countries: [COUNTRY, "KE"], templateVersion: "0.1.0", rulesVersion: "1.0.0", state: "open" });
    w.periodId = created.body.id;

    // Periods don't overlap, close after they open, and name countries by their two-letter codes.
    expect((await call(w.admin, "POST", "/periods", { ...body, name: `${PREFIX}other`, opensAt: "2030-01-20T00:00:00Z", closesAt: "2030-03-01T00:00:00Z" })).status).toBe(422);
    expect((await call(w.admin, "POST", "/periods", { ...body, name: `${PREFIX}other`, opensAt: "2031-02-01T00:00:00Z", closesAt: "2031-01-01T00:00:00Z" })).status).toBe(422);
    expect((await call(w.admin, "POST", "/periods", { ...body, name: `${PREFIX}other`, opensAt: "2031-01-01T00:00:00Z", closesAt: "2031-02-01T00:00:00Z", countries: ["Kenya"] })).status).toBe(400);
    expect((await call(w.admin, "POST", "/periods", { ...body, name: `${PREFIX}other`, opensAt: "2031-01-01T00:00:00Z", closesAt: "2031-02-01T00:00:00Z", templateVersion: "9.9.9" })).status).toBe(422);
  });

  it("shows the open period to anyone, and the list to staff", async () => {
    const open = await call(null, "GET", "/period");
    expect(open.body.period).toMatchObject({ id: w.periodId, state: "open" });
    expect((await call(w.ownerA, "GET", "/periods")).status).toBe(403);
    const list = await call(w.facilitator, "GET", "/periods");
    expect(list.body.items.map((p: Json) => p.id)).toContain(w.periodId);
  });

  it("lets the administrator change the window and the countries, but not the versions", async () => {
    const res = await call(w.admin, "PATCH", `/periods/${w.periodId}`, { countries: [COUNTRY, "KE", "gh"], templateVersion: "2.0.0" });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body).toMatchObject({ countries: [COUNTRY, "KE", "GH"], templateVersion: "0.1.0" });
    expect((await call(w.facilitator, "PATCH", `/periods/${w.periodId}`, { name: "x" })).status).toBe(403);
    expect((await call(w.admin, "PATCH", `/periods/${randomUUID()}`, { name: "x" })).status).toBe(404);
    expect((await call(w.admin, "PATCH", `/periods/${w.periodId}`, { closesAt: "2029-12-01T00:00:00Z" })).status).toBe(422);
  });
});

describe("the application form", () => {
  it("is shown to an applicant when published", async () => {
    const res = await call(w.ownerA, "GET", "/forms/0.1.0");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: "summit.application", version: "0.1.0", status: "published" });
    expect(res.body.sections).toHaveLength(9);
    expect(res.body.questions.find((q: Json) => q.id === "S3.2").showIf).toBeDefined();
    expect(res.body.inputs).toBeUndefined();
    form = res.body;
    expect((await call(w.ownerA, "GET", "/forms/9.9.9")).status).toBe(404);
  });
});

describe("starting an application", () => {
  it("is limited to members of the organisation, in a country the period takes", async () => {
    expect((await call(w.outsider, "POST", "/applications", { organizationId: w.orgA })).status).toBe(404);
    // Entrust staff don't apply for an SME.
    expect((await call(w.admin, "POST", "/applications", { organizationId: w.orgA })).status).toBe(404);
    const wrongCountry = await call(w.ownerB, "POST", "/applications", { organizationId: w.orgB });
    expect(wrongCountry.status).toBe(403);
    expect(wrongCountry.body.error).toContain("Ethiopia");
  });

  it("opens a draft with the registry's answers filled in, and gives the organisation Summit access, not TRADE", async () => {
    const res = await call(w.memberA, "POST", "/applications", { organizationId: w.orgA });
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    expect(res.body).toMatchObject({
      organizationId: w.orgA,
      organizationName: "org-a",
      periodId: w.periodId,
      view: "applicant",
      status: "draft",
      templateVersion: "0.1.0",
      editable: true,
      canSubmit: false,
      eligibility: null,
      pathway: null,
    });
    expect(res.body.number).toMatch(/^SUM-\d{6}$/);
    expect(res.body.answers).toEqual({ "S1.1": "org-a", "S1.3": "QZ" });
    expect(res.body.staff).toBeUndefined();
    w.appA = res.body.id;

    const grants = await db.select().from(schema.platformAccess).where(eq(schema.platformAccess.organizationId, w.orgA));
    expect(grants.map((g) => g.platform)).toEqual(["summit"]);
  });

  it("allows one application a period", async () => {
    const again = await call(w.ownerA, "POST", "/applications", { organizationId: w.orgA });
    expect(again.status).toBe(409);
  });

  it("is refused when no period is open", async () => {
    vi.setSystemTime("2030-03-01T00:00:00Z");
    expect((await call(w.ownerE, "POST", "/applications", { organizationId: w.orgE })).status).toBe(422);
    vi.setSystemTime("2029-12-01T00:00:00Z");
    expect((await call(w.ownerE, "POST", "/applications", { organizationId: w.orgE })).status).toBe(422);
    vi.setSystemTime(OPEN);
  });

  it("writes the status history and the audit log", async () => {
    const history = await db.select().from(schema.applicationStatusChange).where(eq(schema.applicationStatusChange.applicationId, w.appA));
    expect(history.map((h) => [h.fromStatus, h.toStatus, h.changedBy !== null])).toEqual([[null, "draft", true]]);
    const audit = await db.select().from(schema.auditLog).where(eq(schema.auditLog.entityId, w.appA));
    expect(audit.map((a) => [a.platform, a.action])).toEqual([["summit", "summit.application.created"]]);
    const access = await db
      .select()
      .from(schema.auditLog)
      .where(and(eq(schema.auditLog.organizationId, w.orgA), eq(schema.auditLog.action, "summit.access.granted")));
    expect(access).toHaveLength(1);
  });
});

describe("saving and resuming", () => {
  it("saves answers as the applicant goes and returns them when they come back", async () => {
    const saved = await call(w.ownerA, "PATCH", `/applications/${w.appA}/answers`, {
      answers: { "S1.4": "registered", "S2.12": "trade_and_market_access", "S1.14": "yes" },
    });
    expect(saved.status, JSON.stringify(saved.body)).toBe(200);
    expect(saved.body.pathway).toBe("trade_and_market_access");
    expect(saved.body.progress.answered).toBeGreaterThan(2);
    expect(saved.body.progress.percent).toBeLessThan(100);

    // A colleague resumes it.
    const resumed = await detail(w.memberA, w.appA);
    expect(resumed.body.answers).toMatchObject({ "S1.1": "org-a", "S1.4": "registered", "S2.12": "trade_and_market_access" });
    expect(resumed.body.incomplete.length).toBeGreaterThan(0);
  });

  it("clears an answer with null and keeps the ones it doesn't name", async () => {
    const res = await call(w.ownerA, "PATCH", `/applications/${w.appA}/answers`, { answers: { "S1.14": null } });
    expect(res.body.answers["S1.14"]).toBeUndefined();
    expect(res.body.answers["S1.4"]).toBe("registered");
    await call(w.ownerA, "PATCH", `/applications/${w.appA}/answers`, { answers: { "S1.14": "yes" } });
  });

  it("refuses an answer that isn't valid for its question, and a question the form doesn't have", async () => {
    const invalid = await call(w.ownerA, "PATCH", `/applications/${w.appA}/answers`, { answers: { "S1.4": "bogus" } });
    expect(invalid.status).toBe(422);
    expect(invalid.body.error).toContain("S1.4");
    expect((await call(w.ownerA, "PATCH", `/applications/${w.appA}/answers`, { answers: { "S99.9": "x" } })).status).toBe(422);
    expect((await detail(w.ownerA, w.appA)).body.answers["S1.4"]).toBe("registered");
  });

  it("is for the applicant alone", async () => {
    const body = { answers: { "S1.2": "Trading name" } };
    expect((await call(w.facilitator, "PATCH", `/applications/${w.appA}/answers`, body)).status).toBe(403);
    expect((await call(w.admin, "PATCH", `/applications/${w.appA}/answers`, body)).status).toBe(403);
    expect((await call(w.ownerB, "PATCH", `/applications/${w.appA}/answers`, body)).status).toBe(404);
    expect((await call(w.outsider, "PATCH", `/applications/${w.appA}/answers`, body)).status).toBe(404);
  });

  it("shows conditional questions as the answers change", async () => {
    // A first-time exporter is never asked its export history; an exporter is.
    const asked = async (id: string) => (await detail(w.ownerA, w.appA)).body.incomplete.some((p: Json) => p.question === id);
    await call(w.ownerA, "PATCH", `/applications/${w.appA}/answers`, { answers: { "S3.1": "no" } });
    expect(await asked("S3.2")).toBe(false);
    await call(w.ownerA, "PATCH", `/applications/${w.appA}/answers`, { answers: { "S3.1": "yes" } });
    expect(await asked("S3.2")).toBe(true);
    await call(w.ownerA, "PATCH", `/applications/${w.appA}/answers`, { answers: { "S3.1": null } });
  });
});

describe("submitting", () => {
  it("is refused until every shown question is answered", async () => {
    const res = await call(w.ownerA, "POST", `/applications/${w.appA}/submit`);
    expect(res.status).toBe(422);
    expect(res.body.error).toContain("isn't complete");
    expect((await detail(w.ownerA, w.appA)).body.status).toBe("draft");
  });

  it("needs the declaration accepted", async () => {
    await call(w.ownerA, "PATCH", `/applications/${w.appA}/answers`, { answers: completeAnswers((await detail(w.ownerA, w.appA)).body.answers) });
    const declined = await call(w.ownerA, "PATCH", `/applications/${w.appA}/answers`, { answers: { "S9.2": "no" } });
    expect(declined.status, JSON.stringify(declined.body)).toBe(200);
    expect(declined.body.canSubmit).toBe(false);
    expect((await call(w.ownerA, "POST", `/applications/${w.appA}/submit`)).status).toBe(422);
    await call(w.ownerA, "PATCH", `/applications/${w.appA}/answers`, { answers: { "S9.2": "yes" } });
  });

  it("screens eligibility, and waits for the missing documents instead of failing the applicant", async () => {
    const before = await detail(w.ownerA, w.appA);
    expect(before.body).toMatchObject({ canSubmit: true, requiredDocuments: ["registration_certificate", "product_information"] });

    const res = await call(w.ownerA, "POST", `/applications/${w.appA}/submit`);
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    // The applicant sees "action required", not the workflow's own status.
    expect(res.body).toMatchObject({ view: "applicant", status: "action_required", editable: true });
    expect(res.body.submittedAt).not.toBeNull();
    expect(res.body.eligibility).toMatchObject({ outcome: "pending_clarification", missingDocuments: ["registration_certificate", "product_information"] });
    expect(res.body.eligibility.criteria.find((c: Json) => c.id === "documents")).toMatchObject({ result: "unclear" });
    expect(res.body.eligibility.criteria.filter((c: Json) => c.result === "met")).toHaveLength(5);
    expect(res.body.staff).toBeUndefined();
  });

  it("records the consent the applicant gave, once", async () => {
    const consent = await db.select().from(schema.consentRecord).where(eq(schema.consentRecord.applicationId, w.appA));
    expect(consent.map((c) => c.question).sort()).toEqual(["S9.1", "S9.2", "S9.3"]);
    expect(consent.every((c) => c.termsVersion === "0.1.0" && c.userId === w.ownerA.id)).toBe(true);
  });

  it("takes documents of the applicant's own organisation only, and then submits again", async () => {
    const foreign = await makeFile(w.orgB, w.ownerB.id);
    expect((await attach(w.ownerA, w.appA, foreign, "registration_certificate")).status).toBe(404);
    expect((await attach(w.ownerA, w.appA, randomUUID(), "registration_certificate")).status).toBe(404);

    const certificate = await makeFile(w.orgA, w.ownerA.id, "certificate.pdf");
    const added = await attach(w.memberA, w.appA, certificate, "registration_certificate");
    expect(added.status, JSON.stringify(added.body)).toBe(201);
    expect(added.body.documents).toMatchObject([{ fileId: certificate, kind: "registration_certificate", restricted: false, fileName: "certificate.pdf" }]);
    expect((await attach(w.ownerA, w.appA, certificate, "registration_certificate")).status).toBe(409);

    const financials = await makeFile(w.orgA, w.ownerA.id, "accounts.pdf");
    const withFinancials = await attach(w.ownerA, w.appA, financials, "financial_statements");
    expect(withFinancials.body.documents.find((d: Json) => d.kind === "financial_statements").restricted).toBe(true);
    // Not enough yet: the product information is still missing.
    expect((await call(w.ownerA, "POST", `/applications/${w.appA}/submit`)).body.eligibility.missingDocuments).toEqual(["product_information"]);

    await attach(w.ownerA, w.appA, await makeFile(w.orgA, w.ownerA.id, "catalogue.pdf"), "product_information");
    const done = await call(w.ownerA, "POST", `/applications/${w.appA}/submit`);
    expect(done.status, JSON.stringify(done.body)).toBe(200);
    expect(done.body).toMatchObject({ status: "in_review", editable: false, canSubmit: false });
    expect(done.body.eligibility).toMatchObject({ outcome: "eligible", missingDocuments: [] });
    expect(done.body.eligibility.criteria.every((c: Json) => c.result === "met")).toBe(true);
  });

  it("keeps every screening and every status change, in order, with who made them", async () => {
    const results = await db
      .select()
      .from(schema.eligibilityResult)
      .where(eq(schema.eligibilityResult.applicationId, w.appA))
      .orderBy(asc(schema.eligibilityResult.screenedAt));
    expect(results.map((r) => r.outcome)).toEqual(["pending_clarification", "pending_clarification", "eligible"]);
    expect(results.every((r) => r.rulesVersion === "1.0.0" && r.screenedBy === null)).toBe(true);

    const staffView = await detail(w.facilitator, w.appA);
    expect(staffView.body.staff.history.map((h: Json) => [h.from, h.to])).toEqual([
      [null, "draft"],
      ["draft", "submitted"],
      ["submitted", "under_eligibility_review"],
      ["under_eligibility_review", "awaiting_additional_information"],
      ["awaiting_additional_information", "under_eligibility_review"],
      ["under_eligibility_review", "awaiting_additional_information"],
      ["awaiting_additional_information", "under_eligibility_review"],
      ["under_eligibility_review", "eligible"],
    ]);
    expect(staffView.body.staff.history[1].by).toMatchObject({ name: "owner-a" });
    expect(staffView.body.staff.history[2].by).toBeNull();

    const actions = (await db.select().from(schema.auditLog).where(eq(schema.auditLog.entityId, w.appA))).map((a) => a.action);
    expect(actions).toContain("summit.application.submitted");
    expect(actions).toContain("summit.application.resubmitted");
    expect(actions).toContain("summit.document.added");
    expect(actions.filter((a) => a === "summit.application.status")).toHaveLength(7);
  });

  it("freezes the answers once the application is eligible", async () => {
    expect((await call(w.ownerA, "PATCH", `/applications/${w.appA}/answers`, { answers: { "S1.2": "Changed" } })).status).toBe(409);
    expect((await call(w.ownerA, "POST", `/applications/${w.appA}/submit`)).status).toBe(409);
    const documents = (await detail(w.ownerA, w.appA)).body.documents;
    expect((await call(w.ownerA, "DELETE", `/applications/${w.appA}/documents/${documents[0].id}`)).status).toBe(409);
  });
});

describe("an applicant that isn't eligible", () => {
  it("is told it isn't, and an administrator can accept it with a reason", async () => {
    const created = await call(w.ownerC, "POST", "/applications", { organizationId: w.orgC });
    w.appC = created.body.id;
    await call(w.ownerC, "PATCH", `/applications/${w.appC}/answers`, { answers: completeAnswers({ ...created.body.answers, "S1.4": "not_registered" }) });
    const submitted = await call(w.ownerC, "POST", `/applications/${w.appC}/submit`);
    expect(submitted.status, JSON.stringify(submitted.body)).toBe(200);
    // Not scored zero: eligibility is a finding of its own.
    expect(submitted.body).toMatchObject({ status: "not_eligible", editable: false });
    expect(submitted.body.eligibility.outcome).toBe("ineligible");
    expect(submitted.body.eligibility.criteria.find((c: Json) => c.id === "registered")).toMatchObject({ result: "not_met" });
    expect((await detail(w.facilitator, w.appC)).body.status).toBe("ineligible");

    // Who can record an exception, and when.
    const body = { criterion: "registered", reason: "Registration is in progress; the permit is attached." };
    expect((await call(w.ownerC, "POST", `/applications/${w.appC}/eligibility-exceptions`, body)).status).toBe(403);
    expect((await call(w.reviewer, "POST", `/applications/${w.appC}/eligibility-exceptions`, body)).status).toBe(404);
    expect((await call(w.facilitator, "POST", `/applications/${w.appC}/eligibility-exceptions`, { ...body, criterion: "offering" })).status).toBe(422);
    expect((await call(w.facilitator, "POST", `/applications/${w.appC}/eligibility-exceptions`, { ...body, criterion: "nonsense" })).status).toBe(400);
    expect((await call(w.facilitator, "POST", `/applications/${w.appC}/eligibility-exceptions`, { ...body, reason: " " })).status).toBe(400);

    const excepted = await call(w.facilitator, "POST", `/applications/${w.appC}/eligibility-exceptions`, body);
    expect(excepted.status, JSON.stringify(excepted.body)).toBe(201);
    // The requirement is satisfied, but the documents are still missing, so the applicant has something to do.
    expect(excepted.body.status).toBe("awaiting_additional_information");
    expect(excepted.body.staff.exceptions).toMatchObject([{ criterion: "registered", reason: body.reason, by: { name: "facilitator" } }]);
    expect(excepted.body.eligibility.criteria.find((c: Json) => c.id === "registered").result).toBe("excepted");
    expect((await call(w.facilitator, "POST", `/applications/${w.appC}/eligibility-exceptions`, body)).status).toBe(422);

    // The applicant sees the requirement as met and none of the administrator's notes.
    const seen = await detail(w.ownerC, w.appC);
    expect(seen.body).toMatchObject({ status: "action_required", editable: true });
    expect(seen.body.eligibility.criteria.find((c: Json) => c.id === "registered").result).toBe("met");
    expect(JSON.stringify(seen.body)).not.toContain(body.reason);
    expect(seen.body.staff).toBeUndefined();

    await attach(w.ownerC, w.appC, await makeFile(w.orgC, w.ownerC.id, "certificate.pdf"), "registration_certificate");
    await attach(w.ownerC, w.appC, await makeFile(w.orgC, w.ownerC.id, "catalogue.pdf"), "product_information");
    const resubmitted = await call(w.ownerC, "POST", `/applications/${w.appC}/submit`);
    expect(resubmitted.body.status).toBe("in_review");
    expect((await detail(w.admin, w.appC)).body.status).toBe("eligible");
  });
});

describe("assigning an officer", () => {
  it("lists the officers for an administrator or facilitator", async () => {
    const res = await call(w.facilitator, "GET", "/officers");
    expect(res.status).toBe(200);
    expect(res.body.items.map((o: Json) => [o.name, o.assigned])).toEqual([["reviewer", 0], ["reviewer2", 0]]);
    expect((await call(w.admin, "GET", "/officers")).status).toBe(200);
    for (const user of [w.reviewer, w.ownerA, w.strayOwner]) expect((await call(user, "GET", "/officers")).status).toBe(403);
  });

  it("keeps an officer out of an application that isn't assigned to them", async () => {
    expect((await detail(w.reviewer, w.appA)).status).toBe(404);
    expect((await call(w.reviewer, "GET", "/applications")).body).toEqual({ items: [], total: 0 });
    expect((await call(w.reviewer, "PUT", `/applications/${w.appA}/officer`, { officerUserId: w.reviewer.id })).status).toBe(404);
  });

  it("assigns an eligible application, which starts its assessment", async () => {
    const body = { officerUserId: w.reviewer.id };
    // Not an officer: a facilitator, an applicant, and nobody at all.
    expect((await call(w.facilitator, "PUT", `/applications/${w.appA}/officer`, { officerUserId: w.facilitator.id })).status).toBe(422);
    expect((await call(w.facilitator, "PUT", `/applications/${w.appA}/officer`, { officerUserId: w.ownerA.id })).status).toBe(422);
    expect((await call(w.facilitator, "PUT", `/applications/${w.appA}/officer`, { officerUserId: "nobody" })).status).toBe(422);
    // Only administrators assign, and a draft isn't assigned.
    expect((await call(w.ownerA, "PUT", `/applications/${w.appA}/officer`, body)).status).toBe(403);
    const draft = await call(w.ownerD, "POST", "/applications", { organizationId: w.orgD });
    w.appD = draft.body.id;
    expect((await call(w.facilitator, "PUT", `/applications/${w.appD}/officer`, body)).status).toBe(409);

    const res = await call(w.facilitator, "PUT", `/applications/${w.appA}/officer`, body);
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.status).toBe("under_assessment");
    expect(res.body.staff.officer).toMatchObject({ userId: w.reviewer.id, name: "reviewer" });
    expect((await call(w.facilitator, "PUT", `/applications/${w.appA}/officer`, body)).status).toBe(409);

    // The officer can open it now, and it is the only one in their list.
    const opened = await detail(w.reviewer, w.appA);
    expect(opened.status).toBe(200);
    expect(opened.body).toMatchObject({ view: "staff", status: "under_assessment" });
    expect((await call(w.reviewer, "GET", "/applications")).body.items.map((i: Json) => i.id)).toEqual([w.appA]);
    // The applicant sees "in review", and no officer.
    expect(await detail(w.ownerA, w.appA).then((r) => [r.body.status, r.body.staff])).toEqual(["in_review", undefined]);
    // The officer can't hand it on or accept an exception: that's for administrators.
    expect((await call(w.reviewer, "PUT", `/applications/${w.appA}/officer`, { officerUserId: w.reviewer2.id })).status).toBe(403);
  });

  it("hands an application to another officer and keeps the first assignment on record", async () => {
    const res = await call(w.admin, "PUT", `/applications/${w.appA}/officer`, { officerUserId: w.reviewer2.id });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.status).toBe("under_assessment");
    expect((await detail(w.reviewer, w.appA)).status).toBe(404);
    expect((await detail(w.reviewer2, w.appA)).status).toBe(200);

    const rows = await db
      .select()
      .from(schema.officerAssignment)
      .where(eq(schema.officerAssignment.applicationId, w.appA))
      .orderBy(asc(schema.officerAssignment.assignedAt));
    expect(rows.map((r) => [r.officerUserId, r.endedAt !== null, r.assignedBy])).toEqual([
      [w.reviewer.id, true, w.facilitator.id],
      [w.reviewer2.id, false, w.admin.id],
    ]);
    const officers = await call(w.admin, "GET", "/officers");
    expect(officers.body.items.map((o: Json) => [o.name, o.assigned])).toEqual([["reviewer", 0], ["reviewer2", 1]]);
  });
});

describe("documents", () => {
  const documentOf = async (kind: string) => (await detail(w.ownerA, w.appA)).body.documents.find((d: Json) => d.kind === kind).id as string;
  const link = (user: TestUser, id: string) => call(user, "GET", `/applications/${w.appA}/documents/${id}/download-url`);

  it("gives the applicant and the assigned officer any document, and an administrator too", async () => {
    const id = await documentOf("registration_certificate");
    for (const user of [w.ownerA, w.memberA, w.reviewer2, w.admin, w.facilitator]) {
      const res = await link(user, id);
      expect([res.status, res.body.fileName]).toEqual([200, "certificate.pdf"]);
      expect(res.body.downloadUrl).toContain("certificate.pdf");
    }
  });

  it("keeps financial statements from a facilitator, and everything from anyone else", async () => {
    const id = await documentOf("financial_statements");
    for (const user of [w.ownerA, w.reviewer2, w.admin]) expect((await link(user, id)).status).toBe(200);
    expect((await link(w.facilitator, id)).status).toBe(403);
    // The unassigned officer, another applicant and a stranger can't tell it exists.
    for (const user of [w.reviewer, w.ownerB, w.outsider, w.strayOwner]) expect((await link(user, id)).status).toBe(404);
    expect((await call(w.ownerA, "GET", `/applications/${w.appA}/documents/${randomUUID()}/download-url`)).status).toBe(404);
    // A document of another application doesn't open through this one.
    const other = (await detail(w.ownerC, w.appC)).body.documents[0].id;
    expect((await call(w.ownerA, "GET", `/applications/${w.appA}/documents/${other}/download-url`)).status).toBe(404);
  });
});

describe("withdrawing", () => {
  it("is final, but the organisation can start again while the period is open", async () => {
    const res = await call(w.ownerD, "POST", `/applications/${w.appD}/withdraw`, { reason: "Not ready this year" });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.status).toBe("withdrawn");
    expect((await call(w.ownerD, "POST", `/applications/${w.appD}/withdraw`, {})).status).toBe(409);
    expect((await call(w.ownerD, "PATCH", `/applications/${w.appD}/answers`, { answers: {} })).status).toBe(409);

    const history = (await detail(w.admin, w.appD)).body.staff.history;
    expect(history.at(-1)).toMatchObject({ from: "draft", to: "withdrawn", reason: "Not ready this year", by: { name: "owner-d" } });

    const again = await call(w.ownerD, "POST", "/applications", { organizationId: w.orgD });
    expect(again.status, JSON.stringify(again.body)).toBe(201);
    expect(again.body.id).not.toBe(w.appD);
    expect(again.body.number).not.toBe(res.body.number);
  });

  it("is for the applicant alone", async () => {
    expect((await call(w.facilitator, "POST", `/applications/${w.appC}/withdraw`, {})).status).toBe(403);
    expect((await call(w.ownerA, "POST", `/applications/${w.appC}/withdraw`, {})).status).toBe(404);
    expect((await call(w.ownerC, "POST", `/applications/${w.appC}/withdraw`)).status).toBe(200);
  });
});

describe("the period closing", () => {
  it("stops a draft from being changed or submitted, but not a clarification being answered", async () => {
    const open = await call(w.ownerE, "POST", "/applications", { organizationId: w.orgE });
    expect(open.status).toBe(201);
    vi.setSystemTime("2030-02-01T00:00:00Z");
    const id = open.body.id;
    expect((await detail(w.ownerE, id)).body.editable).toBe(false);
    expect((await call(w.ownerE, "PATCH", `/applications/${id}/answers`, { answers: { "S1.2": "x" } })).status).toBe(422);
    expect((await call(w.ownerE, "POST", `/applications/${id}/submit`)).status).toBe(422);
    vi.setSystemTime(OPEN);
  });
});

describe("the list for an administrator", () => {
  it("shows every application with how complete it is, who holds it, and filters", async () => {
    const all = await call(w.facilitator, "GET", `/applications?periodId=${w.periodId}`);
    expect(all.status).toBe(200);
    const byOrg = new Map(all.body.items.map((i: Json) => [i.organizationName, i]));
    expect(byOrg.get("org-a")).toMatchObject({
      status: "under_assessment",
      pathway: "trade_and_market_access",
      progressPercent: 100,
      eligibility: "eligible",
      missingDocuments: 0,
      officer: { name: "reviewer2" },
      country: COUNTRY,
    });
    expect(byOrg.get("org-c")).toMatchObject({ status: "withdrawn", officer: null });
    expect(byOrg.get("org-e")).toMatchObject({ status: "draft", eligibility: null, pathway: null });
    expect(all.body.total).toBe(all.body.items.length);

    const filtered = await call(w.admin, "GET", `/applications?periodId=${w.periodId}&status=under_assessment`);
    expect(filtered.body.items.map((i: Json) => i.organizationName)).toEqual(["org-a"]);
    const byOfficer = await call(w.admin, "GET", `/applications?periodId=${w.periodId}&officerUserId=${w.reviewer2.id}`);
    expect(byOfficer.body.items.map((i: Json) => i.organizationName)).toEqual(["org-a"]);
    const paged = await call(w.admin, "GET", `/applications?periodId=${w.periodId}&limit=1&offset=1`);
    expect(paged.body.items).toHaveLength(1);
    expect(paged.body.total).toBe(all.body.total);
  });

  it("shows an applicant only their own, in the words an applicant sees", async () => {
    const mine = await call(w.memberA, "GET", "/applications");
    expect(mine.body.items.map((i: Json) => [i.organizationName, i.status, i.officer])).toEqual([["org-a", "in_review", null]]);
    expect((await call(w.outsider, "GET", "/applications")).body).toEqual({ items: [], total: 0 });
    expect((await call(w.strayOwner, "GET", "/applications")).body).toEqual({ items: [], total: 0 });
  });
});
