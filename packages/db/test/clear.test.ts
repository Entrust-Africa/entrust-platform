import { eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { allocateCaseReference, formatCaseReference, schema } from "../src";

// Runs against DATABASE_URL with migrations applied. Uses ISO user-assigned country codes,
// which no real case has, and its own organisation, and removes both afterwards.
try {
  process.loadEnvFile("../../.env");
} catch {
  // Fall back to variables already in the environment.
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });
const ORG = "test-clear-schema";
const COUNTRIES = ["ZZ", "XZ"];
const FACTS = { product: "green_coffee", destinationCountry: "US" } as const;

async function clean() {
  await db.delete(schema.exportCase).where(eq(schema.exportCase.organizationId, ORG));
  await db
    .delete(schema.caseReferenceCounter)
    .where(inArray(schema.caseReferenceCounter.country, COUNTRIES));
}

async function insertCase(facts: object = FACTS) {
  const reference = await allocateCaseReference(db, { country: "ZZ", year: 2026 });
  const [row] = await db
    .insert(schema.exportCase)
    .values({ reference, organizationId: ORG, facts })
    .returning();
  return row!;
}

beforeAll(async () => {
  await db
    .insert(schema.organization)
    .values({ id: ORG, name: "Test exporter", slug: ORG, createdAt: new Date() })
    .onConflictDoNothing();
});
beforeEach(clean);
afterAll(async () => {
  await clean();
  await db.delete(schema.organization).where(eq(schema.organization.id, ORG));
  await pool.end();
});

describe("case references", () => {
  it("formats as CLR-<country>-<year>-<six digits>", () => {
    expect(formatCaseReference("ET", 2026, 145)).toBe("CLR-ET-2026-000145");
  });

  it("numbers cases in sequence, starting again each year and for each country", async () => {
    const take = (country: string, year: number) => allocateCaseReference(db, { country, year });
    expect(await take("ZZ", 2026)).toBe("CLR-ZZ-2026-000001");
    expect(await take("ZZ", 2026)).toBe("CLR-ZZ-2026-000002");
    expect(await take("ZZ", 2027)).toBe("CLR-ZZ-2027-000001");
    expect(await take("XZ", 2026)).toBe("CLR-XZ-2026-000001");
    expect(await take("ZZ", 2026)).toBe("CLR-ZZ-2026-000003");
  });

  it("never reuses a deleted case's reference", async () => {
    const first = await insertCase();
    await db.delete(schema.exportCase).where(eq(schema.exportCase.id, first.id));
    const second = await insertCase();
    expect(first.reference).toBe("CLR-ZZ-2026-000001");
    expect(second.reference).toBe("CLR-ZZ-2026-000002");
  });

  it("gives concurrent cases distinct, consecutive numbers", async () => {
    const references = await Promise.all(
      Array.from({ length: 10 }, () => allocateCaseReference(db, { country: "ZZ", year: 2026 })),
    );
    expect(references.toSorted()).toEqual(
      Array.from({ length: 10 }, (_, i) => formatCaseReference("ZZ", 2026, i + 1)),
    );
  });

  it("gives the number back when the case's transaction rolls back", async () => {
    await expect(
      db.transaction(async (tx) => {
        await allocateCaseReference(tx, { country: "ZZ", year: 2026 });
        tx.rollback();
      }),
    ).rejects.toThrow();
    expect(await allocateCaseReference(db, { country: "ZZ", year: 2026 })).toBe(
      "CLR-ZZ-2026-000001",
    );
  });

  it("rejects a country that is not an ISO code", async () => {
    await expect(allocateCaseReference(db, { country: "et", year: 2026 })).rejects.toThrow(
      "Not an ISO country code",
    );
  });
});

describe("clear schema", () => {
  it("reads product and destination from the case facts", async () => {
    const created = await insertCase();
    expect(created).toMatchObject({ product: "green_coffee", destinationCountry: "US" });

    const [updated] = await db
      .update(schema.exportCase)
      .set({ facts: { ...FACTS, destinationCountry: "DE" } })
      .where(eq(schema.exportCase.id, created.id))
      .returning();
    expect(updated?.destinationCountry).toBe("DE");
  });

  it("refuses a case without a product", async () => {
    await expect(insertCase({ destinationCountry: "US" })).rejects.toMatchObject({
      cause: { code: "23502", column: "product" },
    });
  });

  it("refuses a not-applicable step without a reason", async () => {
    const { id: caseId } = await insertCase();
    await expect(
      db.insert(schema.caseStep).values({ caseId, stepId: "STEP-041", status: "not_applicable" }),
    ).rejects.toMatchObject({
      cause: { code: "23514", constraint: "case_step_not_applicable_reason_check" },
    });
    await db.insert(schema.caseStep).values({
      caseId,
      stepId: "STEP-041",
      status: "not_applicable",
      notApplicableReason: "Ships to the US, not the EU",
    });
  });

  it("allows one row per step on a case", async () => {
    const { id: caseId } = await insertCase();
    await db.insert(schema.caseStep).values({ caseId, stepId: "STEP-001" });
    await expect(
      db.insert(schema.caseStep).values({ caseId, stepId: "STEP-001" }),
    ).rejects.toMatchObject({ cause: { code: "23505" } });
  });

  it("removes a case's steps, evidence and events with it", async () => {
    const { id: caseId } = await insertCase();
    await db.insert(schema.caseStep).values({ caseId, stepId: "STEP-001" });
    const [doc] = await db
      .insert(schema.evidence)
      .values({ caseId, type: "export_trade_licence" })
      .returning();
    await db
      .insert(schema.caseEvent)
      .values({ caseId, type: "evidence.submitted", evidenceId: doc!.id });

    await db.delete(schema.exportCase).where(eq(schema.exportCase.id, caseId));

    expect(await db.select().from(schema.caseStep).where(eq(schema.caseStep.caseId, caseId))).toEqual([]);
    expect(await db.select().from(schema.evidence).where(eq(schema.evidence.caseId, caseId))).toEqual([]);
    expect(await db.select().from(schema.caseEvent).where(eq(schema.caseEvent.caseId, caseId))).toEqual([]);
  });
});
