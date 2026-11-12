import { and, eq, inArray, like } from "drizzle-orm";
import { schema } from "@entrust/db";
import { visibleQuestions, type FormDefinition } from "@entrust/forms";
import { latestDiagnosticTemplate } from "@entrust/trade-rules";
import { hashToken } from "../src/services/trade-public-diagnostic";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PREFIX, callV1, cleanup, createOrganization, db, signUp, type TestUser } from "./support";

// Until 12 November 2026 the diagnostic's amount boxes were too narrow to show what was typed, so submissions hold amounts
// typed blind. Staff can ask a business for its amounts again: the business gets a new private link that opens only the
// amount questions, and nothing else in the submission (nor its avenue) changes.

const queued = vi.hoisted(() => [] as Array<{ name: string; data: { to?: string; subject?: string; props?: { action?: { url?: string } } } }>);
vi.mock("@entrust/jobs", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@entrust/jobs")>()),
  enqueue: async (name: string, data: never) => {
    queued.push({ name, data });
    return "job";
  },
}));

const get = (user: TestUser | null, path: string) => callV1(user, "GET", `/trade${path}`);
const post = (user: TestUser | null, path: string, body?: unknown) => callV1(user, "POST", `/trade${path}`, body);
const put = (user: TestUser | null, path: string, body?: unknown) => callV1(user, "PUT", `/trade${path}`, body);
const email = (name: string) => `${PREFIX}amounts-${Math.random().toString(36).slice(2, 8)}-${name}@example.test`;

const diagnostic = latestDiagnosticTemplate() as FormDefinition;
const w = {} as { sme: TestUser; facilitator: TestUser; entrust: string };

/** Answers every question the form shows, with a blind-typed amount for each money question. */
function fillIn(): Record<string, unknown> {
  const answers: Record<string, unknown> = {};
  for (let round = 0; round < 12; round++) {
    let added = false;
    for (const q of visibleQuestions(diagnostic, answers as never)) {
      if (q.id in answers) continue;
      added = true;
      answers[q.id] =
        q.id === "Q135" ? "no"
        : q.type === "yes_no" ? (q.mustBe ?? "no")
        : q.type === "single_choice" ? q.options![0]!.value
        : q.type === "multiple_choice" ? [q.options!.find((o) => !o.exclusive)!.value]
        : q.type === "number" ? (q.min ?? 1)
        : q.type === "money" ? { amount: 5.000000552865e25, currency: "ETB" }
        : q.type === "date" ? "2020-01-01"
        : q.type === "list" ? ["One"]
        : "Some words";
    }
    if (!added) break;
  }
  return answers;
}

const moneyIds = () => visibleQuestions(diagnostic, fillIn() as never).filter((q) => q.type === "money").map((q) => q.id);

/** A submitted diagnostic: its token and its row ID. */
async function submitted(name: string) {
  const address = email(name);
  const started = await post(null, "/public/diagnostic", { email: address, phone: "+251 91 123 4567", businessName: `Business ${name}` });
  const token = started.body.token as string;
  expect((await put(null, `/public/diagnostic/${token}/responses`, { answers: fillIn() })).status).toBe(200);
  expect((await post(null, `/public/diagnostic/${token}/submit`)).status).toBe(200);
  const [row] = await db.select().from(schema.publicDiagnostic).where(eq(schema.publicDiagnostic.email, address));
  return { token, id: row!.id, address };
}

/** Staff ask for the amounts; returns the token from the emailed link. */
async function request(id: string, address: string) {
  queued.length = 0;
  const res = await post(w.facilitator, `/public-diagnostics/${id}/request-amounts`);
  expect(res.status).toBe(200);
  const mail = queued.find((job) => job.data.to === address);
  expect(mail?.data.subject).toContain("enter your amounts again");
  return new URL(mail!.data.props!.action!.url!).pathname.split("/").pop()!;
}

const ids: string[] = [];

beforeAll(async () => {
  await db.delete(schema.publicDiagnostic).where(like(schema.publicDiagnostic.email, `${PREFIX}%`));
  const [sme, facilitator] = (await Promise.all(["amounts-sme", "amounts-facilitator"].map(signUp))) as [TestUser, TestUser];
  Object.assign(w, { sme, facilitator });
  await createOrganization("amounts-sme-org", [[sme, "owner"]], { platform: "trade" });
  w.entrust = await createOrganization("amounts-entrust", [[facilitator, "facilitator"]], { smeProfile: false });
  process.env.ENTRUST_ORG_ID = w.entrust;
});

afterAll(async () => {
  delete process.env.ENTRUST_ORG_ID;
  if (ids.length) await db.delete(schema.auditLog).where(and(eq(schema.auditLog.entityType, "public_diagnostic"), inArray(schema.auditLog.entityId, ids)));
  await db.delete(schema.publicDiagnostic).where(like(schema.publicDiagnostic.email, `${PREFIX}%`));
  await cleanup();
});

beforeEach(() => {
  queued.length = 0;
});

describe("asking a business for its amounts again", () => {
  it("is for Entrust staff only, and only for a submitted form", async () => {
    const form = await submitted("staff-only");
    ids.push(form.id);
    expect((await post(null, `/public-diagnostics/${form.id}/request-amounts`)).status).toBe(401);
    expect((await post(w.sme, `/public-diagnostics/${form.id}/request-amounts`)).status).toBe(403);
    expect((await post(w.facilitator, "/public-diagnostics/not-an-id/request-amounts")).status).toBe(404);

    const draft = await post(null, "/public/diagnostic", { email: email("draft"), phone: "+251 91 123 4567", businessName: "Business draft" });
    const [row] = await db.select().from(schema.publicDiagnostic).where(eq(schema.publicDiagnostic.tokenHash, await hashToken(draft.body.token)));
    ids.push(row!.id);
    expect((await post(w.facilitator, `/public-diagnostics/${row!.id}/request-amounts`)).status).toBe(422);
    // Nothing was asked of anyone: the only emails are the ones starting and submitting the forms sent.
    expect(queued.filter((job) => job.data.subject?.includes("amounts"))).toHaveLength(0);
  });

  it("emails a new private link, and the old one stops working", async () => {
    const form = await submitted("new-link");
    ids.push(form.id);
    const token = await request(form.id, form.address);
    expect(token).not.toBe(form.token);
    expect((await get(null, `/public/diagnostic/${form.token}`)).status).toBe(404);

    const view = await get(null, `/public/diagnostic/${token}`);
    expect(view.status).toBe(200);
    expect(view.body).toMatchObject({ status: "submitted", amountsCorrectedAt: null });
    expect(view.body.amountsRequestedAt).toBeTruthy();

    const staff = await get(w.facilitator, `/public-diagnostics/${form.id}`);
    expect(staff.body.amountsRequestedAt).toBeTruthy();
    const [audit] = await db.select().from(schema.auditLog).where(and(eq(schema.auditLog.entityId, form.id), eq(schema.auditLog.action, "trade.public_diagnostic.amounts_requested")));
    expect(audit).toMatchObject({ actorUserId: w.facilitator.id });
  });

  it("takes every amount again and nothing else, then locks the form, leaving the avenue alone", async () => {
    const form = await submitted("correct");
    ids.push(form.id);
    const before = (await get(w.facilitator, `/public-diagnostics/${form.id}`)).body;
    const token = await request(form.id, form.address);
    const amounts = moneyIds();
    expect(amounts.length).toBeGreaterThan(3);

    // Only the amounts can be changed.
    const other = await put(null, `/public/diagnostic/${token}/amounts`, { answers: { Q135: "yes" } });
    expect(other.status).toBe(422);
    expect(other.body.error).toContain("only the amounts");
    // Every amount is asked again: one left out is unanswered, even though a blind-typed one was saved before.
    const some = await put(null, `/public/diagnostic/${token}/amounts`, { answers: { [amounts[0]!]: { amount: 2500000, currency: "ETB" } } });
    expect(some.status).toBe(422);
    // A wrong amount is refused.
    const wrong = await put(null, `/public/diagnostic/${token}/amounts`, { answers: Object.fromEntries(amounts.map((id) => [id, { amount: "lots", currency: "ETB" }])) });
    expect(wrong.status).toBe(422);

    const sent = Object.fromEntries(amounts.map((id, i) => [id, i === 1 ? { notKnown: true } : { amount: 1000 * (i + 1), currency: "ETB" }]));
    const saved = await put(null, `/public/diagnostic/${token}/amounts`, { answers: sent });
    expect(saved.status).toBe(200);
    expect(saved.body.amountsCorrectedAt).toBeTruthy();
    expect(saved.body.answers[amounts[0]!]).toEqual({ amount: 1000, currency: "ETB" });
    expect(saved.body.answers[amounts[1]!]).toEqual({ notKnown: true });
    expect(saved.body.answers.Q135).toBe("no");
    expect(saved.body.status).toBe("submitted");
    expect(saved.body.pathway).toEqual(before.pathway);

    // Sent once: after that the form is locked again, and the ordinary save stays closed.
    expect((await put(null, `/public/diagnostic/${token}/amounts`, { answers: sent })).status).toBe(409);
    expect((await put(null, `/public/diagnostic/${token}/responses`, { answers: { Q135: "yes" } })).status).toBe(409);

    const staff = (await get(w.facilitator, `/public-diagnostics/${form.id}`)).body;
    expect(staff.amountsCorrectedAt).toBeTruthy();
    const items = staff.sections.flatMap((s: { items: { id: string; answer: string }[] }) => s.items);
    expect(items.find((item: { id: string }) => item.id === amounts[0]).answer).toBe("1000 ETB");
    const [audit] = await db.select().from(schema.auditLog).where(and(eq(schema.auditLog.entityId, form.id), eq(schema.auditLog.action, "trade.public_diagnostic.amounts_corrected")));
    expect((audit!.before as Record<string, unknown>)[amounts[0]!]).toEqual({ amount: 5.000000552865e25, currency: "ETB" });
    expect((audit!.after as Record<string, unknown>)[amounts[0]!]).toEqual({ amount: 1000, currency: "ETB" });
  });

  it("refuses amounts nobody asked for", async () => {
    const form = await submitted("unasked");
    ids.push(form.id);
    const res = await put(null, `/public/diagnostic/${form.token}/amounts`, { answers: {} });
    expect(res.status).toBe(409);
  });
});
