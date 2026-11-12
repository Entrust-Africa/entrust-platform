import { randomUUID } from "node:crypto";
import { and, eq, inArray, like, sql } from "drizzle-orm";
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

/** A new session for a user made with signUp, which has not passed any second step. */
export async function signIn(name: string): Promise<TestUser> {
  const { headers, response } = await auth.api.signInEmail({
    body: { email: `${PREFIX}${RUN}-${name}@example.test`, password: "correct-horse-battery" },
    returnHeaders: true,
  });
  const cookie = headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
  await db.update(schema.session).set({ expiresAt: new Date("2100-01-01") }).where(eq(schema.session.userId, response.user.id));
  return { id: response.user.id, cookie };
}

/** An organisation with its members. `smeProfile` gives it the QZ country so cases get QZ references. */
export async function createOrganization(
  name: string,
  members: readonly (readonly [TestUser, string])[],
  { smeProfile = true, platform = "clear" as "clear" | "trade" | "mizan" | null } = {},
): Promise<string> {
  const id = `${PREFIX}${RUN}-${name}`;
  await db.insert(schema.organization).values({
    id,
    name,
    slug: id,
    createdAt: new Date(),
    metadata: JSON.stringify({ kind: smeProfile ? "sme" : "entrust" }),
  });
  if (members.length) {
    await db
      .insert(schema.member)
      .values(members.map(([user, role]) => ({ id: randomUUID(), organizationId: id, userId: user.id, role, createdAt: new Date() })));
  }
  if (smeProfile) {
    await db.insert(schema.smeProfile).values({ organizationId: id, smeId: `TEST-${RUN}-${name}`, legalName: name, country: COUNTRY });
    if (platform) {
      await db.insert(schema.platformAccess).values({ organizationId: id, platform });
    }
  }
  return id;
}

/** A file in the files store for an organisation, without going through an upload. */
export async function makeFile(organizationId: string, userId: string, name = "document.pdf") {
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

export async function cleanup() {
  const organizations = await db
    .select({ id: schema.organization.id })
    .from(schema.organization)
    .where(like(schema.organization.id, `${PREFIX}%`));
  const ids = organizations.map((o) => o.id);
  if (ids.length) {
    // Audit rows would otherwise outlive the organisation with their link set to null.
    await db.delete(schema.auditLog).where(inArray(schema.auditLog.organizationId, ids));
    await db.delete(schema.platformAccess).where(inArray(schema.platformAccess.organizationId, ids));
    // Approved MIZAN assessments are frozen by a trigger; tests are what its escape hatch is for. One statement, so assessments
    // that point at each other go together.
    await db.transaction(async (tx) => {
      await tx.execute(sql`set local mizan.allow_frozen_delete = 'on'`);
      await tx.delete(schema.mizanReview).where(inArray(schema.mizanReview.assessmentId, tx.select({ id: schema.mizanAssessment.id }).from(schema.mizanAssessment).where(inArray(schema.mizanAssessment.organizationId, ids))));
      await tx.delete(schema.mizanDocument).where(inArray(schema.mizanDocument.organizationId, ids));
      await tx.delete(schema.mizanAssessment).where(inArray(schema.mizanAssessment.organizationId, ids));
    });
    await db.delete(schema.evidenceRecord).where(inArray(schema.evidenceRecord.organizationId, ids));
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
  // Commerce editions belong to no organisation, so the tests' own go by their address, and their products with them.
  const editions = await db.select({ id: schema.commerceEdition.id }).from(schema.commerceEdition).where(like(schema.commerceEdition.slug, `${PREFIX}%`));
  if (editions.length) {
    const editionIds = editions.map((e) => e.id);
    const products = await db.select({ id: schema.commerceProduct.id }).from(schema.commerceProduct).where(inArray(schema.commerceProduct.editionId, editionIds));
    const bookings = await db.select({ id: schema.exhibitorBooking.id }).from(schema.exhibitorBooking).where(inArray(schema.exhibitorBooking.editionId, editionIds));
    const enquiries = await db.select({ id: schema.sponsorEnquiry.id }).from(schema.sponsorEnquiry).where(inArray(schema.sponsorEnquiry.editionId, editionIds));
    const profiles = await db.select({ id: schema.smePublicProfile.id }).from(schema.smePublicProfile).where(inArray(schema.smePublicProfile.editionId, editionIds));
    const enquiriesB2b = await db.select({ id: schema.b2bEnquiry.id }).from(schema.b2bEnquiry).where(inArray(schema.b2bEnquiry.editionId, editionIds));
    const delegates = await db.select({ id: schema.delegateRegistration.id }).from(schema.delegateRegistration).where(inArray(schema.delegateRegistration.editionId, editionIds));
    const payments = await db.select({ id: schema.commercePayment.id }).from(schema.commercePayment).where(inArray(schema.commercePayment.editionId, editionIds));
    const entityIds = [...editionIds, ...products.map((p) => p.id), ...bookings.map((b) => b.id), ...enquiries.map((e) => e.id), ...delegates.map((d) => d.id), ...profiles.map((x) => x.id), ...enquiriesB2b.map((x) => x.id), ...payments.map((p) => p.id)];
    await db.delete(schema.auditLog).where(inArray(schema.auditLog.entityId, entityIds));
    await db.delete(schema.commercePayment).where(inArray(schema.commercePayment.editionId, editionIds));
    await db.delete(schema.b2bEnquiry).where(inArray(schema.b2bEnquiry.editionId, editionIds));
    await db.delete(schema.smePublicProfile).where(inArray(schema.smePublicProfile.editionId, editionIds));
    await db.delete(schema.exhibitorBooking).where(inArray(schema.exhibitorBooking.editionId, editionIds));
    await db.delete(schema.sponsorEnquiry).where(inArray(schema.sponsorEnquiry.editionId, editionIds));
    await db.delete(schema.delegateRegistration).where(inArray(schema.delegateRegistration.editionId, editionIds));
    await db.delete(schema.commerceEdition).where(inArray(schema.commerceEdition.id, editionIds));
  }
  // Summit registrations come from a public form and belong to no organisation, so the tests' own go by their address.
  await db.delete(schema.registration).where(like(schema.registration.email, `${PREFIX}%`));
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
  // The register of pilot SMEs belongs to no organisation, so the tests' own businesses go by their code, and the audit rows of the people who loaded them with the people.
  await db.delete(schema.smeRegister).where(like(schema.smeRegister.code, `${PREFIX.toUpperCase()}%`));
  // Application responses are labelled with the programme they were loaded for.
  await db.delete(schema.programApplication).where(like(schema.programApplication.program, `${PREFIX}%`));
  const people = await db.select({ id: schema.user.id }).from(schema.user).where(like(schema.user.email, `${PREFIX}%`));
  if (people.length) {
    await db.delete(schema.auditLog).where(and(inArray(schema.auditLog.entityType, ["sme_register", "program_application"]), inArray(schema.auditLog.actorUserId, people.map((p) => p.id))));
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

/** Calls the API under /v1 in-process and returns the response as it is, for a file. */
export async function callFileV1(user: TestUser | null, path: string) {
  return app.request(`/v1${path}`, { headers: { ...(user ? { cookie: user.cookie } : {}), origin: "http://localhost:3000" } });
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
