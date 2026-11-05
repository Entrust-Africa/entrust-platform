import { and, eq } from "drizzle-orm";
import { schema } from "@entrust/db";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { callV1, cleanup, createOrganization, db, makeFile, PREFIX, signUp, type Json, type TestUser } from "./support";

// Exhibitor bookings and payments: the public application, an administrator's approval, payment verification, the booth,
// and the rule that nothing is confirmed or marked paid on its own.

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

const w = {} as { admin: TestUser; facilitator: TestUser; reviewer: TestUser; entrust: string; outsiderOrg: string; edition: Json; previous?: string };

const RUN = Date.now();
let n = 0;
const emailFor = (label: string) => `${PREFIX}book-${RUN}-${label}-${++n}@example.test`;
const product = (slug: string): Json => w.edition.products.find((p: Json) => p.slug === slug);
const emails = () => queue.jobs.filter((j) => j.name === "send-email").map((j) => j.data);
const to = (email: string) => emails().filter((e) => e.to === email);

const form = (overrides: Record<string, unknown> = {}) => ({
  packageSlug: "standard-sme-booth",
  companyName: "ZEBU Coffee",
  country: "ET",
  registrationDetails: "Trade licence 0012345, Addis Ababa Trade Bureau",
  contactName: "Amina Bekele",
  position: "Export manager",
  email: emailFor("form"),
  phone: "+251 911 000 000",
  sector: "Agriculture and agro-processing",
  productsServices: "Green coffee",
  consent: true,
  ...overrides,
});
const apply = (body: unknown) => callV1(null, "POST", "/summit/commerce/exhibitor-applications", body);
const applied = async (overrides: Record<string, unknown> = {}) => {
  const res = await apply(form(overrides));
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  const [row] = await db.select().from(schema.exhibitorBooking).where(eq(schema.exhibitorBooking.number, res.body.number));
  return { number: res.body.number as string, id: row!.id, email: row!.email };
};
const act = (user: TestUser | null, id: string, action: string, body?: unknown) =>
  callV1(user, "POST", `/summit/commerce/exhibitor-bookings/${id}/${action}`, body);
const booking = (id: string) => callV1(w.admin, "GET", `/summit/commerce/exhibitor-bookings/${id}`);
const setProduct = (slug: string, patch: Record<string, unknown>) => callV1(w.admin, "PATCH", `/summit/commerce/products/${product(slug).id}`, patch);
const remaining = async (slug: string) => {
  const { body } = await callV1(null, "GET", "/summit/commerce/catalogue");
  return body.exhibition.find((p: Json) => p.slug === slug).availability;
};

beforeAll(async () => {
  await cleanup();
  const [admin, facilitator, reviewer] = await Promise.all(["bk-admin", "bk-facilitator", "bk-reviewer"].map(signUp));
  Object.assign(w, { admin, facilitator, reviewer });
  w.entrust = await createOrganization("bk-entrust", [[admin!, "admin"], [facilitator!, "facilitator"], [reviewer!, "reviewer"]], { smeProfile: false });
  w.outsiderOrg = await createOrganization("bk-sme", [[reviewer!, "owner"]]);
  process.env.ENTRUST_ORG_ID = w.entrust;
  [{ id: w.previous } = { id: undefined }] = await db.select({ id: schema.commerceEdition.id }).from(schema.commerceEdition).where(eq(schema.commerceEdition.isCurrent, true));
  const created = await callV1(admin!, "POST", "/summit/commerce/editions", { name: "Booking test summit", slug: `${PREFIX}bk-${RUN}` });
  expect(created.status, JSON.stringify(created.body)).toBe(201);
  w.edition = created.body;
  await callV1(admin!, "PATCH", `/summit/commerce/editions/${created.body.id}`, {
    isCurrent: true,
    exhibitionZones: ["Hall A", "Hall B"],
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

describe("applying for a booth", () => {
  it("needs no sign-in, records the application at today's price, and emails a receipt", async () => {
    const body = form({ email: `  ${PREFIX.toUpperCase()}Book-${RUN}-Mixed@Example.Test `, website: "https://zebu.example", comments: "Near the entrance, please" });
    const res = await apply(body);
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    expect(res.body).toMatchObject({ packageName: "Standard SME Booth", amountCents: 50000, price: "$500" });
    expect(res.body.number).toMatch(/^EXH-\d{4,}$/);

    const [row] = await db.select().from(schema.exhibitorBooking).where(eq(schema.exhibitorBooking.number, res.body.number));
    expect(row).toMatchObject({ status: "submitted", email: `${PREFIX}book-${RUN}-mixed@example.test`, country: "ET", amountCents: 50000, boothNumber: null, comments: "Near the entrance, please" });

    const mail = to(row!.email);
    expect(mail).toHaveLength(1);
    expect(mail[0]).toMatchObject({ template: "summit-notice", subject: `We have your ADTIS exhibition application ${res.body.number}` });
    expect(JSON.stringify(mail[0].props)).toContain("No booth is reserved yet");
    expect(mail[0].props.details).toContainEqual({ label: "Reference", value: res.body.number });
  });

  it("holds no booth, so a package with one left still shows it left", async () => {
    await setProduct("sme-table-top", { capacity: 1 });
    await applied({ packageSlug: "sme-table-top" });
    await applied({ packageSlug: "sme-table-top" });
    expect(await remaining("sme-table-top")).toEqual({ remaining: 1, soldOut: false });
  });

  it("replaces a waiting application from the same address, and keeps an approved one as it is", async () => {
    const email = emailFor("again");
    const first = await applied({ email, companyName: "First name" });
    const second = await apply(form({ email, companyName: "Corrected name" }));
    expect(second.body.number).toBe(first.number);
    expect((await booking(first.id)).body.companyName).toBe("Corrected name");
    // The receipt is not sent twice in a day.
    expect(to(email)).toHaveLength(1);

    expect((await act(w.admin, first.id, "approve", {})).status).toBe(200);
    const third = await apply(form({ email, companyName: "Rewritten after approval" }));
    expect(third.body.number).toBe(first.number);
    expect((await booking(first.id)).body.companyName).toBe("Corrected name");
  });

  it("is answered like a success but stored nowhere when the trap field is filled in", async () => {
    const email = emailFor("bot");
    const res = await apply(form({ email, nickname: "robot" }));
    expect(res.status).toBe(201);
    expect(await db.select().from(schema.exhibitorBooking).where(eq(schema.exhibitorBooking.email, email))).toHaveLength(0);
    expect(to(email)).toHaveLength(0);
  });

  it("refuses an incomplete form, a missing consent, and a bad country or email", async () => {
    expect((await apply(form({ companyName: "" }))).status).toBe(400);
    expect((await apply(form({ consent: false }))).status).toBe(400);
    expect((await apply(form({ country: "Ethiopia" }))).status).toBe(400);
    expect((await apply(form({ email: "not-an-email" }))).status).toBe(400);
  });

  it("refuses a package that doesn't exist, a draft one, or one that isn't an exhibition package", async () => {
    expect((await apply(form({ packageSlug: "no-such-booth" }))).status).toBe(404);
    expect((await apply(form({ packageSlug: "title-partner" }))).status).toBe(404);
    await setProduct("premium-sme-booth", { status: "draft" });
    expect((await apply(form({ packageSlug: "premium-sme-booth" }))).status).toBe(404);
    await setProduct("premium-sme-booth", { status: "published" });
  });

  it("takes no applications for a sold-out package", async () => {
    await setProduct("international-exhibitor-booth", { markedSoldOut: true });
    const res = await apply(form({ packageSlug: "international-exhibitor-booth" }));
    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/sold out/);
    await setProduct("international-exhibitor-booth", { markedSoldOut: false });
  });

  it("still saves the application when the email queue is down", async () => {
    queue.failNext = true;
    const email = emailFor("queue");
    const res = await apply(form({ email }));
    expect(res.status).toBe(201);
    const [row] = await db.select().from(schema.exhibitorBooking).where(eq(schema.exhibitorBooking.email, email));
    expect(row).toBeDefined();
    expect(row!.receiptSentAt).toBeNull();
  });
});

describe("who can handle bookings", () => {
  it("refuses signed-out callers and staff who aren't administrators or facilitators", async () => {
    const { id } = await applied();
    expect((await callV1(null, "GET", "/summit/commerce/exhibitor-bookings")).status).toBe(401);
    expect((await callV1(w.reviewer, "GET", "/summit/commerce/exhibitor-bookings")).status).toBe(403);
    expect((await callV1(w.reviewer, "GET", `/summit/commerce/exhibitor-bookings/${id}`)).status).toBe(403);
    for (const action of ["approve", "reject", "cancel", "confirm"]) {
      expect((await act(w.reviewer, id, action, { reason: "no", note: "no" })).status, action).toBe(403);
      expect((await act(null, id, action, { reason: "no" })).status, action).toBe(401);
    }
    expect((await callV1(w.reviewer, "PUT", `/summit/commerce/exhibitor-bookings/${id}/allocation`, { boothNumber: "A1", zone: null })).status).toBe(403);
  });

  it("lets a facilitator approve", async () => {
    const { id } = await applied();
    expect((await act(w.facilitator, id, "approve", {})).status).toBe(200);
  });

  it("answers 404 for a booking that doesn't exist", async () => {
    expect((await act(w.admin, "00000000-0000-4000-8000-000000000000", "approve", {})).status).toBe(404);
  });
});

describe("approving", () => {
  it("holds a booth, opens a pending payment at the price applied at, and emails the payment instructions", async () => {
    const { id, email } = await applied({ packageSlug: "premium-sme-booth" });
    await setProduct("premium-sme-booth", { priceCents: 123400 });
    queue.jobs.length = 0;
    const res = await act(w.admin, id, "approve", { note: "Welcome aboard.", zone: "Hall A" });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body).toMatchObject({ status: "approved", amountCents: 90000, zone: "Hall A", paymentStatus: "pending", decisionNote: "Welcome aboard." });
    expect(res.body.payment).toMatchObject({ status: "pending", amountDueCents: 90000, amountReceivedCents: null, verifiedBy: null });
    expect(res.body.decidedBy.id).toBe(w.admin.id);

    const mail = to(email);
    expect(mail).toHaveLength(1);
    const text = JSON.stringify(mail[0].props);
    expect(mail[0].subject).toMatch(/is approved/);
    expect(text).toContain("Pay to the ADTIS account shown on the invoice.");
    expect(text).toContain("VAT");
    expect(mail[0].props.details).toContainEqual({ label: "Amount due", value: "$900 (USD)" });
    await setProduct("premium-sme-booth", { priceCents: 90000 });
  });

  it("tells the applicant payment instructions will follow when none are set up", async () => {
    await callV1(w.admin, "PATCH", `/summit/commerce/editions/${w.edition.id}`, { paymentMethods: [] });
    const { id, email } = await applied();
    queue.jobs.length = 0;
    await act(w.admin, id, "approve", {});
    expect(JSON.stringify(to(email)[0].props)).toContain("will send you the payment instructions shortly");
    await callV1(w.admin, "PATCH", `/summit/commerce/editions/${w.edition.id}`, {
      paymentMethods: [{ id: "bank-transfer", label: "Bank transfer", instructions: "Pay to the ADTIS account shown on the invoice." }],
    });
  });

  it("cannot be done twice, or after a rejection", async () => {
    const { id } = await applied();
    expect((await act(w.admin, id, "approve", {})).status).toBe(200);
    expect((await act(w.admin, id, "approve", {})).status).toBe(409);
    const other = await applied();
    expect((await act(w.admin, other.id, "reject", { reason: "Outside the sectors we seek" })).status).toBe(200);
    expect((await act(w.admin, other.id, "approve", {})).status).toBe(409);
  });

  it("is refused once the package's approved bookings fill its capacity, and the package then shows sold out", async () => {
    await setProduct("corporate-institutional-booth", { capacity: 1 });
    const a = await applied({ packageSlug: "corporate-institutional-booth" });
    const b = await applied({ packageSlug: "corporate-institutional-booth" });
    expect((await act(w.admin, a.id, "approve", {})).status).toBe(200);
    expect(await remaining("corporate-institutional-booth")).toEqual({ remaining: 0, soldOut: true });
    const second = await act(w.admin, b.id, "approve", {});
    expect(second.status).toBe(422);
    expect(second.body.error).toMatch(/no booth left/);
    // New applications are refused too.
    expect((await apply(form({ packageSlug: "corporate-institutional-booth" }))).status).toBe(422);
    // Cancelling the first frees the booth for the second.
    expect((await act(w.admin, a.id, "cancel", { reason: "Changed plans" })).status).toBe(200);
    expect(await remaining("corporate-institutional-booth")).toEqual({ remaining: 1, soldOut: false });
    expect((await act(w.admin, b.id, "approve", {})).status).toBe(200);
  });

  it("lets only one of two approvals for the last booth through when they arrive together", async () => {
    await setProduct("sme-table-top", { capacity: 1 });
    // Free any table-top booths held by earlier tests.
    const held = await db.select({ id: schema.exhibitorBooking.id }).from(schema.exhibitorBooking).where(and(eq(schema.exhibitorBooking.productId, product("sme-table-top").id), eq(schema.exhibitorBooking.status, "approved")));
    for (const h of held) await act(w.admin, h.id, "cancel", { reason: "Test reset" });
    const a = await applied({ packageSlug: "sme-table-top" });
    const b = await applied({ packageSlug: "sme-table-top" });
    const results = await Promise.all([act(w.admin, a.id, "approve", {}), act(w.admin, b.id, "approve", {})]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 422]);
  });

  it("is refused when the package is marked sold out", async () => {
    const { id } = await applied({ packageSlug: "standard-sme-booth" });
    await setProduct("standard-sme-booth", { markedSoldOut: true });
    expect((await act(w.admin, id, "approve", {})).status).toBe(422);
    await setProduct("standard-sme-booth", { markedSoldOut: false });
  });
});

describe("the booth", () => {
  it("gives a booth number to one held booking only, and releases it when the booking is cancelled", async () => {
    const a = await applied();
    const b = await applied();
    await act(w.admin, a.id, "approve", {});
    await act(w.admin, b.id, "approve", {});
    const put = (id: string, body: unknown) => callV1(w.admin, "PUT", `/summit/commerce/exhibitor-bookings/${id}/allocation`, body);
    expect((await put(a.id, { boothNumber: "A-12", zone: "Hall A" })).status).toBe(200);
    const clash = await put(b.id, { boothNumber: "A-12", zone: "Hall A" });
    expect(clash.status).toBe(422);
    expect(clash.body.error).toMatch(/already given to/);
    await act(w.admin, a.id, "cancel", { reason: "Withdrew" });
    expect((await put(b.id, { boothNumber: "A-12", zone: "Hall B" })).status).toBe(200);
  });

  it("accepts only the edition's zones, and only for an approved or confirmed booking", async () => {
    const { id } = await applied();
    const put = (body: unknown) => callV1(w.admin, "PUT", `/summit/commerce/exhibitor-bookings/${id}/allocation`, body);
    expect((await put({ boothNumber: "Z-1", zone: "Hall A" })).status).toBe(409);
    await act(w.admin, id, "approve", {});
    const bad = await put({ boothNumber: "Z-1", zone: "Hall Z" });
    expect(bad.status).toBe(422);
    expect(bad.body.error).toMatch(/Hall A, Hall B/);
    const fresh = await applied();
    const wrongZone = await act(w.admin, fresh.id, "approve", { zone: "Nowhere" });
    expect(wrongZone.status).toBe(422);
    expect(wrongZone.body.error).toMatch(/Hall A, Hall B/);
    expect((await booking(fresh.id)).body.status).toBe("submitted");
    expect((await put({ boothNumber: "Z-1", zone: "Hall B" })).status).toBe(200);
  });
});

describe("confirming a booth", () => {
  const paymentUrl = (id: string) => `/summit/commerce/payments/${id}`;
  const pay = (paymentId: string, patch: unknown, user: TestUser = w.admin) => callV1(user, "PATCH", paymentUrl(paymentId), patch);
  const approved = async (overrides: Record<string, unknown> = {}) => {
    const a = await applied(overrides);
    const res = await act(w.admin, a.id, "approve", {});
    return { ...a, paymentId: res.body.payment.id as string };
  };
  let approvedNumber = "";

  it("is refused for an application that has not been approved", async () => {
    const { id } = await applied();
    const res = await act(w.admin, id, "confirm");
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/Only an approved application/);
  });

  it("is refused until the payment is verified and a booth number is given, and then sends the confirmation", async () => {
    const { id, email, paymentId, number } = await approved();
    approvedNumber = number;
    queue.jobs.length = 0;

    let res = await act(w.admin, id, "confirm");
    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/payment has not been verified/);
    expect(res.body.error).toMatch(/No booth number/);
    expect((await booking(id)).body.blockers).toHaveLength(2);

    // A reference and a proof alone do not make a payment paid: it waits for verification.
    const recorded = await pay(paymentId, { reference: "TRF-889", method: "bank-transfer", amountReceivedCents: 50000 });
    expect(recorded.status, JSON.stringify(recorded.body)).toBe(200);
    expect(recorded.body.status).toBe("awaiting_verification");
    expect((await booking(id)).body.paymentStatus).toBe("awaiting_verification");
    expect((await act(w.admin, id, "confirm")).status).toBe(422);

    await callV1(w.admin, "PUT", `/summit/commerce/exhibitor-bookings/${id}/allocation`, { boothNumber: "B-07", zone: "Hall B" });
    res = await act(w.admin, id, "confirm");
    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/payment has not been verified/);
    expect(to(email)).toHaveLength(0);

    const verified = await pay(paymentId, { status: "confirmed" });
    expect(verified.status, JSON.stringify(verified.body)).toBe(200);
    expect(verified.body).toMatchObject({ status: "confirmed", reference: "TRF-889" });
    expect(verified.body.verifiedBy.id).toBe(w.admin.id);
    expect(verified.body.verifiedAt).toBeTruthy();
    // Verifying the payment is not confirming the booth.
    expect((await booking(id)).body.status).toBe("approved");

    res = await act(w.admin, id, "confirm");
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body).toMatchObject({ status: "confirmed", boothNumber: "B-07", zone: "Hall B", blockers: ["Only an approved application can be confirmed."] });
    expect(res.body.confirmedAt).toBeTruthy();
    // The payment's verification and the booth's confirmation are two emails.
    const mail = to(email);
    expect(mail.map((m) => m.subject)).toEqual([`Payment received for your ADTIS booth (${approvedNumber})`, expect.stringMatching(/booth is confirmed/)]);
    expect(mail[1].props.details).toContainEqual({ label: "Booth", value: "B-07" });
    expect((await act(w.admin, id, "confirm")).status).toBe(409);
  });

  it("keeps a confirmed booking's booth number and refuses to clear it", async () => {
    const { id, paymentId } = await approved();
    await callV1(w.admin, "PUT", `/summit/commerce/exhibitor-bookings/${id}/allocation`, { boothNumber: "C-01", zone: null });
    await pay(paymentId, { reference: "R1", amountReceivedCents: 50000 });
    await pay(paymentId, { status: "confirmed" });
    await act(w.admin, id, "confirm");
    const res = await callV1(w.admin, "PUT", `/summit/commerce/exhibitor-bookings/${id}/allocation`, { boothNumber: null, zone: null });
    expect(res.status).toBe(422);
  });

  it("writes who confirmed it and what changed to the audit log", async () => {
    const { id, paymentId } = await approved();
    await callV1(w.admin, "PUT", `/summit/commerce/exhibitor-bookings/${id}/allocation`, { boothNumber: "D-01", zone: null });
    await pay(paymentId, { reference: "R2", amountReceivedCents: 50000 });
    await pay(paymentId, { status: "confirmed" });
    await act(w.admin, id, "confirm");
    const rows = await db.select().from(schema.auditLog).where(eq(schema.auditLog.entityId, id));
    expect(rows.map((r) => r.action).sort()).toEqual(
      ["summit.commerce.booking.allocated", "summit.commerce.booking.approved", "summit.commerce.booking.confirmed", "summit.commerce.booking.submitted"].sort(),
    );
    expect(rows.find((r) => r.action === "summit.commerce.booking.confirmed")).toMatchObject({ actorUserId: w.admin.id, platform: "summit" });
    const paymentRows = await db.select().from(schema.auditLog).where(eq(schema.auditLog.entityId, paymentId));
    expect(paymentRows.map((r) => r.action)).toContain("summit.commerce.payment.updated");
  });

  describe("recording payments", () => {
    it("will not confirm a payment with no reference or proof, or one that doesn't cover the amount owed", async () => {
      const { paymentId } = await approved();
      const bare = await pay(paymentId, { status: "confirmed" });
      expect(bare.status).toBe(422);
      expect(bare.body.error).toMatch(/reference or attach the proof/);
      const short = await pay(paymentId, { reference: "R3", amountReceivedCents: 49999, status: "confirmed" });
      expect(short.status).toBe(422);
      expect(short.body.error).toMatch(/doesn't cover/);
      // Nothing was saved by the refused call.
      const after = await pay(paymentId, { note: "Waiting for the rest" });
      expect(after.body).toMatchObject({ status: "pending", reference: null, amountReceivedCents: null });
    });

    it("moves a pending payment to awaiting verification when a reference or proof is recorded, never to confirmed", async () => {
      const { paymentId } = await approved();
      expect((await pay(paymentId, { reference: "R4" })).body.status).toBe("awaiting_verification");
      expect((await pay(paymentId, { status: "pending" })).body.status).toBe("pending");
    });

    it("lets a facilitator record payments but only an administrator change the amount owed", async () => {
      const { paymentId } = await approved();
      expect((await pay(paymentId, { reference: "R5" }, w.facilitator)).status).toBe(200);
      expect((await pay(paymentId, { amountDueCents: 100 }, w.facilitator)).status).toBe(403);
      const changed = await pay(paymentId, { amountDueCents: 40000 });
      expect(changed.body.amountDueCents).toBe(40000);
      expect((await pay(paymentId, { reference: "x" }, w.reviewer)).status).toBe(403);
      expect((await callV1(null, "PATCH", paymentUrl(paymentId), { note: "x" })).status).toBe(401);
    });

    it("allows a refund only after a confirmed payment", async () => {
      const { paymentId } = await approved();
      const early = await pay(paymentId, { status: "refunded" });
      expect(early.status).toBe(409);
      await pay(paymentId, { reference: "R6", amountReceivedCents: 50000 });
      await pay(paymentId, { status: "confirmed" });
      expect((await pay(paymentId, { status: "refunded", note: "Refunded in full" })).body.status).toBe("refunded");
      expect((await pay(paymentId, { status: "confirmed" })).status).toBe(409);
    });

    it("takes proof of payment only from a file in Entrust's own organisation, and links to it", async () => {
      const { paymentId } = await approved();
      const foreign = await makeFile(w.outsiderOrg, w.reviewer.id, "private.pdf");
      const refused = await pay(paymentId, { evidenceFileId: foreign });
      expect(refused.status).toBe(422);
      expect(refused.body.error).toMatch(/Entrust's organisation/);

      const proof = await makeFile(w.entrust, w.admin.id, "transfer-slip.pdf");
      const ok = await pay(paymentId, { evidenceFileId: proof });
      expect(ok.status, JSON.stringify(ok.body)).toBe(200);
      expect(ok.body).toMatchObject({ status: "awaiting_verification", evidence: { id: proof, name: "transfer-slip.pdf" } });
      const link = await callV1(w.facilitator, "GET", `${paymentUrl(paymentId)}/evidence-url`);
      expect(link.status, JSON.stringify(link.body)).toBe(200);
      expect(link.body.fileName).toBe("transfer-slip.pdf");
      expect((await callV1(w.reviewer, "GET", `${paymentUrl(paymentId)}/evidence-url`)).status).toBe(403);
    });

    it("has no evidence link when no proof is attached", async () => {
      const { paymentId } = await approved();
      expect((await callV1(w.admin, "GET", `${paymentUrl(paymentId)}/evidence-url`)).status).toBe(404);
    });
  });
});

describe("rejecting and cancelling", () => {
  it("rejects with a reason the applicant is sent, cancels an unpaid payment, and clears the booth", async () => {
    const { id, email } = await applied();
    await act(w.admin, id, "approve", { boothNumber: "R-1" });
    queue.jobs.length = 0;
    const res = await act(w.admin, id, "reject", { reason: "Outside the summit's sectors" });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: "rejected", boothNumber: null, decisionNote: "Outside the summit's sectors" });
    expect(res.body.payment.status).toBe("cancelled");
    expect(JSON.stringify(to(email)[0].props)).toContain("Outside the summit's sectors");
    expect((await act(w.admin, id, "cancel", { reason: "x1" })).status).toBe(409);
    expect((await act(w.admin, id, "reject", { reason: "" })).status).toBe(400);
  });

  it("cancels a confirmed booking, frees the booth, and leaves a verified payment for a person to refund", async () => {
    const { id, email } = await applied();
    const approvedRes = await act(w.admin, id, "approve", { boothNumber: "K-9" });
    const paymentId = approvedRes.body.payment.id;
    await callV1(w.admin, "PATCH", `/summit/commerce/payments/${paymentId}`, { reference: "R7", amountReceivedCents: 50000 });
    await callV1(w.admin, "PATCH", `/summit/commerce/payments/${paymentId}`, { status: "confirmed" });
    await act(w.admin, id, "confirm");
    queue.jobs.length = 0;
    const res = await act(w.admin, id, "cancel", { reason: "Exhibitor withdrew" });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("cancelled");
    expect(res.body.payment.status).toBe("confirmed");
    expect(to(email)[0].subject).toMatch(/is cancelled/);
    // The booth number is free again.
    const other = await applied();
    await act(w.admin, other.id, "approve", {});
    expect((await callV1(w.admin, "PUT", `/summit/commerce/exhibitor-bookings/${other.id}/allocation`, { boothNumber: "K-9", zone: null })).status).toBe(200);
  });

  it("sends no cancellation email for an application that never held a booth", async () => {
    const { id, email } = await applied();
    queue.jobs.length = 0;
    expect((await act(w.admin, id, "cancel", { reason: "Duplicate application" })).status).toBe(200);
    expect(to(email)).toHaveLength(0);
  });
});

describe("the list", () => {
  it("filters by status, package and search, and counts every status", async () => {
    const tagged = `Searchable-${RUN}`;
    const a = await applied({ companyName: tagged, packageSlug: "premium-sme-booth" });
    await applied({ companyName: `Other-${RUN}`, packageSlug: "premium-sme-booth" });
    await act(w.admin, a.id, "approve", {});
    const list = (query: string) => callV1(w.facilitator, "GET", `/summit/commerce/exhibitor-bookings${query}`);

    const found = await list(`?q=${tagged}`);
    expect(found.body.items.map((i: Json) => i.companyName)).toEqual([tagged]);
    expect(found.body.items[0]).toMatchObject({ number: a.number, status: "approved", packageName: "Premium SME Booth", paymentStatus: "pending" });
    const approvedOnly = await list(`?status=approved&productId=${product("premium-sme-booth").id}`);
    expect(approvedOnly.body.items.every((i: Json) => i.status === "approved" && i.packageSlug === "premium-sme-booth")).toBe(true);
    expect(found.body.byStatus).toMatchObject({ submitted: expect.any(Number), approved: expect.any(Number), confirmed: expect.any(Number), rejected: expect.any(Number), cancelled: expect.any(Number) });
    // A search can't be turned into a pattern.
    expect((await list("?q=%25")).body.items).toEqual([]);
  });
});
