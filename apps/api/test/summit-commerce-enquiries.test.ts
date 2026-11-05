import { eq } from "drizzle-orm";
import { schema } from "@entrust/db";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { callV1, cleanup, createOrganization, db, PREFIX, signUp, type Json, type TestUser } from "./support";

// Sponsorship and opportunity enquiries: the public form, the pipeline an administrator works, and what confirming does.

const queue = vi.hoisted(() => ({ jobs: [] as { name: string; data: any }[], failNext: false }));
vi.mock("@entrust/jobs", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@entrust/jobs")>()),
  enqueue: vi.fn(async (name: string, data: unknown) => {
    if (queue.failNext) {
      queue.failNext = false;
      throw new Error("The queue is down");
    }
    queue.jobs.push({ name, data });
    return "job-1";
  }),
}));

const w = {} as { admin: TestUser; facilitator: TestUser; reviewer: TestUser; entrust: string; edition: Json; previous?: string };

const RUN = Date.now();
let n = 0;
const emailFor = (label: string) => `${PREFIX}spn-${RUN}-${label}-${++n}@example.test`;
const product = (slug: string): Json => w.edition.products.find((p: Json) => p.slug === slug);
const to = (email: string) => queue.jobs.filter((j) => j.name === "send-email" && j.data.to === email).map((j) => j.data);

const form = (overrides: Record<string, unknown> = {}) => ({
  productSlug: "gold-partner",
  organisationName: "Awash Bank",
  country: "ET",
  contactName: "Selam Tesfaye",
  position: "Head of Marketing",
  email: emailFor("form"),
  phone: "+251 911 000 000",
  sector: "Professional and business services",
  objectives: "Reach diaspora customers and SMEs.",
  consent: true,
  ...overrides,
});
const submit = (body: unknown) => callV1(null, "POST", "/summit/commerce/sponsor-enquiries", body);
const submitted = async (overrides: Record<string, unknown> = {}) => {
  const res = await submit(form(overrides));
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  const [row] = await db.select().from(schema.sponsorEnquiry).where(eq(schema.sponsorEnquiry.number, res.body.number));
  return { number: res.body.number as string, id: row!.id, email: row!.email };
};
const move = (user: TestUser | null, id: string, status: string, note?: string) =>
  callV1(user, "POST", `/summit/commerce/sponsor-enquiries/${id}/status`, { status, ...(note ? { note } : {}) });
const enquiry = (id: string) => callV1(w.admin, "GET", `/summit/commerce/sponsor-enquiries/${id}`);
const setProduct = (slug: string, patch: Record<string, unknown>) => callV1(w.admin, "PATCH", `/summit/commerce/products/${product(slug).id}`, patch);
const availabilityOf = async (slug: string) => {
  const { body } = await callV1(null, "GET", "/summit/commerce/catalogue");
  return [...body.sponsorship, ...body.opportunities].find((p: Json) => p.slug === slug).availability;
};

beforeAll(async () => {
  await cleanup();
  const [admin, facilitator, reviewer] = await Promise.all(["sp-admin", "sp-facilitator", "sp-reviewer"].map(signUp));
  Object.assign(w, { admin, facilitator, reviewer });
  w.entrust = await createOrganization("sp-entrust", [[admin!, "admin"], [facilitator!, "facilitator"], [reviewer!, "reviewer"]], { smeProfile: false });
  process.env.ENTRUST_ORG_ID = w.entrust;
  [{ id: w.previous } = { id: undefined }] = await db.select({ id: schema.commerceEdition.id }).from(schema.commerceEdition).where(eq(schema.commerceEdition.isCurrent, true));
  const created = await callV1(admin!, "POST", "/summit/commerce/editions", { name: "Sponsor test summit", slug: `${PREFIX}sp-${RUN}` });
  expect(created.status, JSON.stringify(created.body)).toBe(201);
  w.edition = created.body;
  await callV1(admin!, "PATCH", `/summit/commerce/editions/${created.body.id}`, {
    isCurrent: true,
    paymentMethods: [{ id: "bank-transfer", label: "Bank transfer", instructions: "Pay to the ADTIS account shown on the invoice." }],
  });
});

beforeEach(() => {
  queue.jobs.length = 0;
  queue.failNext = false;
});

afterAll(async () => {
  delete process.env.ENTRUST_ORG_ID;
  await cleanup();
  if (w.previous) await db.update(schema.commerceEdition).set({ isCurrent: true }).where(eq(schema.commerceEdition.id, w.previous));
});

describe("the public enquiry form", () => {
  it("needs no sign-in, records a new enquiry at the listed price, and emails a receipt that promises nothing", async () => {
    const res = await submit(form({ email: `  ${PREFIX.toUpperCase()}Spn-${RUN}-Mixed@Example.Test `, requirements: "A speaking slot" }));
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    expect(res.body).toMatchObject({ productName: "Gold Partner", price: "$6,250" });
    expect(res.body.number).toMatch(/^SPN-\d{4,}$/);
    const [row] = await db.select().from(schema.sponsorEnquiry).where(eq(schema.sponsorEnquiry.number, res.body.number));
    expect(row).toMatchObject({ status: "new", valueCents: 625000, requirements: "A speaking slot", email: `${PREFIX}spn-${RUN}-mixed@example.test` });
    const mail = to(row!.email);
    expect(mail).toHaveLength(1);
    expect(JSON.stringify(mail[0].props)).toContain("Nothing is due and nothing is reserved yet");
    expect(JSON.stringify(mail[0].props)).toContain("signed sponsorship agreement");
  });

  it("takes an additional opportunity as well as a sponsorship level, but not an exhibition package", async () => {
    expect((await submit(form({ productSlug: "investor-reception" }))).status).toBe(201);
    expect((await submit(form({ productSlug: "standard-sme-booth" }))).status).toBe(404);
    expect((await submit(form({ productSlug: "general-business" }))).status).toBe(404);
    expect((await submit(form({ productSlug: "nothing-here" }))).status).toBe(404);
  });

  it("replaces a new enquiry from the same address, and leaves one under discussion alone", async () => {
    const email = emailFor("again");
    const first = await submitted({ email, objectives: "First thoughts" });
    const second = await submit(form({ email, objectives: "Better wording" }));
    expect(second.body.number).toBe(first.number);
    expect((await enquiry(first.id)).body.objectives).toBe("Better wording");
    expect(to(email)).toHaveLength(1);
    await move(w.admin, first.id, "negotiation");
    const third = await submit(form({ email, objectives: "Rewritten mid-negotiation" }));
    expect(third.body.number).toBe(first.number);
    expect((await enquiry(first.id)).body.objectives).toBe("Better wording");
  });

  it("is answered like a success but stored nowhere when the trap field is filled in", async () => {
    const email = emailFor("bot");
    expect((await submit(form({ email, nickname: "robot" }))).status).toBe(201);
    expect(await db.select().from(schema.sponsorEnquiry).where(eq(schema.sponsorEnquiry.email, email))).toHaveLength(0);
  });

  it("refuses an incomplete form and a missing consent", async () => {
    expect((await submit(form({ organisationName: "" }))).status).toBe(400);
    expect((await submit(form({ objectives: "" }))).status).toBe(400);
    expect((await submit(form({ consent: false }))).status).toBe(400);
    expect((await submit(form({ country: "Kenya" }))).status).toBe(400);
  });

  it("still records the enquiry when the email queue is down", async () => {
    queue.failNext = true;
    const email = emailFor("queue");
    expect((await submit(form({ email }))).status).toBe(201);
    const [row] = await db.select().from(schema.sponsorEnquiry).where(eq(schema.sponsorEnquiry.email, email));
    expect(row?.receiptSentAt).toBeNull();
  });

  it("takes no enquiries for an option whose places are all confirmed", async () => {
    await setProduct("title-partner", { capacity: 1 });
    const a = await submitted({ productSlug: "title-partner" });
    expect((await move(w.admin, a.id, "confirmed")).status).toBe(200);
    expect(await availabilityOf("title-partner")).toEqual({ remaining: 0, soldOut: true });
    const res = await submit(form({ productSlug: "title-partner" }));
    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/no longer available/);
    await move(w.admin, a.id, "declined");
    expect(await availabilityOf("title-partner")).toEqual({ remaining: 1, soldOut: false });
    await setProduct("title-partner", { capacity: null });
  });
});

describe("who can work the pipeline", () => {
  it("refuses signed-out callers and staff who aren't administrators or facilitators", async () => {
    const { id } = await submitted();
    expect((await callV1(null, "GET", "/summit/commerce/sponsor-enquiries")).status).toBe(401);
    expect((await callV1(w.reviewer, "GET", "/summit/commerce/sponsor-enquiries")).status).toBe(403);
    expect((await callV1(w.reviewer, "GET", `/summit/commerce/sponsor-enquiries/${id}`)).status).toBe(403);
    expect((await move(w.reviewer, id, "contacted")).status).toBe(403);
    expect((await move(null, id, "contacted")).status).toBe(401);
    expect((await callV1(w.reviewer, "PATCH", `/summit/commerce/sponsor-enquiries/${id}`, { notes: "x" })).status).toBe(403);
  });

  it("lets a facilitator move an enquiry, and answers 404 for one that doesn't exist", async () => {
    const { id } = await submitted();
    expect((await move(w.facilitator, id, "contacted")).status).toBe(200);
    expect((await move(w.admin, "00000000-0000-4000-8000-000000000000", "contacted")).status).toBe(404);
  });
});

describe("the pipeline", () => {
  it("goes through contacted, negotiation and proposal sent, keeping a history of who moved it and why", async () => {
    const { id } = await submitted();
    expect((await move(w.admin, id, "contacted", "Called the marketing head")).body.status).toBe("contacted");
    expect((await move(w.facilitator, id, "negotiation")).body.status).toBe("negotiation");
    const last = await move(w.admin, id, "proposal_sent", "Sent the Gold proposal");
    expect(last.body.history.map((h: Json) => [h.from, h.to, h.note])).toEqual([
      ["new", "contacted", "Called the marketing head"],
      ["contacted", "negotiation", null],
      ["negotiation", "proposal_sent", "Sent the Gold proposal"],
    ]);
    expect(last.body.history[0].by).toBe("sp-admin");
    expect(last.body.history[1].by).toBe("sp-facilitator");
  });

  it("refuses a move to the status it is already in, and sends no email for the working statuses", async () => {
    const { id, email } = await submitted();
    queue.jobs.length = 0;
    expect((await move(w.admin, id, "new")).status).toBe(409);
    await move(w.admin, id, "contacted");
    await move(w.admin, id, "proposal_sent");
    expect(to(email)).toHaveLength(0);
  });

  it("lets a declined enquiry be reopened, but not confirmed straight away", async () => {
    const { id } = await submitted();
    await move(w.admin, id, "declined", "Budget gone");
    expect((await move(w.admin, id, "confirmed")).status).toBe(409);
    expect((await move(w.admin, id, "contacted")).body.status).toBe("contacted");
  });

  it("records the negotiated value and the organisers' notes, and writes the change to the audit log", async () => {
    const { id } = await submitted();
    const res = await callV1(w.admin, "PATCH", `/summit/commerce/sponsor-enquiries/${id}`, { valueCents: 500000, notes: "Agreed a discount for a two-year deal" });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body).toMatchObject({ valueCents: 500000, notes: "Agreed a discount for a two-year deal" });
    const rows = await db.select().from(schema.auditLog).where(eq(schema.auditLog.entityId, id));
    const updated = rows.find((r) => r.action === "summit.commerce.enquiry.updated");
    expect(updated?.before).toMatchObject({ valueCents: 625000 });
    expect(updated?.after).toMatchObject({ valueCents: 500000 });
    // The notes are internal and are not copied into the audit log.
    expect(JSON.stringify(updated)).not.toContain("two-year deal");
    expect((await callV1(w.admin, "PATCH", `/summit/commerce/sponsor-enquiries/${id}`, { valueCents: -1 })).status).toBe(400);
  });
});

describe("confirming a sponsor", () => {
  it("opens a payment for the agreed value, emails the payment instructions, and counts against the option", async () => {
    await setProduct("silver-partner", { capacity: 2 });
    const { id, email } = await submitted({ productSlug: "silver-partner" });
    await callV1(w.admin, "PATCH", `/summit/commerce/sponsor-enquiries/${id}`, { valueCents: 300000 });
    queue.jobs.length = 0;
    const res = await move(w.admin, id, "confirmed", "Agreement signed");
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body).toMatchObject({ status: "confirmed", valueCents: 300000, paymentStatus: "pending" });
    expect(res.body.payment).toMatchObject({ status: "pending", amountDueCents: 300000, subjectType: "sponsorship", subjectId: id });
    const mail = to(email);
    expect(mail).toHaveLength(1);
    expect(mail[0].subject).toMatch(/sponsorship is confirmed/);
    expect(JSON.stringify(mail[0].props)).toContain("Pay to the ADTIS account shown on the invoice.");
    expect(mail[0].props.details).toContainEqual({ label: "Amount due", value: "$3,000 (USD)" });
    expect(await availabilityOf("silver-partner")).toEqual({ remaining: 1, soldOut: false });
    // Once confirmed the value is fixed here; the payment carries any later change.
    const again = await callV1(w.admin, "PATCH", `/summit/commerce/sponsor-enquiries/${id}`, { valueCents: 1 });
    expect(again.status).toBe(422);
    await setProduct("silver-partner", { capacity: null });
  });

  it("marks nothing paid: the sponsor's payment is verified like any other", async () => {
    const { id } = await submitted({ productSlug: "supporting-partner" });
    const confirmed = await move(w.admin, id, "confirmed");
    const paymentId = confirmed.body.payment.id;
    const bare = await callV1(w.admin, "PATCH", `/summit/commerce/payments/${paymentId}`, { status: "confirmed" });
    expect(bare.status).toBe(422);
    await callV1(w.admin, "PATCH", `/summit/commerce/payments/${paymentId}`, { reference: "WIRE-1", amountReceivedCents: 156000 });
    const paid = await callV1(w.admin, "PATCH", `/summit/commerce/payments/${paymentId}`, { status: "confirmed" });
    expect(paid.body.status).toBe("confirmed");
    expect((await enquiry(id)).body.paymentStatus).toBe("confirmed");
  });

  it("is refused when the option's places are taken, and the title partner's exclusivity holds for one sponsor", async () => {
    await setProduct("gold-partner", { capacity: 1 });
    const a = await submitted({ productSlug: "gold-partner" });
    const b = await submitted({ productSlug: "gold-partner" });
    const results = await Promise.all([move(w.admin, a.id, "confirmed"), move(w.admin, b.id, "confirmed")]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 422]);
    const loser = results.find((r) => r.status === 422)!;
    expect(loser.body.error).toMatch(/no place left/);
    await setProduct("gold-partner", { capacity: null });
  });

  it("declining a confirmed sponsor cancels a payment that was never paid, and leaves a verified one for a refund", async () => {
    const a = await submitted({ productSlug: "directory-advertisement" });
    await move(w.admin, a.id, "confirmed");
    const declined = await move(w.admin, a.id, "declined", "Pulled out");
    expect(declined.body.payment.status).toBe("cancelled");
    // Coming back reopens the cancelled payment at the value.
    await move(w.admin, a.id, "negotiation");
    const back = await move(w.admin, a.id, "confirmed");
    expect(back.body.payment).toMatchObject({ status: "pending", amountDueCents: 31300 });

    const b = await submitted({ productSlug: "sme-profile-sponsorship" });
    const confirmed = await move(w.admin, b.id, "confirmed");
    const paymentId = confirmed.body.payment.id;
    await callV1(w.admin, "PATCH", `/summit/commerce/payments/${paymentId}`, { reference: "WIRE-2", amountReceivedCents: 62500 });
    await callV1(w.admin, "PATCH", `/summit/commerce/payments/${paymentId}`, { status: "confirmed" });
    const out = await move(w.admin, b.id, "declined", "Withdrew");
    expect(out.body.payment.status).toBe("confirmed");
  });
});

describe("the list and the pipeline value", () => {
  it("filters by status, kind and search, and totals what is still open and what is confirmed", async () => {
    const tagged = `Searchable-${RUN}`;
    const a = await submitted({ organisationName: tagged, productSlug: "gold-partner" });
    const b = await submitted({ organisationName: `Other-${RUN}`, productSlug: "sponsored-conference-session" });
    await move(w.admin, a.id, "proposal_sent");
    await move(w.admin, b.id, "confirmed");
    const list = (query: string) => callV1(w.facilitator, "GET", `/summit/commerce/sponsor-enquiries${query}`);

    const found = await list(`?q=${tagged}`);
    expect(found.body.items.map((i: Json) => i.organisationName)).toEqual([tagged]);
    expect(found.body.items[0]).toMatchObject({ number: a.number, status: "proposal_sent", productName: "Gold Partner", productKind: "sponsorship_level", valueCents: 625000 });
    const opportunities = await list(`?kind=opportunity&q=Other-${RUN}`);
    expect(opportunities.body.items.map((i: Json) => i.productKind)).toEqual(["opportunity"]);
    expect(opportunities.body.items[0].paymentStatus).toBe("pending");
    const confirmedOnly = await list("?status=confirmed");
    expect(confirmedOnly.body.items.every((i: Json) => i.status === "confirmed")).toBe(true);

    const { pipeline, byStatus } = found.body;
    expect(Object.keys(byStatus).sort()).toEqual(["confirmed", "contacted", "declined", "negotiation", "new", "proposal_sent"]);
    expect(pipeline.openCount).toBe(byStatus.new + byStatus.contacted + byStatus.negotiation + byStatus.proposal_sent);
    expect(pipeline.confirmedCount).toBe(byStatus.confirmed);
    expect(pipeline.openValueCents).toBeGreaterThanOrEqual(625000);
    expect(pipeline.confirmedValueCents).toBeGreaterThanOrEqual(156000);
    expect((await list("?q=%25")).body.items).toEqual([]);
  });
});
