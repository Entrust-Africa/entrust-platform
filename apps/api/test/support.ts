import { randomUUID } from "node:crypto";
import { eq, inArray, like } from "drizzle-orm";
import { auth } from "@entrust/auth";
import { getDb, schema } from "@entrust/db";
import { EVIDENCE_TYPES, STEPS, type StepId } from "@entrust/rules";
import { app } from "../src/app";

// Everything the tests create is named with PREFIX and removed afterwards. Cases take their
// references from a country no real exporter has (QZ is reserved for user assignment), so they
// never use up numbers from the real sequence.
export const PREFIX = "test-api-";
export const COUNTRY = "QZ";
const RUN = randomUUID().slice(0, 8);

export const db = getDb();

export interface TestUser {
  id: string;
  cookie: string;
}

/** Signs a user up through Better Auth, verifies them, and keeps the session cookie it sets. */
export async function signUp(name: string): Promise<TestUser> {
  const email = `${PREFIX}${RUN}-${name}@example.test`;
  const password = "correct-horse-battery";
  const res = await auth.api.signUpEmail({
    body: { name, email, password },
  });
  const userId = res.user.id;
  await db.update(schema.user).set({ emailVerified: true }).where(eq(schema.user.id, userId));
  const { headers } = await auth.api.signInEmail({
    body: { email, password },
    returnHeaders: true,
  });
  const cookie = headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
  // Better Auth drops a session once it has expired. Tests move the clock forward, so the session
  // has to outlast them.
  await db.update(schema.session).set({ expiresAt: new Date("2100-01-01") }).where(eq(schema.session.userId, userId));
  return { id: userId, cookie };
}

/** An organisation with its members. `smeProfile` gives it the QZ country so cases get QZ references. */
export async function createOrganization(
  name: string,
  members: readonly (readonly [TestUser, string])[],
  { smeProfile = true } = {},
): Promise<string> {
  const id = `${PREFIX}${RUN}-${name}`;
  await db.insert(schema.organization).values({ id, name, slug: id, createdAt: new Date() });
  if (members.length) {
    await db
      .insert(schema.member)
      .values(members.map(([user, role]) => ({ id: randomUUID(), organizationId: id, userId: user.id, role, createdAt: new Date() })));
  }
  if (smeProfile) {
    await db.insert(schema.smeProfile).values({ organizationId: id, smeId: `TEST-${RUN}-${name}`, legalName: name, country: COUNTRY });
  }
  return id;
}

export async function cleanup() {
  const organizations = await db
    .select({ id: schema.organization.id })
    .from(schema.organization)
    .where(like(schema.organization.id, `${PREFIX}%`));
  const ids = organizations.map((o) => o.id);
  if (ids.length) {
    // Audit rows would otherwise outlive the organisation with their link set to null.
    await db.delete(schema.auditLog).where(inArray(schema.auditLog.organizationId, ids));
    await db.delete(schema.file).where(inArray(schema.file.organizationId, ids));
    await db.delete(schema.exportCase).where(inArray(schema.exportCase.organizationId, ids));
    await db.delete(schema.salesContract).where(inArray(schema.salesContract.organizationId, ids));
    await db.delete(schema.organization).where(inArray(schema.organization.id, ids));
  }
  // Price tables belong to no organisation and are shared, so only the ones the tests labelled go.
  const tables = await db
    .select({ id: schema.minimumPriceTable.id })
    .from(schema.minimumPriceTable)
    .where(like(schema.minimumPriceTable.label, `${PREFIX}%`));
  if (tables.length) {
    const tableIds = tables.map((t) => t.id);
    await db.delete(schema.auditLog).where(inArray(schema.auditLog.entityId, tableIds));
    await db.delete(schema.minimumPriceTable).where(inArray(schema.minimumPriceTable.id, tableIds));
  }
  // Summit periods belong to no organisation. An organisation's applications go with it, so the periods are free to go.
  const periods = await db
    .select({ id: schema.applicationPeriod.id })
    .from(schema.applicationPeriod)
    .where(like(schema.applicationPeriod.name, `${PREFIX}%`));
  if (periods.length) {
    const periodIds = periods.map((p) => p.id);
    await db.delete(schema.auditLog).where(inArray(schema.auditLog.entityId, periodIds));
    await db.delete(schema.applicationPeriod).where(inArray(schema.applicationPeriod.id, periodIds));
  }
  await db.delete(schema.user).where(like(schema.user.email, `${PREFIX}%`));
  await db.delete(schema.caseReferenceCounter).where(eq(schema.caseReferenceCounter.country, COUNTRY));
}

export type Json = any;

/** Calls the CLEAR API in-process, as `user` (or signed out). */
export async function call(user: TestUser | null, method: string, path: string, body?: unknown) {
  const response = await app.request(`/v1/clear${path}`, {
    method,
    headers: {
      ...(user ? { cookie: user.cookie } : {}),
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, body: (await response.json()) as Json };
}

/** Calls the API under /v1 in-process, as `user` (or signed out). */
export async function callV1(user: TestUser | null, method: string, path: string, body?: unknown) {
  const response = await app.request(`/v1${path}`, {
    method,
    headers: {
      ...(user ? { cookie: user.cookie } : {}),
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      origin: "http://localhost:3000",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, body: (await response.json()) as Json };
}

export const FACTS = { product: "green_coffee", destinationCountry: "US", transportMode: "sea" };

// ---- Putting a case in a state that would take dozens of calls to reach ----

/** Every step a step depends on, directly or not. */
export function prerequisitesOf(stepId: StepId): StepId[] {
  const found = new Set<StepId>();
  const visit = (id: StepId) => {
    for (const p of STEPS.find((s) => s.id === id)?.prerequisites ?? []) {
      if (!found.has(p)) {
        found.add(p);
        visit(p);
      }
    }
  };
  visit(stepId);
  return [...found];
}

export async function markCompleted(caseId: string, stepIds: readonly StepId[]) {
  if (stepIds.length === 0) return;
  await db
    .insert(schema.caseStep)
    .values(stepIds.map((stepId) => ({ caseId, stepId, status: "completed" as const })))
    .onConflictDoNothing();
}

/** Completes every step of a phase, with its evidence approved, so the phase gate locks. */
export async function lockPhase(caseId: string, phase: 1 | 2 | 3 | 4 | 5 | 6 | 7) {
  const steps = STEPS.filter((s) => s.phase === phase);
  await markCompleted(caseId, steps.map((s) => s.id));
  const types = new Set(steps.flatMap((s) => s.evidence.map((e) => e.type)));
  if (types.size) {
    await db.insert(schema.evidence).values(
      [...types].map((type) => {
        if (!EVIDENCE_TYPES.some((t) => t.id === type)) throw new Error(`Unknown evidence type ${type}`);
        return { caseId, type, status: "approved" as const, issuedOn: "2026-10-01" };
      }),
    );
  }
}
