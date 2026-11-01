import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { schema } from "@entrust/db";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { callV1, cleanup, COUNTRY, createOrganization, db, makeFile, PREFIX, signUp, type Json, type TestUser } from "./support";
import { completeAnswers } from "./summit-form";

// Quality review and the selection committee (#80): an administrator approves or returns a completed assessment, the
// committee compares and filters the applicants, records a decision with its reason, and approves the final list. The officer's workspace is in
// summit-assessment.test.ts and the application itself in summit.test.ts.
vi.mock("../src/services/summit-forms", async (importOriginal) => (await import("./summit-form")).withPublishedForm(await importOriginal()));

// The emails go to the background worker; here the queue is a list.
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
  owners: TestUser[]; outsider: TestUser;
  admin: TestUser; facilitator: TestUser; reviewer: TestUser; reviewer2: TestUser; committee: TestUser; committee2: TestUser;
  orgs: string[]; entrust: string; periodId: string; otherPeriodId: string;
  /** Four applications that go to the committee, and one that stays with its officer. */
  a: string; b: string; c: string; d: string; e: string;
};

const S = "/summit";
const call = (user: TestUser | null, method: string, path: string, body?: unknown) => callV1(user, method, `${S}${path}`, body);

const criteriaOf = (view: Json): Json[] => view.categories.flatMap((c: Json) => c.criteria);
const workspace = async (user: TestUser, id: string) => {
  const res = await call(user, "GET", `/applications/${id}/assessment`);
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  return res.body;
};
const statusOf = async (id: string) => (await call(w.admin, "GET", `/applications/${id}`)).body.status as string;

/** Points that add up to `earned` over the criteria the workspace shows, filling each to its maximum in turn. */
function scoresFor(view: Json, earned: number): Record<string, number> {
  const scores: Record<string, number> = {};
  let left = earned;
  for (const c of criteriaOf(view)) {
    scores[c.id] = Math.min(c.maxPoints, left);
    left -= scores[c.id]!;
  }
  expect(left).toBe(0);
  return scores;
}

/** An application submitted, eligible and assigned to the reviewer. */
async function eligibleApplication(owner: TestUser, organizationId: string, overrides: Record<string, string>, form: Json) {
  const created = await call(owner, "POST", "/applications", { organizationId });
  expect(created.status, JSON.stringify(created.body)).toBe(201);
  const id = created.body.id as string;
  const saved = await call(owner, "PATCH", `/applications/${id}/answers`, { answers: completeAnswers(form, { ...created.body.answers, ...overrides }) });
  expect(saved.status, JSON.stringify(saved.body)).toBe(200);
  for (const [name, kind] of [["certificate.pdf", "registration_certificate"], ["catalogue.pdf", "product_information"], ["accounts.pdf", "financial_statements"]] as const) {
    expect((await call(owner, "POST", `/applications/${id}/documents`, { fileId: await makeFile(organizationId, owner.id, name), kind })).status).toBe(201);
  }
  expect((await call(owner, "POST", `/applications/${id}/submit`)).status).toBe(200);
  expect((await call(w.facilitator, "PUT", `/applications/${id}/officer`, { officerUserId: w.reviewer.id })).status).toBe(200);
  return id;
}

/** Scores it for `earned` points, completes the assessment and recommends, as the assigned officer. */
async function recommended(id: string, earned: number, recommendation = "recommend_selection") {
  const view = await workspace(w.reviewer, id);
  expect((await call(w.reviewer, "POST", `/applications/${id}/assessment/scores`, { scores: scoresFor(view, earned) })).status).toBe(201);
  for (const c of view.categories.filter((c: Json) => c.applicable)) {
    const note = await call(w.reviewer, "PUT", `/applications/${id}/assessment/notes/${c.id}`, {
      justification: `Category ${c.id} is scored from the application.`,
      evidence: ["Registration certificate", "Answer S2.2"],
    });
    expect(note.status, JSON.stringify(note.body)).toBe(200);
  }
  const done = await call(w.reviewer, "POST", `/applications/${id}/assessment/complete`);
  expect(done.status, JSON.stringify(done.body)).toBe(200);
  const res = await call(w.reviewer, "POST", `/applications/${id}/recommendation`, { recommendation, suitableOpportunity: "trade", rationale: `Marked ${earned}.` });
  expect(res.status, JSON.stringify(res.body)).toBe(201);
}

const approve = (id: string, user = w.admin) => call(user, "POST", `/applications/${id}/review`, { decision: "approve" });
const list = async (query = "", user: TestUser = w.committee) => {
  const res = await call(user, "GET", `/committee/applications?periodId=${w.periodId}${query}`);
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  return res.body;
};
const numbers = (view: Json): string[] => view.items.map((i: Json) => i.number);
const itemOf = (view: Json, id: string): Json => view.items.find((i: Json) => i.id === id);

beforeAll(async () => {
  await cleanup();
  const names = ["owner-a", "owner-b", "owner-c", "owner-d", "owner-e", "outsider", "admin", "facilitator", "reviewer", "reviewer2", "committee", "committee2"];
  const users = await Promise.all(names.map(signUp));
  const [ownerA, ownerB, ownerC, ownerD, ownerE, outsider, admin, facilitator, reviewer, reviewer2, committee, committee2] = users as TestUser[];
  Object.assign(w, { owners: [ownerA, ownerB, ownerC, ownerD, ownerE], outsider, admin, facilitator, reviewer, reviewer2, committee, committee2 });
  w.orgs = await Promise.all(["a", "b", "c", "d", "e"].map((n, i) => createOrganization(`org-${n}`, [[w.owners[i]!, "owner"]])));
  w.entrust = await createOrganization(
    "entrust",
    [[admin!, "admin"], [facilitator!, "facilitator"], [reviewer!, "reviewer"], [reviewer2!, "reviewer"], [committee!, "committee"], [committee2!, "committee"]],
    { smeProfile: false },
  );
  process.env.ENTRUST_ORG_ID = w.entrust;
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime("2030-01-15T10:00:00Z");

  const period = await call(w.admin, "POST", "/periods", {
    name: `${PREFIX}summit-committee`,
    opensAt: "2030-01-01T00:00:00Z",
    closesAt: "2030-02-01T00:00:00Z",
    countries: [COUNTRY],
  });
  expect(period.status, JSON.stringify(period.body)).toBe(201);
  w.periodId = period.body.id;
  // A second period, with nothing in it, for a final list that has nothing to approve.
  const other = await call(w.admin, "POST", "/periods", {
    name: `${PREFIX}summit-committee-later`,
    opensAt: "2031-01-01T00:00:00Z",
    closesAt: "2031-02-01T00:00:00Z",
    countries: [COUNTRY],
  });
  expect(other.status, JSON.stringify(other.body)).toBe(201);
  w.otherPeriodId = other.body.id;
  const form = (await call(w.owners[0]!, "GET", "/forms/0.1.0")).body;

  // A and C seek investment, so all seven categories are scored. B is trade only, so category D is left out.
  // D chooses another opportunity. Their sectors and owners differ for the filters.
  const answers = (sector: string, woman: "yes" | "no", youth: "yes" | "no", extra: Record<string, string> = {}) =>
    ({ "S2.1": sector, "S1.8": woman, "S1.9": youth, ...extra });
  w.a = await eligibleApplication(ownerA!, w.orgs[0]!, answers("Coffee", "yes", "no", { "S4.1": "yes" }), form);
  w.b = await eligibleApplication(ownerB!, w.orgs[1]!, answers("Textiles and apparel", "no", "yes", { "S4.1": "no" }), form);
  w.c = await eligibleApplication(ownerC!, w.orgs[2]!, answers("Coffee processing", "no", "no", { "S4.1": "yes" }), form);
  w.d = await eligibleApplication(ownerD!, w.orgs[3]!, answers("Leather goods", "yes", "yes", { "S2.12": "strategic_partnership", "S4.1": "no" }), form);
  w.e = await eligibleApplication(ownerE!, w.orgs[4]!, answers("Honey", "no", "no", { "S4.1": "no" }), form);
  // B is in another country.
  await db.update(schema.smeProfile).set({ country: "QY" }).where(eq(schema.smeProfile.organizationId, w.orgs[1]!));

  await recommended(w.a, 90);
  await recommended(w.b, 64);
  await recommended(w.c, 90, "recommend_subject_to_verification");
  await recommended(w.d, 55, "do_not_recommend");
});

afterAll(async () => {
  vi.useRealTimers();
  delete process.env.ENTRUST_ORG_ID;
  await cleanup();
});

describe("signed out", () => {
  it("is refused everywhere", async () => {
    const id = randomUUID();
    for (const [method, path, body] of [
      ["POST", `/applications/${id}/review`, {}],
      ["POST", `/applications/${id}/decision`, {}],
      ["GET", "/committee/applications"],
      ["GET", "/dashboard"],
      ["PUT", `/periods/${id}/selection-target`, {}],
      ["GET", `/periods/${id}/final-list`],
      ["POST", `/periods/${id}/final-list`, {}],
      ["POST", `/periods/${id}/final-list/notifications`],
      ["GET", `/committee/compare?ids=${id},${randomUUID()}`],
    ] as const) {
      const res = await call(null, method, path, body);
      expect([method, path, res.status, res.body.code]).toEqual([method, path, 401, "unauthenticated"]);
    }
  });
});

describe("the committee role", () => {
  it("is Summit only: it makes no one staff, so CLEAR and TRADE give a member nothing", async () => {
    const me = await callV1(w.committee, "GET", "/me");
    expect(me.body).toMatchObject({ staffRole: null, summitCommittee: true });
    expect((await callV1(w.admin, "GET", "/me")).body).toMatchObject({ staffRole: "admin", summitCommittee: false });
    const cases = await callV1(w.committee, "GET", "/clear/cases");
    expect([cases.status, cases.body.total]).toEqual([200, 0]);
    expect((await callV1(w.committee, "GET", "/audit")).status).toBeGreaterThanOrEqual(400);
  });

  it("is given by an Entrust administrator", async () => {
    const res = await callV1(w.admin, "PATCH", `/organizations/${w.entrust}/members/${w.committee2.id}`, { role: "committee" });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect((await callV1(w.committee2, "GET", "/me")).body.summitCommittee).toBe(true);
    // Not in an SME organisation, where it means nothing.
    const sme = await callV1(w.owners[0]!, "PATCH", `/organizations/${w.orgs[0]}/members/${w.owners[0]!.id}`, { role: "committee" });
    expect(sme.status).toBeGreaterThanOrEqual(400);
  });
});

describe("before the committee", () => {
  it("can't open an application the officer has recommended but no administrator has approved", async () => {
    expect(await statusOf(w.a)).toBe("recommended");
    expect((await call(w.committee, "GET", `/applications/${w.a}`)).status).toBe(404);
    expect((await call(w.committee, "GET", `/applications/${w.a}/assessment`)).status).toBe(404);
    expect((await call(w.committee, "POST", `/applications/${w.a}/decision`, { decision: "selected", reason: "Too early." })).status).toBe(404);
    expect((await list()).items).toEqual([]);
  });

  it("can't open an application that is still in assessment either", async () => {
    expect(await statusOf(w.e)).toBe("under_assessment");
    expect((await call(w.committee, "GET", `/applications/${w.e}`)).status).toBe(404);
  });
});

describe("reviewing an assessment", () => {
  const returned = (id: string, reason?: string, user = w.admin) =>
    call(user, "POST", `/applications/${id}/review`, { decision: "return", ...(reason === undefined ? {} : { reason }) });

  it("is for administrators and facilitators", async () => {
    for (const user of [w.reviewer, w.owners[0]!]) expect((await approve(w.a, user)).status).toBe(403);
    for (const user of [w.reviewer2, w.outsider, w.committee]) expect((await approve(w.a, user)).status).toBe(404);
    expect(await statusOf(w.a)).toBe("recommended");
  });

  it("waits until the officer has recommended", async () => {
    expect((await approve(w.e)).status).toBe(409);
    expect((await approve(randomUUID())).status).toBe(404);
  });

  it("needs a reason to send an assessment back, and an unknown decision is refused", async () => {
    expect((await returned(w.d)).status).toBe(422);
    expect((await returned(w.d, "   ")).status).toBe(422);
    expect((await call(w.admin, "POST", `/applications/${w.d}/review`, { decision: "maybe" })).status).toBe(400);
    expect(await statusOf(w.d)).toBe("recommended");
  });

  it("returns the assessment to its officer, who corrects it, completes it and recommends again", async () => {
    const res = await returned(w.d, "Category E leans on a document that isn't the applicant's.", w.facilitator);
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body).toMatchObject({ status: "under_assessment", state: "in_progress", completedAt: null });
    expect(res.body.reviews).toEqual([
      expect.objectContaining({ decision: "returned", reason: "Category E leans on a document that isn't the applicant's.", by: { id: w.facilitator.id, name: "facilitator" } }),
    ]);

    // Still the same officer's, who can adjust the score now it is open again.
    const adjusted = await call(w.reviewer, "POST", `/applications/${w.d}/assessment/adjustments`, { criterion: "E1", points: 2, reason: "Evidence not the applicant's." });
    expect(adjusted.status, JSON.stringify(adjusted.body)).toBe(201);
    expect((await call(w.reviewer, "POST", `/applications/${w.d}/assessment/complete`)).status).toBe(200);
    const again = await call(w.reviewer, "POST", `/applications/${w.d}/recommendation`, { recommendation: "do_not_recommend", rationale: "Marked down after review." });
    expect(again.status, JSON.stringify(again.body)).toBe(201);
    expect(again.body.recommendation.rationale).toBe("Marked down after review.");
    expect(again.body.reviews).toHaveLength(1);
  });

  it("keeps every round of review", async () => {
    const res = await approve(w.d);
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.status).toBe("committee_review");
    expect(res.body.reviews.map((r: Json) => [r.decision, r.by.name])).toEqual([["returned", "facilitator"], ["approved", "admin"]]);
    const rows = await db.select().from(schema.assessmentReview).where(eq(schema.assessmentReview.applicationId, w.d));
    expect(rows).toHaveLength(2);
    expect((await approve(w.d)).status).toBe(409);
  });

  it("sends the others to the committee, and audits each review", async () => {
    for (const id of [w.a, w.b, w.c]) expect((await approve(id, w.facilitator)).status).toBe(200);
    for (const id of [w.a, w.b, w.c, w.d]) expect(await statusOf(id)).toBe("committee_review");
    const audit = await db.select().from(schema.auditLog).where(and(eq(schema.auditLog.entityId, w.a), eq(schema.auditLog.action, "summit.assessment.reviewed")));
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ platform: "summit", actorUserId: w.facilitator.id, after: { decision: "approved" } });
  });

  it("shows the applicant nothing of it", async () => {
    const text = JSON.stringify((await call(w.owners[3]!, "GET", `/applications/${w.d}`)).body);
    expect(text).not.toContain("isn't the applicant's");
    expect(text).not.toContain("returned");
    expect((await call(w.owners[3]!, "GET", `/applications/${w.d}`)).body.status).toBe("in_review");
  });
});

describe("what the committee can open", () => {
  it("is the application and the officer's workspace, to read", async () => {
    const detail = await call(w.committee, "GET", `/applications/${w.a}`);
    expect(detail.status, JSON.stringify(detail.body)).toBe(200);
    expect(detail.body.view).toBe("staff");
    expect(detail.body.status).toBe("committee_review");
    const view = await workspace(w.committee, w.a);
    expect(view).toMatchObject({ status: "committee_review", state: "completed", score: { complete: true, points: 90 } });
    expect(view.recommendation).toMatchObject({ recommendation: "recommend_selection", by: { name: "reviewer" } });
  });

  it("changes nothing of the assessment", async () => {
    const id = w.a;
    const attempts = [
      ["POST", `/applications/${id}/assessment/scores`, { scores: { A1: 1 } }],
      ["POST", `/applications/${id}/assessment/adjustments`, { criterion: "A1", points: 0, reason: "No." }],
      ["PUT", `/applications/${id}/assessment/notes/A`, { justification: "No.", evidence: [] }],
      ["PUT", `/applications/${id}/verification/annual_revenue`, { class: "self_reported" }],
      ["POST", `/applications/${id}/assessment/complete`],
      ["POST", `/applications/${id}/recommendation`, { recommendation: "do_not_recommend", rationale: "No." }],
      ["POST", `/applications/${id}/stage`, { to: "under_verification" }],
      ["POST", `/applications/${id}/clarifications`, { message: "Please explain." }],
      ["POST", `/applications/${id}/review`, { decision: "return", reason: "No." }],
      ["PUT", `/applications/${id}/officer`, { officerUserId: w.reviewer2.id }],
      ["POST", `/applications/${id}/eligibility-exceptions`, { criterion: "registered", reason: "No." }],
    ] as const;
    for (const [method, path, body] of attempts) {
      const res = await call(w.committee, method, path, body);
      expect([method, path, res.status]).toEqual([method, path, 403]);
    }
    expect((await call(w.committee, "GET", "/officers")).status).toBe(403);
    // An administrator can't adjust a score once the committee has started.
    const late = await call(w.admin, "POST", `/applications/${id}/assessment/adjustments`, { criterion: "A1", points: 0, reason: "Too late." });
    expect(late.status).toBe(409);
    expect(await statusOf(id)).toBe("committee_review");
  });

  it("opens a document, except a financial statement", async () => {
    const documents = (await call(w.admin, "GET", `/applications/${w.a}`)).body.documents;
    const of = (kind: string) => documents.find((d: Json) => d.kind === kind).id as string;
    const link = (user: TestUser, kind: string) => call(user, "GET", `/applications/${w.a}/documents/${of(kind)}/download-url`);
    expect((await link(w.committee, "registration_certificate")).status).toBe(200);
    expect((await link(w.committee, "financial_statements")).status).toBe(403);
    expect((await link(w.facilitator, "financial_statements")).status).toBe(403);
    for (const user of [w.admin, w.reviewer, w.owners[0]!]) expect((await link(user, "financial_statements")).status).toBe(200);
  });

  it("is not for a committee member to apply with: the applicant's side is closed to them", async () => {
    expect((await call(w.committee, "POST", `/applications/${w.a}/withdraw`, {})).status).toBe(403);
    expect((await call(w.committee, "POST", `/applications/${w.a}/submit`)).status).toBe(403);
    expect((await call(w.committee, "GET", "/applications")).body).toEqual({ items: [], total: 0 });
  });

  it("can add comments, which the applicant never sees", async () => {
    const res = await call(w.committee, "POST", `/applications/${w.a}/comments`, { body: "Strong fit for the coffee buyers." });
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    expect(res.body.comments.at(-1)).toMatchObject({ body: "Strong fit for the coffee buyers.", by: { name: "committee" } });
    expect((await workspace(w.reviewer, w.a)).comments.map((c: Json) => c.body)).toContain("Strong fit for the coffee buyers.");
    expect(JSON.stringify((await call(w.owners[0]!, "GET", `/applications/${w.a}`)).body)).not.toContain("coffee buyers");
  });
});

describe("comparing applicants", () => {
  it("lists the applications in committee review, for the committee, administrators and facilitators", async () => {
    for (const user of [w.committee, w.admin, w.facilitator]) {
      const view = await list("", user);
      expect(view.items.map((i: Json) => i.id).sort()).toEqual([w.a, w.b, w.c, w.d].sort());
      expect(view.period).toEqual({ id: w.periodId, name: `${PREFIX}summit-committee` });
      expect(view.counts).toEqual({ committee_review: 4, selected: 0, waitlisted: 0, not_selected: 0 });
    }
    for (const user of [w.reviewer, w.owners[0]!, w.outsider]) expect((await call(user, "GET", `/committee/applications?periodId=${w.periodId}`)).status).toBe(403);
    expect((await call(w.committee, "GET", `/committee/applications?periodId=${randomUUID()}`)).status).toBe(404);
  });

  it("uses the newest period when none is named", async () => {
    // The second period, which opens later and has nothing in it.
    const res = await call(w.committee, "GET", "/committee/applications");
    expect(res.body).toMatchObject({ period: { id: w.otherPeriodId }, items: [], total: 0 });
  });

  it("scores each applicant as the officer's workspace does, and ranks them", async () => {
    const view = await list();
    const expected = Object.fromEntries(await Promise.all([w.a, w.b, w.c, w.d].map(async (id) => [id, (await workspace(w.admin, id)).score])));
    for (const id of [w.a, w.b, w.c, w.d]) {
      expect(itemOf(view, id)).toMatchObject({ score: expected[id].total, points: expected[id].points, possible: expected[id].possible });
    }
    // A and C earned the same, so they share first place and the next is third. B earned 64 of 80, which is 80 of 100.
    expect([w.a, w.c, w.b, w.d].map((id) => [itemOf(view, id).score, itemOf(view, id).rank])).toEqual([[90, 1], [90, 1], [80, 3], [itemOf(view, w.d).score, 4]]);
    expect(itemOf(view, w.b)).toMatchObject({ points: 64, possible: 80 });
  });

  it("counts a manual adjustment in the score", async () => {
    // D was adjusted after it was returned: E1 went to 2.
    const view = await list();
    const workspaceD = await workspace(w.admin, w.d);
    expect(workspaceD.adjustments).toHaveLength(1);
    expect(itemOf(view, w.d).score).toBe(workspaceD.score.total);
    const categoryE = itemOf(view, w.d).categories.find((c: Json) => c.id === "E");
    expect(categoryE.points).toBe(workspaceD.categories.find((c: Json) => c.id === "E").points);
  });

  it("gives each applicant's points in every category, with D left out where it doesn't apply", async () => {
    const view = await list();
    const b = itemOf(view, w.b);
    expect(b.categories.map((c: Json) => [c.id, c.applicable])).toEqual([["A", true], ["B", true], ["C", true], ["D", false], ["E", true], ["F", true], ["G", true]]);
    expect(b.categories.find((c: Json) => c.id === "D").points).toBeNull();
    const a = itemOf(view, w.a);
    expect(a.categories.reduce((sum: number, c: Json) => sum + c.points, 0)).toBe(90);
    expect(a.categories.map((c: Json) => c.maxPoints)).toEqual([10, 15, 20, 20, 15, 10, 10]);
  });

  it("works out readiness from categories E and G", async () => {
    const view = await list();
    for (const id of [w.a, w.b, w.c, w.d]) {
      const item = itemOf(view, id);
      const [e, g] = ["E", "G"].map((category) => item.categories.find((c: Json) => c.id === category));
      expect(item.readiness).toBe(Math.round(((e.points + g.points) / (e.maxPoints + g.maxPoints)) * 1000) / 10);
    }
  });

  it("carries the recommendation and the business", async () => {
    const view = await list();
    expect(itemOf(view, w.a)).toMatchObject({
      organizationName: "org-a",
      country: COUNTRY,
      sector: "Coffee",
      pathway: "trade_and_market_access",
      womanOwned: true,
      youthOwned: false,
      status: "committee_review",
      decision: null,
      recommendation: { recommendation: "recommend_selection", label: "Recommend for Summit selection", suitableOpportunity: "trade" },
    });
    expect(itemOf(view, w.d)).toMatchObject({ pathway: "strategic_partnership", recommendation: { recommendation: "do_not_recommend" } });
  });

  it("sorts by rank, score, readiness, name and country", async () => {
    const byRank = await list("&sort=rank");
    expect(byRank.items.map((i: Json) => i.rank)).toEqual([1, 1, 3, 4]);
    // Equal places keep the order of the application numbers.
    expect(numbers(byRank).slice(0, 2)).toEqual([...numbers(byRank).slice(0, 2)].sort());
    expect((await list("&sort=score")).items.map((i: Json) => i.score)).toEqual([...byRank.items.map((i: Json) => i.score)]);
    const readiness = (await list("&sort=readiness")).items.map((i: Json) => i.readiness);
    expect(readiness).toEqual([...readiness].sort((x: number, y: number) => y - x));
    expect((await list("&sort=name")).items.map((i: Json) => i.organizationName)).toEqual(["org-a", "org-b", "org-c", "org-d"]);
    expect((await list("&sort=country")).items.map((i: Json) => i.country)).toEqual([COUNTRY, COUNTRY, COUNTRY, "QY"].sort());
  });

  it("filters by country, sector, opportunity type, score, readiness, recommendation, and ownership", async () => {
    const ids = async (query: string) => (await list(query)).items.map((i: Json) => i.id).sort();
    expect(await ids("&country=qy")).toEqual([w.b]);
    expect(await ids("&sector=COFFEE")).toEqual([w.a, w.c].sort());
    expect(await ids("&pathway=strategic_partnership")).toEqual([w.d]);
    expect(await ids("&pathway=investment")).toEqual([]);
    expect(await ids("&minScore=85")).toEqual([w.a, w.c].sort());
    expect(await ids("&minScore=70&maxScore=85")).toEqual([w.b]);
    expect(await ids("&recommendation=recommend_subject_to_verification")).toEqual([w.c]);
    expect(await ids("&recommendation=do_not_recommend")).toEqual([w.d]);
    expect(await ids("&womanOwned=true")).toEqual([w.a, w.d].sort());
    expect(await ids("&womanOwned=false")).toEqual([w.b, w.c].sort());
    expect(await ids("&youthOwned=true")).toEqual([w.b, w.d].sort());
    expect(await ids("&womanOwned=true&youthOwned=true")).toEqual([w.d]);
    expect(await ids("&status=selected")).toEqual([]);
    expect(await ids("&q=ORG-C")).toEqual([w.c]);
    const readyEnough = (await list()).items.filter((i: Json) => i.readiness >= 80).map((i: Json) => i.id).sort();
    expect(await ids("&minReadiness=80")).toEqual(readyEnough);
    expect((await call(w.committee, "GET", `/committee/applications?periodId=${w.periodId}&minScore=101`)).status).toBe(400);
  });

  it("keeps an applicant's place whatever the filter, and pages the result", async () => {
    const filtered = await list("&country=QY");
    expect(itemOf(filtered, w.b).rank).toBe(3);
    expect(filtered.total).toBe(1);
    expect(filtered.counts.committee_review).toBe(4);
    const first = await list("&limit=3&offset=0");
    const rest = await list("&limit=3&offset=3");
    expect([first.items.length, rest.items.length, first.total, rest.total]).toEqual([3, 1, 4, 4]);
    expect([...numbers(first), ...numbers(rest)]).toEqual(numbers(await list()));
  });
});

describe("comparing two to five side by side", () => {
  const compare = (ids: string[], user: TestUser = w.committee) => call(user, "GET", `/committee/compare?ids=${ids.join(",")}`);

  it("gives the scores, the recommendation and why, what was verified and the figures the committee weighs", async () => {
    const classified = await call(w.reviewer, "PUT", `/applications/${w.c}/verification/annual_revenue`, { class: "self_reported" });
    // The application is with the committee now, so the officer can't classify any more.
    expect(classified.status).toBe(409);
    await db.insert(schema.verificationRecord).values({ applicationId: w.c, claim: "annual_revenue", class: "self_reported", documentIds: [], recordedBy: w.reviewer.id });

    const res = await compare([w.c, w.a]);
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.items.map((i: Json) => i.id)).toEqual([w.c, w.a]);
    expect(res.body.items[0]).toMatchObject({
      organizationName: "org-c",
      score: 90,
      rank: 1,
      rationale: "Marked 90.",
      adjustments: 0,
      verification: [{ claim: "annual_revenue", label: "Annual revenue", class: "self_reported" }],
      profile: { annualRevenue: { amount: 1000, currency: "USD" }, employees: expect.any(Number), commercialAsk: "An answer" },
    });
    expect(res.body.items[0].categories).toHaveLength(7);
    expect((await compare([w.d, w.a])).body.items[0].adjustments).toBe(1);
  });

  it("takes two to five applications that the committee has reached", async () => {
    expect((await call(w.committee, "GET", `/committee/compare?ids=${w.a}`)).status).toBe(400);
    expect((await call(w.committee, "GET", `/committee/compare?ids=${w.a},nonsense`)).status).toBe(400);
    expect((await compare([w.a, w.a])).status).toBe(422);
    expect((await compare([w.a, w.e])).status).toBe(404);
    expect((await compare([w.a, randomUUID()])).status).toBe(404);
    for (const user of [w.reviewer, w.owners[0]!]) expect((await compare([w.a, w.b], user)).status).toBe(403);
    expect((await compare([w.a, w.b], w.facilitator)).status).toBe(200);
  });
});

describe("deciding", () => {
  const decide = (user: TestUser, id: string, body: object) => call(user, "POST", `/applications/${id}/decision`, body);
  const history = async (id: string) => (await call(w.admin, "GET", `/applications/${id}`)).body.staff.history as Json[];

  it("is for a member of the committee alone", async () => {
    const body = { decision: "selected", reason: "Because." };
    for (const user of [w.admin, w.facilitator, w.reviewer, w.owners[0]!]) expect([user.id, (await decide(user, w.a, body)).status]).toEqual([user.id, 403]);
    for (const user of [w.reviewer2, w.outsider]) expect((await decide(user, w.a, body)).status).toBe(404);
    expect(await statusOf(w.a)).toBe("committee_review");
  });

  it("needs a reason, and a decision the committee has", async () => {
    expect((await decide(w.committee, w.a, { decision: "selected" })).status).toBe(400);
    expect((await decide(w.committee, w.a, { decision: "selected", reason: "  " })).status).toBe(400);
    expect((await decide(w.committee, w.a, { decision: "approved", reason: "Yes." })).status).toBe(400);
    expect((await decide(w.committee, w.e, { decision: "selected", reason: "Not ready." })).status).toBe(404);
  });

  it("selects, waitlists or declines, with the reason, who and when", async () => {
    const selected = await decide(w.committee, w.a, { decision: "selected", reason: "Strong buyers and clear use of funds." });
    expect(selected.status, JSON.stringify(selected.body)).toBe(201);
    expect(selected.body).toMatchObject({
      id: w.a,
      status: "selected",
      decision: { decision: "selected", label: "Selected", reason: "Strong buyers and clear use of funds.", by: { name: "committee" } },
    });
    expect((await decide(w.committee2, w.b, { decision: "waitlisted", reason: "Good, but the cohort is full." })).body.status).toBe("waitlisted");
    expect((await decide(w.committee, w.d, { decision: "not_selected", reason: "Scored below the line." })).body.status).toBe("not_selected");

    expect((await history(w.a)).at(-1)).toMatchObject({ from: "committee_review", to: "selected", by: { name: "committee" }, reason: "Strong buyers and clear use of funds." });
    const audit = await db.select().from(schema.auditLog).where(and(eq(schema.auditLog.entityId, w.a), eq(schema.auditLog.action, "summit.committee.decided")));
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ platform: "summit", actorUserId: w.committee.id, before: { status: "committee_review" }, after: { decision: "selected", status: "selected" }, reason: "Strong buyers and clear use of funds." });
  });

  it("shows in the list, and the counts follow", async () => {
    const view = await list();
    expect(view.counts).toEqual({ committee_review: 1, selected: 1, waitlisted: 1, not_selected: 1 });
    expect(itemOf(view, w.b).decision).toMatchObject({ decision: "waitlisted", by: { name: "committee2" } });
    expect((await list("&status=waitlisted")).items.map((i: Json) => i.id)).toEqual([w.b]);
    expect(itemOf(view, w.c).decision).toBeNull();
  });

  it("can be replaced by another, and every decision is kept", async () => {
    const res = await decide(w.committee2, w.a, { decision: "waitlisted", reason: "Second thoughts on the cohort size." });
    expect(res.body).toMatchObject({ status: "waitlisted", decision: { reason: "Second thoughts on the cohort size.", by: { name: "committee2" } } });
    expect((await decide(w.committee, w.a, { decision: "selected", reason: "Back to selected after discussion." })).body.status).toBe("selected");
    const rows = await db.select().from(schema.committeeDecision).where(eq(schema.committeeDecision.applicationId, w.a));
    expect(rows.map((r) => r.decision).sort()).toEqual(["selected", "selected", "waitlisted"]);
    expect((await history(w.a)).map((h) => h.to).slice(-3)).toEqual(["selected", "waitlisted", "selected"]);
  });

  it("can ask for further review, which keeps the application with the committee", async () => {
    const res = await decide(w.committee, w.c, { decision: "further_review_required", reason: "Wait for the verification of revenue." });
    expect(res.body).toMatchObject({ status: "committee_review", decision: { decision: "further_review_required", label: "Further review required" } });
    // From a decision back to review.
    const back = await decide(w.committee, w.d, { decision: "further_review_required", reason: "Look again at category E." });
    expect(back.body.status).toBe("committee_review");
    expect(await statusOf(w.d)).toBe("committee_review");
    expect((await decide(w.committee, w.d, { decision: "not_selected", reason: "Confirmed after another look." })).body.status).toBe("not_selected");
  });

  it("tells the applicant nothing yet", async () => {
    for (const [i, id] of [w.a, w.b, w.c, w.d].entries()) {
      const res = await call(w.owners[i]!, "GET", `/applications/${id}`);
      expect(res.body.status).toBe("in_review");
      const text = JSON.stringify(res.body);
      for (const secret of ["selected", "waitlisted", "cohort", "committee", "Scored below"]) expect(text).not.toContain(secret);
    }
    const listed = await call(w.owners[0]!, "GET", "/applications");
    expect(listed.body.items[0].status).toBe("in_review");
  });
});

describe("the final list", () => {
  const view = async (user: TestUser = w.committee, periodId = w.periodId) => {
    const res = await call(user, "GET", `/periods/${periodId}/final-list`);
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    return res.body;
  };
  const approveList = (user: TestUser, body: object = {}, periodId = w.periodId) => call(user, "POST", `/periods/${periodId}/final-list`, body);
  const resend = (user: TestUser, periodId = w.periodId) => call(user, "POST", `/periods/${periodId}/final-list/notifications`);
  const results = async () =>
    db.select().from(schema.applicationResult).orderBy(schema.applicationResult.applicationId);
  const text = (res: Json) => JSON.stringify(res.body);

  it("shows where the committee's work stands, to the committee, administrators and facilitators", async () => {
    // A is selected, B waitlisted, D not selected; C is still with the committee and E is still with its officer.
    for (const user of [w.committee, w.admin, w.facilitator]) {
      expect(await view(user)).toMatchObject({
        period: { id: w.periodId },
        approved: false,
        approvedAt: null,
        counts: { selected: 1, waitlisted: 1, notSelected: 1 },
        pending: { inCommitteeReview: 1, beforeCommittee: 1 },
        unnotified: 0,
        canApprove: false,
      });
    }
    expect((await view()).blockers).toEqual(["1 application is still in committee review. Decide each one first."]);
    for (const user of [w.reviewer, w.owners[0]!, w.outsider]) {
      expect((await call(user, "GET", `/periods/${w.periodId}/final-list`)).status).toBe(403);
    }
    expect((await call(w.committee, "GET", `/periods/${randomUUID()}/final-list`)).status).toBe(404);
  });

  it("can't be approved by anyone but the committee", async () => {
    for (const user of [w.admin, w.facilitator, w.reviewer, w.owners[0]!]) expect([user.id, (await approveList(user)).status]).toEqual([user.id, 403]);
    expect((await approveList(w.committee, {}, randomUUID())).status).toBe(404);
  });

  it("waits until every application in committee review is decided, and publishes nothing before", async () => {
    const refused = await approveList(w.committee);
    expect(refused.status).toBe(422);
    expect(refused.body.error).toContain("1 application is still in committee review");
    expect(await results()).toEqual([]);
    expect(queue.jobs).toEqual([]);
    expect((await call(w.owners[0]!, "GET", `/applications/${w.a}`)).body).toMatchObject({ status: "in_review", result: null });
  });

  it("has nothing to approve in a period where nothing has been decided", async () => {
    const empty = await view(w.committee, w.otherPeriodId);
    expect(empty).toMatchObject({ approved: false, counts: { selected: 0, waitlisted: 0, notSelected: 0 }, canApprove: false });
    expect(empty.blockers).toEqual(["No application has been decided yet."]);
    expect((await approveList(w.committee, {}, w.otherPeriodId)).status).toBe(422);
    expect((await resend(w.committee, w.otherPeriodId)).status).toBe(409);
  });

  it("approves once every application in committee review is decided, and says what it holds", async () => {
    // E is recommended and waiting for an administrator: it is on its way to the committee, not in its hands.
    await recommended(w.e, 40);
    expect(await statusOf(w.e)).toBe("recommended");
    expect((await call(w.committee2, "POST", `/applications/${w.c}/decision`, { decision: "waitlisted", reason: "Verification of revenue came back late." })).status).toBe(201);
    const ready = await view();
    expect(ready).toMatchObject({ canApprove: true, blockers: [], counts: { selected: 1, waitlisted: 2, notSelected: 1 }, pending: { inCommitteeReview: 0, beforeCommittee: 1 } });

    const res = await approveList(w.committee2, { note: "Agreed at the meeting of 4 January." });
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    expect(res.body).toMatchObject({
      approved: true,
      approvedBy: { name: "committee2" },
      note: "Agreed at the meeting of 4 January.",
      counts: { selected: 1, waitlisted: 2, notSelected: 1 },
      canApprove: false,
      blockers: ["The final list is already approved."],
      unnotified: 0,
    });
    expect(await results()).toHaveLength(4);
    const audit = await db.select().from(schema.auditLog).where(and(eq(schema.auditLog.entityId, w.periodId), eq(schema.auditLog.action, "summit.finalList.approved")));
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({
      platform: "summit",
      entityType: "summit_period",
      actorUserId: w.committee2.id,
      after: { selected: 1, waitlisted: 2, notSelected: 1, inReview: 1 },
      reason: "Agreed at the meeting of 4 January.",
    });
  });

  it("emails each decided applicant once, with what they are told and no more", async () => {
    const emails = queue.jobs.filter((j) => j.name === "send-email" && j.data.template === "summit-result");
    expect(emails).toHaveLength(4);
    const byNumber = Object.fromEntries(emails.map((j) => [j.data.props.applicationNumber, j.data]));
    const numbersOf = async (id: string) => (await call(w.admin, "GET", `/applications/${id}`)).body.number as string;
    expect(byNumber[await numbersOf(w.a)].props).toMatchObject({ organizationName: "org-a", message: expect.stringContaining("has been selected") });
    expect(byNumber[await numbersOf(w.b)].props.message).toContain("waiting list");
    expect(byNumber[await numbersOf(w.d)].props.message).toContain("was not selected");
    expect(byNumber[await numbersOf(w.e)]).toBeUndefined();
    for (const email of emails) {
      expect(email.data.to).toEqual([expect.stringContaining("@example.test")]);
      expect(email.data.subject).toBe(`The result of Summit application ${email.data.props.applicationNumber}`);
      const text = JSON.stringify(email.data);
      for (const secret of ["Scored below", "cohort", "verification", "score", "reason"]) expect(text).not.toContain(secret);
    }
    expect((await results()).every((r) => r.notifiedAt !== null)).toBe(true);
  });

  it("shows each applicant their result, and an application still in assessment stays in review", async () => {
    const expected: [number, string, string][] = [[0, w.a, "selected"], [1, w.b, "waitlisted"], [2, w.c, "waitlisted"], [3, w.d, "not_selected"]];
    for (const [i, id, decision] of expected) {
      const res = await call(w.owners[i]!, "GET", `/applications/${id}`);
      expect(res.body.status).toBe(decision);
      expect(res.body.result).toMatchObject({ decision, notifiedAt: null, label: expect.any(String), message: expect.any(String) });
      const listed = await call(w.owners[i]!, "GET", "/applications");
      expect(listed.body.items[0].status).toBe(decision);
    }
    const e = await call(w.owners[4]!, "GET", `/applications/${w.e}`);
    expect(e.body).toMatchObject({ status: "in_review", result: null });
  });

  it("never shows the applicant a score, a reason, or the committee's comments", async () => {
    for (const [i, id] of [w.a, w.b, w.c, w.d].entries()) {
      const body = text(await call(w.owners[i]!, "GET", `/applications/${id}`));
      for (const secret of ["Strong buyers", "Second thoughts", "cohort", "Scored below", "Confirmed after", "verification of revenue", "rationale", "coffee buyers"]) {
        expect(body).not.toContain(secret);
      }
    }
  });

  it("shows staff whether the email was queued", async () => {
    const res = await call(w.admin, "GET", `/applications/${w.a}`);
    expect(res.body.status).toBe("selected");
    expect(res.body.result).toMatchObject({ decision: "selected", notifiedAt: expect.any(String) });
  });

  it("closes the committee's work: no more decisions, and no more applications sent to it", async () => {
    const late = await call(w.committee, "POST", `/applications/${w.a}/decision`, { decision: "not_selected", reason: "Changed my mind." });
    expect(late.status).toBe(409);
    expect(late.body.error).toContain("final list for this period is approved");
    expect(await statusOf(w.a)).toBe("selected");

    const review = await approve(w.e);
    expect(review.status).toBe(409);
    expect(review.body.error).toContain("final list for this period is approved");
    expect(await statusOf(w.e)).toBe("recommended");
    // Sending it back to its officer is still open.
    expect((await call(w.admin, "POST", `/applications/${w.e}/review`, { decision: "return", reason: "Look again." })).status).toBe(200);
  });

  it("is approved once and not undone", async () => {
    const again = await approveList(w.committee);
    expect(again.status).toBe(409);
    expect(again.body.error).toContain("already approved");
    expect(queue.jobs.filter((j) => j.data.template === "summit-result")).toHaveLength(4);
  });

  it("sends the emails again to the applicants a down queue missed, and to nobody twice", async () => {
    const before = queue.jobs.length;
    expect((await resend(w.committee)).body.unnotified).toBe(0);
    expect(queue.jobs).toHaveLength(before);

    const [first, second, third] = await results();
    await db.update(schema.applicationResult).set({ notifiedAt: null }).where(eq(schema.applicationResult.applicationId, first!.applicationId));
    await db.update(schema.applicationResult).set({ notifiedAt: null }).where(eq(schema.applicationResult.applicationId, second!.applicationId));
    await db.update(schema.applicationResult).set({ notifiedAt: null }).where(eq(schema.applicationResult.applicationId, third!.applicationId));
    expect((await view()).unnotified).toBe(3);

    // The queue is down for the first one tried: that applicant is still waiting, the others are sent.
    queue.failNext = true;
    const partial = await resend(w.facilitator);
    expect(partial.status, JSON.stringify(partial.body)).toBe(200);
    expect(partial.body.unnotified).toBe(1);
    expect(queue.jobs).toHaveLength(before + 2);

    const rest = await resend(w.admin);
    expect(rest.body.unnotified).toBe(0);
    expect(queue.jobs).toHaveLength(before + 3);
    const audit = await db.select().from(schema.auditLog).where(and(eq(schema.auditLog.entityId, w.periodId), eq(schema.auditLog.action, "summit.finalList.resent")));
    expect(audit).toHaveLength(3);
  });

  it("is for the committee, administrators and facilitators to resend", async () => {
    for (const user of [w.reviewer, w.owners[0]!, w.outsider]) expect((await resend(user)).status).toBe(403);
  });
});

describe("the dashboard", () => {
  const dashboard = async (user: TestUser = w.committee, periodId = w.periodId) => {
    const res = await call(user, "GET", `/dashboard?periodId=${periodId}`);
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    return res.body;
  };
  const setTarget = (user: TestUser, body: object, periodId = w.periodId) => call(user, "PUT", `/periods/${periodId}/selection-target`, body);
  const mean = (values: number[]) => Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;

  it("is for the committee, administrators and facilitators", async () => {
    for (const user of [w.committee, w.admin, w.facilitator]) expect((await dashboard(user)).period).toMatchObject({ id: w.periodId, countries: [COUNTRY] });
    for (const user of [w.reviewer, w.owners[0]!, w.outsider]) expect((await call(user, "GET", `/dashboard?periodId=${w.periodId}`)).status).toBe(403);
    expect((await call(w.committee, "GET", `/dashboard?periodId=${randomUUID()}`)).status).toBe(404);
    expect((await call(w.committee, "GET", "/dashboard?periodId=nonsense")).status).toBe(400);
  });

  it("counts the applications at each stage, as the database has them", async () => {
    // A selected, B and C waitlisted, D not selected, and E back with its officer.
    const d = await dashboard();
    expect(d.totals).toMatchObject({
      applications: 5,
      drafts: 0,
      withdrawn: 0,
      eligible: 5,
      ineligible: 0,
      awaitingInformation: 0,
      underAssessment: 1,
      assessed: 4,
      inCommitteeReview: 0,
      selected: 1,
      waitlisted: 2,
      notSelected: 1,
    });
    expect(Date.parse(d.generatedAt)).not.toBeNaN();
  });

  it("averages the scores the committee sees, adjustments counted", async () => {
    const listed = (await list()).items;
    const scoreOf = (id: string) => listed.find((i: Json) => i.id === id).score as number;
    const d = await dashboard();
    expect(d.totals.averageScore).toBe(mean([w.a, w.b, w.c, w.d].map(scoreOf)));
    const qz = d.byCountry.find((c: Json) => c.country === COUNTRY);
    expect(qz.averageScore).toBe(mean([w.a, w.c, w.d].map(scoreOf)));
  });

  it("splits everything by country, with the period's countries first and any other after", async () => {
    const d = await dashboard();
    expect(d.byCountry.map((c: Json) => c.country)).toEqual([COUNTRY, "QY"]);
    expect(d.byCountry[0]).toMatchObject({ applications: 4, eligible: 4, underAssessment: 1, assessed: 3, selected: 1, waitlisted: 1, notSelected: 1, target: 10, remaining: 9 });
    // B moved to another country after it applied: it still counts, with no target.
    expect(d.byCountry[1]).toMatchObject({ applications: 1, eligible: 1, underAssessment: 0, assessed: 1, averageScore: 80, selected: 0, waitlisted: 1, target: 0, remaining: 0 });
  });

  it("groups the industries, the pathways and the officers' view of what suits each applicant", async () => {
    const d = await dashboard();
    expect(d.byIndustry).toHaveLength(5);
    expect(d.byIndustry.find((i: Json) => i.sector === "Coffee")).toEqual({ sector: "Coffee", applications: 1, selected: 1 });
    expect(d.byIndustry.map((i: Json) => i.sector).sort()).toEqual(["Coffee", "Coffee processing", "Honey", "Leather goods", "Textiles and apparel"]);
    expect(d.byPathway).toEqual({ trade_and_market_access: 4, investment: 0, strategic_partnership: 1, combined_trade_and_investment: 0 });
    // D's latest recommendation, made after its assessment came back, names no opportunity.
    expect(d.bySuitableOpportunity).toEqual({ trade: 4, investment: 0, strategic_partnership: 0, combined: 0 });
  });

  it("counts women-owned and youth-owned businesses and how many were selected", async () => {
    expect((await dashboard()).ownership).toEqual({ womanOwned: { applications: 2, selected: 1 }, youthOwned: { applications: 2, selected: 0 } });
  });

  it("counts how the claims were verified", async () => {
    // C's revenue was recorded as self-reported in the comparison tests.
    expect((await dashboard()).verification).toEqual({
      byClass: { self_reported: 1, document_supported: 0, independently_verified: 0, not_verified: 0, not_applicable: 0 },
      classifiedApplications: 1,
    });
  });

  it("shows a period with nothing in it as zeros against its targets, and is the default when no period is named", async () => {
    const d = await dashboard(w.committee, w.otherPeriodId);
    expect(d.totals).toMatchObject({ applications: 0, drafts: 0, assessed: 0, selected: 0, averageScore: null });
    expect(d.byCountry).toEqual([expect.objectContaining({ country: COUNTRY, applications: 0, averageScore: null, target: 10, remaining: 10 })]);
    expect(d.byIndustry).toEqual([]);
    expect((await call(w.committee, "GET", "/dashboard")).body.period.id).toBe(w.otherPeriodId);
  });

  it("starts at 10 for each country", async () => {
    expect((await dashboard()).target).toEqual({ perCountry: 10, overrides: {}, total: 10, selected: 1, remaining: 9 });
    expect(await db.select().from(schema.selectionTarget).where(eq(schema.selectionTarget.periodId, w.periodId))).toEqual([]);
  });

  it("lets the committee change the target, for every country or for one", async () => {
    for (const user of [w.admin, w.facilitator, w.reviewer, w.owners[0]!]) expect([user.id, (await setTarget(user, { perCountry: 5 })).status]).toEqual([user.id, 403]);

    const all = await setTarget(w.committee, { perCountry: 3 });
    expect(all.status, JSON.stringify(all.body)).toBe(200);
    expect(all.body.target).toEqual({ perCountry: 3, overrides: {}, total: 3, selected: 1, remaining: 2 });
    expect(all.body.byCountry[0]).toMatchObject({ target: 3, remaining: 2 });

    const one = await setTarget(w.committee2, { countries: { [COUNTRY.toLowerCase()]: 1 } });
    expect(one.body.target).toEqual({ perCountry: 3, overrides: { [COUNTRY]: 1 }, total: 1, selected: 1, remaining: 0 });
    expect(one.body.byCountry[0]).toMatchObject({ target: 1, remaining: 0 });

    const cleared = await setTarget(w.committee, { countries: { [COUNTRY]: null }, perCountry: 12 });
    expect(cleared.body.target).toEqual({ perCountry: 12, overrides: {}, total: 12, selected: 1, remaining: 11 });
  });

  it("refuses figures that make no sense, and countries the period doesn't take", async () => {
    for (const body of [{}, { countries: {} }, { perCountry: -1 }, { perCountry: 1.5 }, { perCountry: 1001 }, { countries: { [COUNTRY]: "ten" } }, { countries: { ABC: 3 } }]) {
      expect([JSON.stringify(body), (await setTarget(w.committee, body)).status]).toEqual([JSON.stringify(body), 400]);
    }
    const unknown = await setTarget(w.committee, { countries: { KE: 3 } });
    expect(unknown.status).toBe(422);
    expect(unknown.body.error).toContain("KE isn't one of the countries of this period");
    expect((await setTarget(w.committee, { perCountry: 3 }, randomUUID())).status).toBe(404);
    expect((await dashboard()).target.perCountry).toBe(12);
  });

  it("audits each change with the figures before and after", async () => {
    const rows = await db
      .select()
      .from(schema.auditLog)
      .where(and(eq(schema.auditLog.entityId, w.periodId), eq(schema.auditLog.action, "summit.selectionTarget.changed")))
      .orderBy(schema.auditLog.occurredAt);
    expect(rows.map((r) => [r.platform, r.actorUserId, r.before, r.after])).toEqual([
      ["summit", w.committee.id, { perCountry: 10, overrides: {} }, { perCountry: 3, overrides: {} }],
      ["summit", w.committee2.id, { perCountry: 3, overrides: {} }, { perCountry: 3, overrides: { [COUNTRY]: 1 } }],
      ["summit", w.committee.id, { perCountry: 3, overrides: { [COUNTRY]: 1 } }, { perCountry: 12, overrides: {} }],
    ]);
  });

  it("follows the applications as they change", async () => {
    // E's organisation withdraws while E is with its officer.
    expect((await call(w.owners[4]!, "POST", `/applications/${w.e}/withdraw`, { reason: "Not this year." })).status).toBe(200);
    const d = await dashboard();
    expect(d.totals).toMatchObject({ applications: 4, withdrawn: 1, underAssessment: 0, assessed: 4 });
    expect(d.byCountry[0]).toMatchObject({ applications: 3, underAssessment: 0 });
    expect(d.byIndustry.map((i: Json) => i.sector)).not.toContain("Honey");
  });
});
