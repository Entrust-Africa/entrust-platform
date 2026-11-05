import { eq } from "drizzle-orm";
import { schema } from "@entrust/db";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { callV1, cleanup, createOrganization, db, PREFIX, signUp, type Json, type TestUser } from "./support";

// Delegate registration: the public form, free registration for selected SMEs, the badge, and check-in.

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

const w = {} as {
  admin: TestUser;
  facilitator: TestUser;
  reviewer: TestUser;
  entrust: string;
  edition: Json;
  previous?: string;
  periodId: string;
  smeOrg: string;
  smeEmail: string;
  smeApplication: string;
};

const RUN = Date.now();
let n = 0;
const emailFor = (label: string) => `${PREFIX}del-${RUN}-${label}-${++n}@example.test`;
const emailOf = async (user: TestUser) => (await db.select({ email: schema.user.email }).from(schema.user).where(eq(schema.user.id, user.id)))[0]!.email;
const to = (email: string) => queue.jobs.filter((j) => j.name === "send-email" && j.data.to === email).map((j) => j.data);

const form = (overrides: Record<string, unknown> = {}) => ({
  categorySlug: "general-business",
  fullName: "Amina Bekele",
  email: emailFor("form"),
  organisation: "ZEBU Coffee",
  jobTitle: "Export manager",
  country: "ET",
  consent: true,
  ...overrides,
});
const register = (body: unknown) => callV1(null, "POST", "/summit/commerce/delegates", body);
const registered = async (overrides: Record<string, unknown> = {}) => {
  const res = await register(form(overrides));
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  const [row] = await db.select().from(schema.delegateRegistration).where(eq(schema.delegateRegistration.number, res.body.number));
  return { number: res.body.number as string, id: row!.id, email: row!.email, token: row!.badgeToken };
};
const delegate = (id: string, user: TestUser = w.admin) => callV1(user, "GET", `/summit/commerce/delegates/${id}`);
const badge = (token: string) => callV1(null, "GET", `/summit/commerce/badges/${token}`);
const product = (slug: string): Json => w.edition.products.find((p: Json) => p.slug === slug);
const setProduct = (slug: string, patch: Record<string, unknown>) => callV1(w.admin, "PATCH", `/summit/commerce/products/${product(slug).id}`, patch);
const paymentOf = async (id: string) => (await delegate(id)).body.payment.id as string;
const verify = async (id: string, cents: number) => {
  const paymentId = await paymentOf(id);
  await callV1(w.admin, "PATCH", `/summit/commerce/payments/${paymentId}`, { reference: "TRF-1", amountReceivedCents: cents });
  const res = await callV1(w.admin, "PATCH", `/summit/commerce/payments/${paymentId}`, { status: "confirmed" });
  expect(res.status, JSON.stringify(res.body)).toBe(200);
};

beforeAll(async () => {
  await cleanup();
  const [admin, facilitator, reviewer, smeOwner] = await Promise.all(["dl-admin", "dl-facilitator", "dl-reviewer", "dl-sme-owner"].map(signUp));
  Object.assign(w, { admin, facilitator, reviewer });
  w.entrust = await createOrganization("dl-entrust", [[admin!, "admin"], [facilitator!, "facilitator"], [reviewer!, "reviewer"]], { smeProfile: false });
  w.smeOrg = await createOrganization("dl-sme", [[smeOwner!, "owner"]]);
  w.smeEmail = await emailOf(smeOwner!);
  process.env.ENTRUST_ORG_ID = w.entrust;
  [{ id: w.previous } = { id: undefined }] = await db.select({ id: schema.commerceEdition.id }).from(schema.commerceEdition).where(eq(schema.commerceEdition.isCurrent, true));

  // An assessment period with one selected SME and an approved final list.
  const [period] = await db
    .insert(schema.applicationPeriod)
    .values({ name: `${PREFIX}period-${RUN}`, opensAt: new Date("2026-12-01"), closesAt: new Date("2026-12-31"), countries: ["QZ"], templateVersion: "0.1.0", rulesVersion: "1.0.0" })
    .returning({ id: schema.applicationPeriod.id });
  w.periodId = period!.id;
  const [app] = await db
    .insert(schema.application)
    .values({ organizationId: w.smeOrg, periodId: w.periodId, status: "selected", templateVersion: "0.1.0", answers: {} })
    .returning({ number: schema.application.number });
  w.smeApplication = app!.number;
  await db.insert(schema.finalList).values({ periodId: w.periodId, selected: 1, waitlisted: 0, notSelected: 0 });

  const created = await callV1(admin!, "POST", "/summit/commerce/editions", { name: "Delegate test summit", slug: `${PREFIX}dl-${RUN}` });
  expect(created.status, JSON.stringify(created.body)).toBe(201);
  w.edition = created.body;
  const set = await callV1(admin!, "PATCH", `/summit/commerce/editions/${created.body.id}`, {
    isCurrent: true,
    applicationPeriodId: w.periodId,
    paymentMethods: [{ id: "bank-transfer", label: "Bank transfer", instructions: "Pay to the ADTIS account shown on the invoice." }],
  });
  expect(set.status, JSON.stringify(set.body)).toBe(200);
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

describe("registering as a paid delegate", () => {
  it("needs no sign-in, opens a pending payment, and emails the reference, the instructions and the badge link", async () => {
    const email = emailFor("paid");
    const res = await register(form({ email: `  ${email.toUpperCase()} `, phone: "+251 911 000 000", sector: "Technology and digital services", needs: "Vegetarian" }));
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    expect(res.body).toMatchObject({ categoryName: "General Business Delegate", price: "$65", paymentRequired: true, alreadyRegistered: false });
    expect(res.body.number).toMatch(/^DEL-\d{5,}$/);
    // The badge's secret is for the delegate's inbox, not the response.
    expect(JSON.stringify(res.body)).not.toMatch(/badge|token/i);

    const [row] = await db.select().from(schema.delegateRegistration).where(eq(schema.delegateRegistration.number, res.body.number));
    expect(row).toMatchObject({ status: "registered", email, amountCents: 6500, country: "ET", needs: "Vegetarian", checkedInAt: null });
    expect(row!.badgeToken).toMatch(/^[A-Za-z0-9_-]{24}$/);
    const detail = await delegate(row!.id);
    expect(detail.body).toMatchObject({ paymentStatus: "pending", selectedSme: false });
    expect(detail.body.payment).toMatchObject({ status: "pending", amountDueCents: 6500, amountReceivedCents: null });
    expect(detail.body.badge).toMatchObject({ state: "not_valid", problems: ["The payment has not been verified."] });

    const mail = to(email);
    expect(mail).toHaveLength(1);
    const text = JSON.stringify(mail[0].props);
    expect(text).toContain("Pay to the ADTIS account shown on the invoice.");
    expect(text).toContain("Your badge becomes valid once your payment has been verified");
    expect(mail[0].props.action.url).toBe(`http://localhost:3002/badge/${row!.badgeToken}`);
    expect(mail[0].props.details).toContainEqual({ label: "Reference", value: res.body.number });
  });

  it("takes each category at its price", async () => {
    for (const [slug, price] of [["premium", 16000], ["diaspora-business", 15000], ["investor-buyer", 25000]] as const) {
      const { id } = await registered({ categorySlug: slug });
      expect((await delegate(id)).body.payment.amountDueCents).toBe(price);
    }
  });

  it("is refused without an organisation, a country or a job title, and for a category that doesn't exist or is a draft", async () => {
    expect((await register(form({ organisation: undefined }))).status).toBe(422);
    expect((await register(form({ country: undefined }))).status).toBe(422);
    expect((await register(form({ jobTitle: "" }))).status).toBe(400);
    expect((await register(form({ consent: false }))).status).toBe(400);
    expect((await register(form({ categorySlug: "vip" }))).status).toBe(404);
    expect((await register(form({ categorySlug: "premium-sme-booth" }))).status).toBe(404);
    await setProduct("premium", { status: "draft" });
    expect((await register(form({ categorySlug: "premium" }))).status).toBe(404);
    await setProduct("premium", { status: "published" });
  });

  it("is answered like a success but stored nowhere when the trap field is filled in", async () => {
    const email = emailFor("bot");
    expect((await register(form({ email, nickname: "robot" }))).status).toBe(201);
    expect(await db.select().from(schema.delegateRegistration).where(eq(schema.delegateRegistration.email, email))).toHaveLength(0);
  });

  it("registers a person once: the same address changes the details, the category while nothing is paid, and the amount with it", async () => {
    const email = emailFor("again");
    const first = await registered({ email, fullName: "First Name" });
    const second = await register(form({ email, fullName: "Corrected Name", categorySlug: "premium" }));
    expect(second.body).toMatchObject({ number: first.number, categoryName: "Premium Delegate", price: "$160" });
    const after = await delegate(first.id);
    expect(after.body).toMatchObject({ fullName: "Corrected Name", categoryName: "Premium Delegate", amountCents: 16000 });
    expect(after.body.payment.amountDueCents).toBe(16000);
    expect(to(email)).toHaveLength(1);
    expect(after.body.badge.url).toContain(first.token);
  });

  it("keeps the category and amount once a payment reference is recorded, and ignores a repeat after it is verified", async () => {
    const email = emailFor("settled");
    const first = await registered({ email });
    await callV1(w.admin, "PATCH", `/summit/commerce/payments/${await paymentOf(first.id)}`, { reference: "TRF-9", amountReceivedCents: 6500 });
    const switched = await register(form({ email, categorySlug: "investor-buyer", fullName: "Same Person" }));
    expect(switched.body).toMatchObject({ number: first.number, categoryName: "General Business Delegate" });
    expect((await delegate(first.id)).body).toMatchObject({ amountCents: 6500, fullName: "Same Person" });

    await verify(first.id, 6500);
    queue.jobs.length = 0;
    const again = await register(form({ email, fullName: "Someone Else" }));
    expect(again.body).toMatchObject({ number: first.number, alreadyRegistered: true });
    expect((await delegate(first.id)).body.fullName).toBe("Same Person");
  });

  it("is refused for a sold-out category, and two people taking the last place can't both get it", async () => {
    await setProduct("diaspora-business", { capacity: 1 });
    const free = await db.select({ id: schema.delegateRegistration.id }).from(schema.delegateRegistration).where(eq(schema.delegateRegistration.productId, product("diaspora-business").id));
    for (const f of free) await callV1(w.admin, "POST", `/summit/commerce/delegates/${f.id}/cancel`, { reason: "Test reset" });
    const results = await Promise.all([register(form({ categorySlug: "diaspora-business" })), register(form({ categorySlug: "diaspora-business" }))]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 422]);
    expect(results.find((r) => r.status === 422)!.body.error).toMatch(/sold out/);
    const { body } = await callV1(null, "GET", "/summit/commerce/catalogue");
    expect(body.delegates.find((p: Json) => p.slug === "diaspora-business").availability).toEqual({ remaining: 0, soldOut: true });
    await setProduct("diaspora-business", { capacity: null });
  });

  it("still saves the registration when the email queue is down, and sends the confirmation on the next try", async () => {
    queue.failNext = true;
    const email = emailFor("queue");
    expect((await register(form({ email }))).status).toBe(201);
    const [row] = await db.select().from(schema.delegateRegistration).where(eq(schema.delegateRegistration.email, email));
    expect(row?.confirmationSentAt).toBeNull();
    expect((await register(form({ email }))).status).toBe(201);
    expect(to(email)).toHaveLength(1);
  });
});

describe("the badge", () => {
  it("shows the delegate's name and category but no contact detail, and is valid only after the payment is verified", async () => {
    const { id, token, number } = await registered({ phone: "+251 900 111 222" });
    let res = await badge(token);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ number, fullName: "Amina Bekele", organisation: "ZEBU Coffee", country: "ET", category: "General Business Delegate", valid: false, reason: "The payment has not been verified." });
    expect(res.body.url).toBe(`http://localhost:3002/badge/${token}`);
    expect(res.body.edition.datesNote).toMatch(/January 2027/);
    expect(JSON.stringify(res.body)).not.toMatch(/example\.test|251 900|amountCents/i);
    expect(Object.keys(res.body).sort()).toEqual(["category", "country", "edition", "fullName", "number", "organisation", "reason", "url", "valid"]);

    queue.jobs.length = 0;
    await verify(id, 6500);
    res = await badge(token);
    expect(res.body).toMatchObject({ valid: true, reason: null });
    const mail = to((await delegate(id)).body.email);
    expect(mail.map((m) => m.subject)).toContain(`Your ADTIS badge is ready (${number})`);
    expect(mail.find((m) => /badge is ready/.test(m.subject)).props.action.url).toContain(token);
  });

  it("answers 404 for a token that doesn't exist and 400 for one that isn't shaped like a token", async () => {
    expect((await badge("A".repeat(24))).status).toBe(404);
    expect((await badge("short")).status).toBe(400);
  });

  it("stops being valid when the registration is cancelled", async () => {
    const { id, token } = await registered();
    await verify(id, 6500);
    expect((await badge(token)).body.valid).toBe(true);
    await callV1(w.admin, "POST", `/summit/commerce/delegates/${id}/cancel`, { reason: "Asked to cancel" });
    expect((await badge(token)).body).toMatchObject({ valid: false, reason: "This registration was cancelled." });
  });
});

describe("a selected SME", () => {
  const sme = (overrides: Record<string, unknown> = {}) =>
    form({ categorySlug: "selected-sme", email: w.smeEmail, organisation: undefined, country: undefined, applicationNumber: w.smeApplication, fullName: "Founder Name", jobTitle: "Founder", ...overrides });

  it("registers free from its application number, without a second application, and holds a valid badge at once", async () => {
    const res = await register(sme());
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    expect(res.body).toMatchObject({ categoryName: "Selected SME Delegate", price: "Complimentary", paymentRequired: false });
    const [row] = await db.select().from(schema.delegateRegistration).where(eq(schema.delegateRegistration.number, res.body.number));
    const detail = await delegate(row!.id);
    // The business and its country came from the assessment, not from the form.
    expect(detail.body).toMatchObject({ organisation: "dl-sme", country: "QZ", selectedSme: true, amountCents: 0, paymentStatus: "confirmed" });
    expect(detail.body.application.number).toBe(w.smeApplication);
    expect(detail.body.payment).toMatchObject({ status: "confirmed", method: "complimentary", amountDueCents: 0, amountReceivedCents: 0 });
    expect(detail.body.badge.state).toBe("valid");
    const mail = to(w.smeEmail);
    expect(JSON.stringify(mail[0].props)).toContain("complimentary registration is confirmed");
    expect(mail[0].props.details).toContainEqual({ label: "Amount due", value: "Complimentary" });
  });

  it("gives every failure the same answer, so the form can't be used to find out who was selected", async () => {
    const other = await createOrganization("dl-sme-other", [], {});
    const [notSelected] = await db
      .insert(schema.application)
      .values({ organizationId: other, periodId: w.periodId, status: "waitlisted", templateVersion: "0.1.0", answers: {} })
      .returning({ number: schema.application.number });
    const failures = [
      sme({ applicationNumber: "SUM-999999" }),
      sme({ email: emailFor("stranger") }),
      sme({ applicationNumber: notSelected!.number }),
    ];
    const answers = [];
    for (const body of failures) {
      const res = await register(body);
      expect(res.status).toBe(422);
      answers.push(res.body.error);
    }
    expect(new Set(answers).size).toBe(1);
    expect(answers[0]).toMatch(/couldn't match/);
  });

  it("is refused until the final list is approved, and needs the application number", async () => {
    await db.delete(schema.finalList).where(eq(schema.finalList.periodId, w.periodId));
    expect((await register(sme({ email: w.smeEmail }))).status).toBe(422);
    await db.insert(schema.finalList).values({ periodId: w.periodId, selected: 1, waitlisted: 0, notSelected: 0 });
    const missing = await register(sme({ applicationNumber: undefined }));
    expect(missing.status).toBe(422);
    expect(missing.body.error).toMatch(/application number/);
    expect((await register(sme({ applicationNumber: "not a number" }))).status).toBe(400);
  });

  it("has one complimentary registration, unless the edition gives more, and colleagues pay as general delegates", async () => {
    // The registration above used the allowance for the owner's address; a second member of the business is a second place.
    const colleague = await signUp("dl-sme-colleague");
    await db.insert(schema.member).values({ id: `${PREFIX}${RUN}-m`, organizationId: w.smeOrg, userId: colleague.id, role: "member", createdAt: new Date() });
    const colleagueEmail = await emailOf(colleague);
    const refused = await register(sme({ email: colleagueEmail, fullName: "Colleague" }));
    expect(refused.status).toBe(422);
    expect(refused.body.error).toMatch(/already used its complimentary registration/);
    await callV1(w.admin, "PATCH", `/summit/commerce/editions/${w.edition.id}`, { complimentaryPerSme: 2 });
    expect((await register(sme({ email: colleagueEmail, fullName: "Colleague" }))).status).toBe(201);
    await callV1(w.admin, "PATCH", `/summit/commerce/editions/${w.edition.id}`, { complimentaryPerSme: 1 });
    // The owner registering again takes no second place.
    const again = await register(sme({ fullName: "Founder Renamed" }));
    expect(again.status).toBe(201);
    expect(again.body.alreadyRegistered).toBe(true);
  });

  it("can't be used by the paid categories, which ask for the full details", async () => {
    const res = await register(form({ applicationNumber: w.smeApplication, organisation: undefined }));
    expect(res.status).toBe(422);
  });
});

describe("checking in", () => {
  const lookup = (user: TestUser | null, code: string) => callV1(user, "GET", `/summit/commerce/check-in/lookup?code=${encodeURIComponent(code)}`);
  const checkIn = (user: TestUser | null, id: string) => callV1(user, "POST", `/summit/commerce/delegates/${id}/check-in`);

  it("finds a delegate from the scanned address, the bare token or the reference", async () => {
    const { id, token, number } = await registered();
    for (const code of [`https://adtis.entrust-africa.com/badge/${token}`, token, number.toLowerCase()]) {
      const res = await lookup(w.facilitator, code);
      expect(res.status, code).toBe(200);
      expect(res.body.id).toBe(id);
    }
    expect((await lookup(w.admin, "hello world")).status).toBe(422);
    expect((await lookup(w.admin, "A".repeat(24))).status).toBe(404);
    expect((await lookup(w.reviewer, token)).status).toBe(403);
    expect((await lookup(null, token)).status).toBe(401);
  });

  it("refuses a badge whose payment is unverified, with the reason, and checks in once it is verified", async () => {
    const { id } = await registered();
    const refused = await checkIn(w.admin, id);
    expect(refused.status).toBe(422);
    expect(refused.body.error).toBe("The payment has not been verified.");
    await verify(id, 6500);
    const ok = await checkIn(w.facilitator, id);
    expect(ok.status, JSON.stringify(ok.body)).toBe(200);
    expect(ok.body.checkedInAt).toBeTruthy();
    expect(ok.body.checkedInBy.name).toBe("dl-facilitator");
    expect(ok.body.badge.state).toBe("already_checked_in");
    const again = await checkIn(w.admin, id);
    expect(again.status).toBe(409);
    expect(again.body.error).toMatch(/checked in at/);
    const audit = await db.select().from(schema.auditLog).where(eq(schema.auditLog.entityId, id));
    expect(audit.map((a) => a.action)).toContain("summit.commerce.delegate.checked_in");
  });

  it("checks a complimentary selected SME in at once", async () => {
    const [row] = await db.select().from(schema.delegateRegistration).where(eq(schema.delegateRegistration.applicationId, (await db.select({ id: schema.application.id }).from(schema.application).where(eq(schema.application.number, w.smeApplication)))[0]!.id));
    expect((await checkIn(w.admin, row!.id)).status).toBe(200);
  });

  it("refuses a cancelled registration, and is staff-only", async () => {
    const { id } = await registered();
    await verify(id, 6500);
    expect((await checkIn(w.reviewer, id)).status).toBe(403);
    expect((await checkIn(null, id)).status).toBe(401);
    await callV1(w.admin, "POST", `/summit/commerce/delegates/${id}/cancel`, { reason: "Asked to cancel" });
    const res = await checkIn(w.admin, id);
    expect(res.status).toBe(422);
    expect(res.body.error).toBe("This registration was cancelled.");
  });
});

describe("administering delegates", () => {
  it("cancels a registration, cancels an unpaid payment, and refuses to cancel after check-in", async () => {
    const { id } = await registered();
    const res = await callV1(w.admin, "POST", `/summit/commerce/delegates/${id}/cancel`, { reason: "Duplicate" });
    expect(res.body).toMatchObject({ status: "cancelled", paymentStatus: "cancelled" });
    expect((await callV1(w.admin, "POST", `/summit/commerce/delegates/${id}/cancel`, { reason: "Again" })).status).toBe(409);

    const arrived = await registered();
    await verify(arrived.id, 6500);
    await callV1(w.admin, "POST", `/summit/commerce/delegates/${arrived.id}/check-in`);
    expect((await callV1(w.admin, "POST", `/summit/commerce/delegates/${arrived.id}/cancel`, { reason: "Too late" })).status).toBe(409);
  });

  it("leaves a verified payment for a person to refund when a registration is cancelled", async () => {
    const { id } = await registered();
    await verify(id, 6500);
    const res = await callV1(w.admin, "POST", `/summit/commerce/delegates/${id}/cancel`, { reason: "Cannot attend" });
    expect(res.body.paymentStatus).toBe("confirmed");
  });

  it("corrects a delegate's name before the badge is printed, and records the change", async () => {
    const { id } = await registered({ fullName: "Aminna Bekelle" });
    const res = await callV1(w.facilitator, "PATCH", `/summit/commerce/delegates/${id}`, { fullName: "Amina Bekele", organisation: "ZEBU Coffee Exporters" });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body).toMatchObject({ fullName: "Amina Bekele", organisation: "ZEBU Coffee Exporters" });
    const audit = (await db.select().from(schema.auditLog).where(eq(schema.auditLog.entityId, id))).find((a) => a.action === "summit.commerce.delegate.updated");
    expect(audit?.before).toMatchObject({ fullName: "Aminna Bekelle" });
    expect((await callV1(w.reviewer, "PATCH", `/summit/commerce/delegates/${id}`, { fullName: "Nobody" })).status).toBe(403);
  });

  it("sends the confirmation again for a delegate who lost it", async () => {
    const { id, email } = await registered();
    queue.jobs.length = 0;
    expect((await callV1(w.admin, "POST", `/summit/commerce/delegates/${id}/resend`)).status).toBe(200);
    expect(to(email)).toHaveLength(1);
    await callV1(w.admin, "POST", `/summit/commerce/delegates/${id}/cancel`, { reason: "Gone" });
    expect((await callV1(w.admin, "POST", `/summit/commerce/delegates/${id}/resend`)).status).toBe(409);
  });

  it("lists and filters delegates, with totals for the whole edition", async () => {
    const tagged = `Searchable-${RUN}`;
    const a = await registered({ organisation: tagged, country: "KE" });
    await verify(a.id, 6500);
    await registered({ organisation: `Other-${RUN}`, country: "GH" });
    const list = (query: string) => callV1(w.facilitator, "GET", `/summit/commerce/delegates${query}`);

    const found = await list(`?q=${tagged}`);
    expect(found.body.items.map((i: Json) => i.organisation)).toEqual([tagged]);
    expect(found.body.items[0]).toMatchObject({ number: a.number, paymentStatus: "confirmed", country: "KE", categoryName: "General Business Delegate", selectedSme: false });
    expect((await list("?country=GH&paymentStatus=pending")).body.items.every((i: Json) => i.country === "GH" && i.paymentStatus === "pending")).toBe(true);
    expect((await list("?checkedIn=true")).body.items.every((i: Json) => i.checkedInAt !== null)).toBe(true);
    const { totals } = found.body;
    expect(totals.registered).toBeGreaterThan(0);
    expect(totals.paymentConfirmed).toBeGreaterThan(0);
    expect(totals.paymentPending).toBeGreaterThan(0);
    expect(totals.cancelled).toBeGreaterThan(0);
    expect((await list("?q=%25")).body.items).toEqual([]);
    expect((await callV1(w.reviewer, "GET", "/summit/commerce/delegates")).status).toBe(403);
  });
});
