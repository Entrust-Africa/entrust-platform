import { eq } from "drizzle-orm";
import { schema } from "@entrust/db";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { callV1, cleanup, createOrganization, db, PREFIX, signUp, type TestUser } from "./support";

// The public registration form on the Summit landing page (POST /summit/registrations) and the staff's list of what came in.

// The confirmation emails go to the background worker; here the queue is a list.
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

const w = {} as { admin: TestUser; reviewer: TestUser; owner: TestUser; entrust: string };

const register = (body: unknown) => callV1(null, "POST", "/summit/registrations", body);
const list = (user: TestUser | null, query = "") => callV1(user, "GET", `/summit/registrations${query}`);
const stored = (email: string) => db.select().from(schema.registration).where(eq(schema.registration.email, email));

const RUN = Date.now();
let n = 0;
const emailFor = (label: string) => `${PREFIX}reg-${RUN}-${label}-${++n}@example.test`;
const form = (overrides: Record<string, unknown> = {}) => ({
  fullName: "Amina Bekele",
  email: emailFor("form"),
  organisation: "ZEBU Coffee",
  jobTitle: "Export manager",
  country: "ET",
  pass: "investor",
  consent: true,
  ...overrides,
});

beforeAll(async () => {
  await cleanup();
  const [admin, reviewer, owner] = await Promise.all(["reg-admin", "reg-reviewer", "reg-owner"].map(signUp));
  Object.assign(w, { admin, reviewer, owner });
  w.entrust = await createOrganization("reg-entrust", [[admin!, "admin"], [reviewer!, "reviewer"], [owner!, "owner"]], { smeProfile: false });
  process.env.ENTRUST_ORG_ID = w.entrust;
});

beforeEach(() => {
  queue.jobs.length = 0;
  queue.failNext = false;
});

afterAll(cleanup);

describe("registering to attend", () => {
  it("needs no sign-in, records the registration, and queues one confirmation email", async () => {
    const body = form({ email: `  ${PREFIX.toUpperCase()}Reg-${RUN}-mixed@Example.Test `, phone: "+251 911 000 000", notes: "Bringing two colleagues" });
    const res = await register(body);

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ pass: "investor", passName: "Investor Pass" });
    expect(res.body.number).toMatch(/^DTS-\d{5}$/);

    // The address is kept in lower case, so the same one in another case is the same registration.
    const email = `${PREFIX}reg-${RUN}-mixed@example.test`;
    const [row] = await stored(email);
    expect(row).toMatchObject({
      number: res.body.number,
      fullName: "Amina Bekele",
      phone: "+251 911 000 000",
      organisation: "ZEBU Coffee",
      jobTitle: "Export manager",
      country: "ET",
      pass: "investor",
      notes: "Bringing two colleagues",
    });
    expect(row?.consentedAt).toBeInstanceOf(Date);

    expect(queue.jobs).toHaveLength(1);
    expect(queue.jobs[0]).toMatchObject({
      name: "send-email",
      data: { to: email, template: "summit-registration", props: { fullName: "Amina Bekele", passName: "Investor Pass", number: res.body.number } },
    });
  });

  it("replaces the details when the same address registers again, keeps the reference, and sends no second email that day", async () => {
    const email = emailFor("again");
    const first = await register(form({ email, pass: "diaspora", jobTitle: "Founder" }));
    const second = await register(form({ email: email.toUpperCase(), pass: "delegation", jobTitle: "Director", fullName: "Amina B. Bekele" }));

    expect(second.status).toBe(201);
    expect(second.body).toMatchObject({ number: first.body.number, pass: "delegation", passName: "Delegation Pass" });
    const rows = await stored(email);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ pass: "delegation", jobTitle: "Director", fullName: "Amina B. Bekele" });
    expect(queue.jobs).toHaveLength(1);
  });

  it("registers anyway when the queue is down, and sends the confirmation on a later submission", async () => {
    const email = emailFor("queue");
    queue.failNext = true;
    const first = await register(form({ email }));
    expect(first.status).toBe(201);
    expect(await stored(email)).toHaveLength(1);
    expect(queue.jobs).toHaveLength(0);

    const second = await register(form({ email }));
    expect(second.status).toBe(201);
    expect(queue.jobs).toHaveLength(1);
  });

  it("stores nothing, and sends nothing, when the trap field is filled in", async () => {
    const email = emailFor("bot");
    const res = await register(form({ email, website: "https://spam.example" }));
    expect(res.status).toBe(201);
    expect(await stored(email)).toHaveLength(0);
    expect(queue.jobs).toHaveLength(0);
  });

  it.each([
    ["no consent", { consent: false }],
    ["a missing consent", { consent: undefined }],
    ["a bad email address", { email: "not-an-email" }],
    ["a one-letter name", { fullName: "A" }],
    ["no organisation", { organisation: "   " }],
    ["a pass that doesn't exist", { pass: "vip" }],
    ["a country that isn't a code", { country: "Ethiopia" }],
    ["notes that are too long", { notes: "x".repeat(1001) }],
  ])("refuses %s", async (_label, overrides) => {
    const body = form(overrides);
    const res = await register(body);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("invalid");
    expect(await stored(body.email as string)).toHaveLength(0);
    expect(queue.jobs).toHaveLength(0);
  });
});

describe("the list of registrations", () => {
  it("is for Entrust administrators and facilitators only", async () => {
    expect((await list(null)).status).toBe(401);
    expect((await list(w.owner)).status).toBe(403);
    expect((await list(w.reviewer)).status).toBe(403);
    expect((await list(w.admin)).status).toBe(200);
  });

  it("lists the newest first, with the totals for each pass", async () => {
    const [a, b] = [emailFor("list-a"), emailFor("list-b")];
    await register(form({ email: a, pass: "diaspora" }));
    await register(form({ email: b, pass: "delegation", phone: "" }));

    const res = await list(w.admin, "?limit=500");
    expect(res.status).toBe(200);
    const mine = res.body.items.filter((i: { email: string }) => i.email === a || i.email === b);
    expect(mine.map((i: { email: string }) => i.email)).toEqual([b, a]);
    expect(mine[0]).toMatchObject({ pass: "delegation", phone: null, country: "ET", organisation: "ZEBU Coffee" });
    expect(Object.keys(res.body.byPass).sort()).toEqual(["delegation", "diaspora", "investor"]);
    expect(res.body.byPass.diaspora).toBeGreaterThanOrEqual(1);

    const onlyDelegation = await list(w.admin, "?pass=delegation&limit=500");
    expect(onlyDelegation.body.items.every((i: { pass: string }) => i.pass === "delegation")).toBe(true);
    expect(onlyDelegation.body.total).toBe(res.body.byPass.delegation);

    const paged = await list(w.admin, "?limit=1&offset=0");
    expect(paged.body.items).toHaveLength(1);
    expect(paged.body.total).toBe(Object.values(res.body.byPass as Record<string, number>).reduce((x, y) => x + y, 0));
  });
});
