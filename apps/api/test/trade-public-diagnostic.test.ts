import { desc, eq, like } from "drizzle-orm";
import { schema } from "@entrust/db";
import { visibleQuestions, type FormDefinition } from "@entrust/forms";
import { latestDiagnosticTemplate } from "@entrust/trade-rules";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PREFIX, callFileV1, callV1, cleanup, createOrganization, db, signUp, type TestUser } from "./support";

// The onboarding diagnostic without an account (#78): a public link, a private link per draft, and staff who read the
// submissions.

const get = (user: TestUser | null, path: string) => callV1(user, "GET", `/trade${path}`);
const post = (user: TestUser | null, path: string, body?: unknown) => callV1(user, "POST", `/trade${path}`, body);
const put = (user: TestUser | null, path: string, body?: unknown) => callV1(user, "PUT", `/trade${path}`, body);

const w = {} as { sme: TestUser; reviewer: TestUser; entrust: string };
const email = (name: string) => `${PREFIX}public-${Math.random().toString(36).slice(2, 8)}-${name}@example.test`;

beforeAll(async () => {
  await cleanup();
  await db.delete(schema.publicDiagnostic).where(like(schema.publicDiagnostic.email, `${PREFIX}%`));
  const [sme, reviewer] = (await Promise.all(["pd-sme", "pd-reviewer"].map(signUp))) as [TestUser, TestUser];
  Object.assign(w, { sme, reviewer });
  await createOrganization("pd-sme-org", [[sme, "owner"]], { platform: "trade" });
  w.entrust = await createOrganization("pd-entrust", [[reviewer, "facilitator"]], { smeProfile: false });
  process.env.ENTRUST_ORG_ID = w.entrust;
});

afterAll(async () => {
  delete process.env.ENTRUST_ORG_ID;
  await db.delete(schema.publicDiagnostic).where(like(schema.publicDiagnostic.email, `${PREFIX}%`));
  await cleanup();
});

type Wire = unknown;

/** Answers every visible question of a form, in order, until nothing new shows up. `overrides` win. */
function fillIn(form: FormDefinition, overrides: Record<string, Wire> = {}): Record<string, Wire> {
  const answers: Record<string, Wire> = {};
  for (let round = 0; round < 12; round++) {
    let added = false;
    for (const q of visibleQuestions(form, answers as never)) {
      if (q.id in answers) continue;
      added = true;
      if (q.id in overrides) {
        answers[q.id] = overrides[q.id];
        continue;
      }
      switch (q.type) {
        case "yes_no":
          answers[q.id] = q.mustBe ?? "no";
          break;
        case "single_choice":
          answers[q.id] = q.options![0]!.value;
          break;
        case "multiple_choice":
          answers[q.id] = [q.options!.find((o) => !o.exclusive)!.value];
          break;
        case "short_text":
        case "long_text":
          answers[q.id] = "Some words";
          break;
        case "number":
          answers[q.id] = q.min ?? 1;
          break;
        case "money":
          answers[q.id] = { amount: 1000, currency: "USD" };
          break;
        case "date":
          answers[q.id] = "2020-01-01";
          break;
        case "list":
          answers[q.id] = ["One"];
          break;
      }
    }
    if (!added) break;
  }
  // An override for a question the walk didn't reach (it shows only after another override).
  for (const [id, value] of Object.entries(overrides)) answers[id] ??= value;
  return answers;
}


const diagnostic = latestDiagnosticTemplate() as FormDefinition;
const yearAgo = () => new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10);

const PHONE = "+251 91 123 4567";

async function start(name: string, extra: Record<string, unknown> = {}) {
  const res = await post(null, "/public/diagnostic", { email: email(name), phone: PHONE, businessName: `Business ${name}`, ...extra });
  expect(res.status).toBe(201);
  return res.body.token as string;
}

describe("the public diagnostic", () => {
  it("serves the form to anyone, no account needed", async () => {
    const res = await get(null, "/public/diagnostic/template");
    expect(res.status).toBe(200);
    expect(res.body.version).toBe(diagnostic.version);
    expect(res.body.form.questions.length).toBe(diagnostic.questions.length);
    expect(res.body.variables.country).toBe("Ethiopia");
  });

  it("starts a draft from an email and gives back its private token", async () => {
    const token = await start("start");
    expect(token.length).toBeGreaterThanOrEqual(40);
    const view = await get(null, `/public/diagnostic/${token}`);
    expect(view.status).toBe(200);
    expect(view.body).toMatchObject({ status: "draft", businessName: "Business start", submittedAt: null, pathway: null });
    // The name, email and phone number given to start are already answers in section 1.
    expect(view.body.progress.answered).toBe(3);
  });

  it("needs an email, a phone number and the business's name to start", async () => {
    const ok = { email: email("required"), phone: PHONE, businessName: "Required Traders" };
    expect((await post(null, "/public/diagnostic", { ...ok, email: undefined })).status).toBe(400);
    const noPhone = await post(null, "/public/diagnostic", { ...ok, phone: undefined });
    expect(noPhone.status).toBe(400);
    expect(noPhone.body.error).toContain("phone");
    const noName = await post(null, "/public/diagnostic", { ...ok, businessName: undefined });
    expect(noName.status).toBe(400);
    expect(noName.body.error).toContain("business");
    expect((await post(null, "/public/diagnostic", { ...ok, businessName: "   " })).status).toBe(400);
    expect((await post(null, "/public/diagnostic", { ...ok, phone: "call me" })).status).toBe(400);
    expect((await post(null, "/public/diagnostic", { ...ok, phone: "12" })).status).toBe(400);
    expect((await post(null, "/public/diagnostic", ok)).status).toBe(201);
    for (const phone of ["0911234567", "+251-91-123-4567", "(251) 911 234 567"]) {
      expect((await post(null, "/public/diagnostic", { ...ok, email: email("phone-format"), phone })).status).toBe(201);
    }
  });

  it("starts section 1 with the name, email and phone number given", async () => {
    const given = email("prefill");
    const res = await post(null, "/public/diagnostic", { email: given, phone: PHONE, businessName: "Prefilled Traders PLC" });
    const view = await get(null, `/public/diagnostic/${res.body.token}`);
    expect(view.body).toMatchObject({ businessName: "Prefilled Traders PLC", phone: PHONE, email: given });
    const byWording = (pattern: RegExp) => diagnostic.questions.find((q) => pattern.test(q.text))!.id;
    expect(view.body.answers[byWording(/registered business name/i)]).toBe("Prefilled Traders PLC");
    expect(view.body.answers[byWording(/business email address/i)]).toBe(given);
    expect(view.body.answers[byWording(/business telephone number/i)]).toBe(PHONE);
    // They are only a start: the person can change them.
    const q1 = byWording(/registered business name/i);
    const changed = await put(null, `/public/diagnostic/${res.body.token}/responses`, { answers: { [q1]: "Prefilled Traders Share Company" } });
    expect(changed.body.answers[q1]).toBe("Prefilled Traders Share Company");
  });

  it("refuses a bad email and a token that isn't one", async () => {
    expect((await post(null, "/public/diagnostic", { email: "not-an-email", phone: PHONE, businessName: "Bad Email Ltd" })).status).toBe(400);
    expect((await get(null, "/public/diagnostic/short")).status).toBe(404);
    expect((await get(null, `/public/diagnostic/${"a".repeat(43)}`)).status).toBe(404);
  });

  it("stores nothing for a form whose trap field is filled in", async () => {
    const trapped = email("bot");
    const res = await post(null, "/public/diagnostic", { email: trapped, phone: PHONE, businessName: "Bot Co", website: "http://spam.example" });
    expect(res.status).toBe(201);
    expect((await get(null, `/public/diagnostic/${res.body.token}`)).status).toBe(404);
    const rows = await db.select().from(schema.publicDiagnostic).where(like(schema.publicDiagnostic.email, trapped));
    expect(rows).toHaveLength(0);
  });

  it("limits how many drafts one email starts in an hour", async () => {
    const same = email("flood");
    const details = { email: same, phone: PHONE, businessName: "Flood Co" };
    for (let i = 0; i < 5; i++) expect((await post(null, "/public/diagnostic", details)).status).toBe(201);
    const sixth = await post(null, "/public/diagnostic", details);
    expect(sixth.status).toBe(429);
    expect(sixth.body.code).toBe("rate_limited");
  });

  it("keeps a draft's answers and resumes where the visitor stopped", async () => {
    const token = await start("resume");
    const [first, second] = Object.entries(fillIn(diagnostic));
    const saved = await put(null, `/public/diagnostic/${token}/responses`, { answers: { [first![0]]: first![1], [second![0]]: second![1] } });
    expect(saved.status).toBe(200);
    expect(saved.body.progress.answered).toBeGreaterThanOrEqual(1);
    const again = await get(null, `/public/diagnostic/${token}`);
    expect(again.body.answers[first![0]]).toEqual(first![1]);
    const cleared = await put(null, `/public/diagnostic/${token}/responses`, { answers: { [first![0]]: null } });
    expect(first![0] in cleared.body.answers).toBe(false);
  });

  it("refuses an answer a question can't take, and a question the form doesn't have", async () => {
    const token = await start("invalid");
    const number = diagnostic.questions.find((q) => q.type === "number")!;
    expect((await put(null, `/public/diagnostic/${token}/responses`, { answers: { [number.id]: "lots" } })).status).toBe(422);
    expect((await put(null, `/public/diagnostic/${token}/responses`, { answers: { Q9999: "x" } })).status).toBe(422);
  });

  it("accepts \"I don't know\" for any question", async () => {
    const token = await start("unknown");
    const res = await put(null, `/public/diagnostic/${token}/responses`, { answers: { Q135: { notKnown: true } } });
    expect(res.status).toBe(200);
    expect(res.body.answers.Q135).toEqual({ notKnown: true });
  });

  it("won't submit while a shown question is unanswered", async () => {
    const token = await start("incomplete");
    const res = await post(null, `/public/diagnostic/${token}/submit`);
    expect(res.status).toBe(422);
    expect(res.body.error).toContain("isn't complete");
  });

  it("submits a complete form, assigns Pathway B from a recent shipment, and locks the answers", async () => {
    const token = await start("pathway-b");
    const answers = fillIn(diagnostic, { Q135: "yes", Q137: yearAgo() });
    expect((await put(null, `/public/diagnostic/${token}/responses`, { answers })).status).toBe(200);
    const submitted = await post(null, `/public/diagnostic/${token}/submit`);
    expect(submitted.status).toBe(200);
    expect(submitted.body.status).toBe("submitted");
    expect(submitted.body.pathway).toMatchObject({ pathway: "B", status: "provisional" });
    expect(submitted.body.pathway.reasons.length).toBeGreaterThan(0);

    const locked = await put(null, `/public/diagnostic/${token}/responses`, { answers: { Q135: "no" } });
    expect(locked.status).toBe(409);
    expect((await post(null, `/public/diagnostic/${token}/submit`)).status).toBe(409);
    expect((await get(null, `/public/diagnostic/${token}`)).body.pathway.pathway).toBe("B");
  });

  it("puts a business that has not exported on Pathway A", async () => {
    const token = await start("pathway-a");
    await put(null, `/public/diagnostic/${token}/responses`, { answers: fillIn(diagnostic, { Q135: "no" }) });
    const submitted = await post(null, `/public/diagnostic/${token}/submit`);
    expect(submitted.status).toBe(200);
    expect(submitted.body.pathway).toMatchObject({ pathway: "A" });
  });

  it("keeps one draft private from another's token", async () => {
    const one = await start("private-one");
    const two = await start("private-two");
    await put(null, `/public/diagnostic/${one}/responses`, { answers: { Q135: "yes" } });
    expect((await get(null, `/public/diagnostic/${two}`)).body.answers.Q135).toBeUndefined();
  });
});

describe("staff reading the submissions", () => {
  let submittedToken: string;
  let submittedEmail: string;

  beforeAll(async () => {
    submittedEmail = email("staff-view");
    const res = await post(null, "/public/diagnostic", { email: submittedEmail, phone: PHONE, businessName: "=cmd|' /C calc'!A0" });
    submittedToken = res.body.token;
    await put(null, `/public/diagnostic/${submittedToken}/responses`, { answers: fillIn(diagnostic, { Q135: "no" }) });
    expect((await post(null, `/public/diagnostic/${submittedToken}/submit`)).status).toBe(200);
  });

  it("is for signed-in Entrust staff only", async () => {
    expect((await get(null, "/public-diagnostics")).status).toBe(401);
    expect((await get(w.sme, "/public-diagnostics")).status).toBe(403);
    expect((await get(w.sme, "/public-diagnostics/export.csv")).status).toBe(403);
    expect((await get(w.reviewer, "/public-diagnostics")).status).toBe(200);
  });

  it("lists submissions with the avenue, and counts drafts and submitted", async () => {
    const res = await get(w.reviewer, `/public-diagnostics?status=submitted&q=${encodeURIComponent(submittedEmail)}`);
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0]).toMatchObject({ email: submittedEmail, phone: PHONE, status: "submitted", pathway: "A" });
    expect(res.body.counts.submitted).toBeGreaterThanOrEqual(1);
    expect(res.body.counts.draft).toBeGreaterThanOrEqual(1);
    expect(res.body.counts.pathwayA).toBeGreaterThanOrEqual(1);
    expect(res.body.counts.perDay).toHaveLength(14);
    const today = res.body.counts.perDay.at(-1);
    expect(today.date).toBe(new Date().toISOString().slice(0, 10));
    expect(today.started).toBeGreaterThanOrEqual(1);
    expect(today.submitted).toBeGreaterThanOrEqual(1);
  });

  it("shows one line for an email that started several forms, submitted once any of them is", async () => {
    const shared = email("repeat");
    const begin = async () => (await post(null, "/public/diagnostic", { email: shared, phone: PHONE, businessName: "Repeat Trading" })).body.token as string;
    const first = await begin();
    await begin();
    const third = await begin();
    // Only the first one is finished. The third has some answers, and the second has none beyond the three it started with.
    await put(null, `/public/diagnostic/${first}/responses`, { answers: fillIn(diagnostic, { Q135: "no" }) });
    expect((await post(null, `/public/diagnostic/${first}/submit`)).status).toBe(200);
    await put(null, `/public/diagnostic/${third}/responses`, { answers: { Q135: "no" } });

    const res = await get(w.reviewer, `/public-diagnostics?q=${encodeURIComponent(shared)}`);
    expect(res.body.items).toHaveLength(1);
    const person = res.body.items[0];
    expect(person).toMatchObject({ email: shared, status: "submitted", pathway: "A", submittedCount: 1 });
    expect(person.sessions).toHaveLength(3);
    expect(person.sessions.filter((s: { status: string }) => s.status === "submitted")).toHaveLength(1);
    // A finished form carries no progress, an open one says how far it got, and the one with more answers is further along.
    const open = person.sessions.filter((s: { status: string }) => s.status === "draft") as { progress: { answered: number; total: number; percent: number } }[];
    expect(open).toHaveLength(2);
    expect(person.sessions.find((s: { status: string }) => s.status === "submitted").progress).toBeNull();
    for (const s of open) expect(s.progress.total).toBeGreaterThan(s.progress.answered);
    expect(Math.max(...open.map((s) => s.progress.answered))).toBeGreaterThan(Math.min(...open.map((s) => s.progress.answered)));

    // The status filter and the figures follow the person, not each form.
    const submitted = await get(w.reviewer, `/public-diagnostics?status=submitted&q=${encodeURIComponent(shared)}`);
    expect(submitted.body.items).toHaveLength(1);
    const draft = await get(w.reviewer, `/public-diagnostics?status=draft&q=${encodeURIComponent(shared)}`);
    expect(draft.body.items).toHaveLength(0);
  });

  it("keeps a person in progress while none of their forms is submitted", async () => {
    const only = email("only-drafts");
    for (let i = 0; i < 2; i++) await post(null, "/public/diagnostic", { email: only, phone: PHONE, businessName: "Slow Starters" });
    const res = await get(w.reviewer, `/public-diagnostics?status=draft&q=${encodeURIComponent(only)}`);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0]).toMatchObject({ status: "draft", pathway: null, submittedCount: 0 });
    expect(res.body.items[0].sessions).toHaveLength(2);
    expect((await get(w.reviewer, `/public-diagnostics?status=submitted&q=${encodeURIComponent(only)}`)).body.items).toHaveLength(0);
  });

  it("marks a form whose email wasn't proven, and never lets one replace a proven form", async () => {
    const shared = email("impersonated");
    const submit = async (overrides: Record<string, Wire>) => {
      const token = (await post(null, "/public/diagnostic", { email: shared, phone: PHONE, businessName: "Real Exporters" })).body.token as string;
      await put(null, `/public/diagnostic/${token}/responses`, { answers: fillIn(diagnostic, overrides) });
      return (await post(null, `/public/diagnostic/${token}/submit`)).body;
    };
    // The business proves its address and submits: Pathway A.
    await submit({ Q135: "no" });
    const [proven] = await db.select({ id: schema.publicDiagnostic.id }).from(schema.publicDiagnostic).where(eq(schema.publicDiagnostic.email, shared));
    await db.update(schema.publicDiagnostic).set({ emailVerifiedAt: new Date() }).where(eq(schema.publicDiagnostic.id, proven!.id));
    // Later a stranger types the same address and submits something else, without ever opening the email.
    await submit({ Q135: "yes", Q137: yearAgo() });

    const person = (await get(w.reviewer, `/public-diagnostics?q=${encodeURIComponent(shared)}`)).body.items[0];
    expect(person).toMatchObject({ pathway: "A", emailVerified: true, submittedCount: 2 });
    expect(person.sessions.map((x: { emailVerified: boolean }) => x.emailVerified).sort()).toEqual([false, true]);
  });

  it("links a proven submission to a business's enrolment, which takes its avenue", async () => {
    const owner = await signUp("pd-link-owner");
    const org = await createOrganization("pd-link-org", [[owner, "owner"]], { platform: "trade" });
    const [program] = await db.insert(schema.program).values({ name: `${PREFIX}pd-link-program` }).returning();
    const [cohort] = await db.insert(schema.cohort).values({ programId: program!.id, name: `${PREFIX}pd-link-cohort` }).returning();
    const [enrollment] = await db.insert(schema.enrollment).values({ cohortId: cohort!.id, organizationId: org, status: "active" }).returning();

    const token = await start("to-link");
    await put(null, `/public/diagnostic/${token}/responses`, { answers: fillIn(diagnostic, { Q135: "yes", Q137: yearAgo() }) });
    await post(null, `/public/diagnostic/${token}/submit`);
    const [row] = await db.select().from(schema.publicDiagnostic).where(eq(schema.publicDiagnostic.status, "submitted")).orderBy(desc(schema.publicDiagnostic.submittedAt)).limit(1);

    const link = () => post(w.reviewer, `/public-diagnostics/${row!.id}/link`, { enrollmentId: enrollment!.id });
    // The facilitator isn't on the cohort: the enrolment isn't theirs.
    expect((await link()).status).toBe(404);
    await db.insert(schema.cohortStaff).values({ cohortId: cohort!.id, userId: w.reviewer.id });
    // Nobody proved the address, so it might not be the business's.
    expect((await link()).status).toBe(422);
    await db.update(schema.publicDiagnostic).set({ emailVerifiedAt: new Date() }).where(eq(schema.publicDiagnostic.id, row!.id));
    const linked = await link();
    expect(linked.status).toBe(200);
    expect(linked.body).toMatchObject({ pathway: "B", status: "provisional" });
    const [avenue] = await db.select().from(schema.pathwayAssignment).where(eq(schema.pathwayAssignment.enrollmentId, enrollment!.id));
    expect(avenue).toMatchObject({ pathway: "B", status: "provisional", decidedByUserId: w.reviewer.id });
    expect((await link()).status).toBe(409);
    await db.delete(schema.program).where(eq(schema.program.id, program!.id));
  });

  it("shows one submission's answers", async () => {
    const list = await get(w.reviewer, `/public-diagnostics?q=${encodeURIComponent(submittedEmail)}`);
    const one = await get(w.reviewer, `/public-diagnostics/${list.body.items[0].sessions[0].id}`);
    expect(one.status).toBe(200);
    expect(one.body.pathway).toMatchObject({ pathway: "A" });
    const answered = one.body.sections.flatMap((section: { items: { id: string; answer: string }[] }) => section.items);
    expect(answered.find((item: { id: string }) => item.id === "Q135").answer).toBe("No");
    expect(one.body.sections[0].title).toBeTruthy();
    expect((await get(w.reviewer, "/public-diagnostics/not-an-id")).status).toBe(404);
  });

  it("exports the submissions as CSV, one column per question, safe to open in Excel", async () => {
    const res = await callFileV1(w.reviewer, "/trade/public-diagnostics/export.csv");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    expect(res.headers.get("content-disposition")).toContain("onboarding-diagnostics-");
    const text = await res.text();
    const header = text.split("\r\n")[0]!;
    expect(header).toContain("Phone");
    expect(header).toContain("Pathway");
    expect(header).toContain("Q135");
    expect(text).toContain(submittedEmail);
    expect(text).toContain(PHONE);
    // A name that starts like a formula is written as text.
    expect(text).toContain("'=cmd");
    expect(text).not.toMatch(/,=cmd/);
  });
});
