import { eq, inArray, like } from "drizzle-orm";
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
  await db.delete(schema.salesContract).where(eq(schema.salesContract.organizationId, ORG));
  // Price tables are shared, so only the ones these tests labelled are removed.
  await db.delete(schema.minimumPriceTable).where(like(schema.minimumPriceTable.label, `${ORG}%`));
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

describe("case flags", () => {
  const flag = (caseId: string, rule = "FL-02", rest: Partial<typeof schema.caseFlag.$inferInsert> = {}) => ({
    caseId,
    rule,
    severity: "critical" as const,
    message: "The commercial terms conflict.",
    ...rest,
  });

  it("starts open and holds the steps it lists", async () => {
    const { id: caseId } = await insertCase();
    const [created] = await db
      .insert(schema.caseFlag)
      .values(flag(caseId, "FL-02", { blocks: ["STEP-033", "STEP-035"] }))
      .returning();
    expect(created).toMatchObject({ status: "open", blocks: ["STEP-033", "STEP-035"], waivedAt: null, resolvedAt: null });
  });

  it("allows one active flag per rule on a case, but a new one after the last resolved", async () => {
    const { id: caseId } = await insertCase();
    const [first] = await db.insert(schema.caseFlag).values(flag(caseId)).returning();
    await expect(db.insert(schema.caseFlag).values(flag(caseId))).rejects.toMatchObject({
      cause: { code: "23505", constraint: "case_flag_active_uidx" },
    });
    // Another rule is fine, and so is the same rule on another case.
    await db.insert(schema.caseFlag).values(flag(caseId, "FL-04"));
    const other = await insertCase();
    await db.insert(schema.caseFlag).values(flag(other.id));

    await db
      .update(schema.caseFlag)
      .set({ status: "resolved", resolvedAt: new Date() })
      .where(eq(schema.caseFlag.id, first!.id));
    await db.insert(schema.caseFlag).values(flag(caseId));
    const all = await db.select().from(schema.caseFlag).where(eq(schema.caseFlag.caseId, caseId));
    expect(all.filter((f) => f.rule === "FL-02").map((f) => f.status).sort()).toEqual(["open", "resolved"]);
  });

  it("counts a waived flag as active", async () => {
    const { id: caseId } = await insertCase();
    await db
      .insert(schema.caseFlag)
      .values(flag(caseId, "FL-02", { status: "waived", waivedAt: new Date(), waiveReason: "Buyer confirmed in writing" }));
    await expect(db.insert(schema.caseFlag).values(flag(caseId))).rejects.toMatchObject({ cause: { code: "23505" } });
  });

  it("refuses a waiver without a reason, and a resolved flag without a resolution time", async () => {
    const { id: caseId } = await insertCase();
    await expect(
      db.insert(schema.caseFlag).values(flag(caseId, "FL-02", { status: "waived", waivedAt: new Date() })),
    ).rejects.toMatchObject({ cause: { code: "23514", constraint: "case_flag_waiver_check" } });
    await expect(
      db.insert(schema.caseFlag).values(flag(caseId, "FL-02", { status: "resolved" })),
    ).rejects.toMatchObject({ cause: { code: "23514", constraint: "case_flag_resolved_check" } });
    await expect(
      db.insert(schema.caseFlag).values(flag(caseId, "FL-02", { resolvedAt: new Date() })),
    ).rejects.toMatchObject({ cause: { code: "23514", constraint: "case_flag_resolved_check" } });
  });

  it("is removed with its case", async () => {
    const { id: caseId } = await insertCase();
    await db.insert(schema.caseFlag).values(flag(caseId));
    await db.delete(schema.exportCase).where(eq(schema.exportCase.id, caseId));
    expect(await db.select().from(schema.caseFlag).where(eq(schema.caseFlag.caseId, caseId))).toEqual([]);
  });
});

describe("sales contract prices", () => {
  const contract = (rest: Partial<typeof schema.salesContract.$inferInsert> = {}) => ({
    organizationId: ORG,
    number: "PO-1",
    buyerName: "Buyer GmbH",
    contractDate: "2026-10-22",
    ...rest,
  });

  it("holds a contract with no price, or with all three parts of one", async () => {
    await db.insert(schema.salesContract).values(contract());
    const [priced] = await db
      .insert(schema.salesContract)
      .values(contract({ unitPrice: "6.61", priceCurrency: "USD", priceUnit: "kg", coffeeType: "washed", grade: "1", origin: "Yirgacheffe" }))
      .returning();
    expect(priced).toMatchObject({ unitPrice: "6.6100", priceCurrency: "USD", priceUnit: "kg", coffeeType: "washed", grade: "1" });
  });

  it("refuses a price that is missing its currency or unit, or isn't above zero", async () => {
    const refused = { cause: { code: "23514", constraint: "sales_contract_unit_price_check" } };
    await expect(db.insert(schema.salesContract).values(contract({ unitPrice: "6.61" }))).rejects.toMatchObject(refused);
    await expect(db.insert(schema.salesContract).values(contract({ priceCurrency: "USD", priceUnit: "kg" }))).rejects.toMatchObject(refused);
    await expect(
      db.insert(schema.salesContract).values(contract({ unitPrice: "0", priceCurrency: "USD", priceUnit: "kg" })),
    ).rejects.toMatchObject(refused);
  });
});

describe("minimum export prices", () => {
  const table = async () => {
    const [created] = await db.insert(schema.minimumPriceTable).values({ source: "manual", label: `${ORG} table` }).returning();
    return created!;
  };
  const price = (tableId: string, rest: Partial<typeof schema.minimumPrice.$inferInsert> = {}) => ({
    tableId,
    effectiveFrom: "2026-10-20",
    effectiveTo: "2026-10-26",
    coffeeType: "washed" as const,
    grade: "1",
    currency: "USD",
    unit: "kg" as const,
    minPrice: "6.61",
    ...rest,
  });

  it("keeps a table's prices, with the origin left empty for every origin", async () => {
    const { id } = await table();
    const rows = await db.insert(schema.minimumPrice).values([price(id), price(id, { grade: "2", origin: "Yirgacheffe", minPrice: "6.2500" })]).returning();
    expect(rows).toMatchObject([{ origin: null, minPrice: "6.6100" }, { origin: "Yirgacheffe", minPrice: "6.2500" }]);
  });

  it("refuses an end date before the start date, and a price that isn't above zero", async () => {
    const { id } = await table();
    await expect(db.insert(schema.minimumPrice).values(price(id, { effectiveTo: "2026-10-19" }))).rejects.toMatchObject({
      cause: { code: "23514", constraint: "minimum_price_dates_check" },
    });
    await expect(db.insert(schema.minimumPrice).values(price(id, { minPrice: "0" }))).rejects.toMatchObject({
      cause: { code: "23514", constraint: "minimum_price_amount_check" },
    });
    // A one-day price is fine: both ends are included.
    await db.insert(schema.minimumPrice).values(price(id, { effectiveTo: "2026-10-20" }));
  });

  it("removes a table's prices with it", async () => {
    const { id } = await table();
    await db.insert(schema.minimumPrice).values(price(id));
    await db.delete(schema.minimumPriceTable).where(eq(schema.minimumPriceTable.id, id));
    expect(await db.select().from(schema.minimumPrice).where(eq(schema.minimumPrice.tableId, id))).toEqual([]);
  });
});

describe("document fields", () => {
  const field = (caseId: string, rest: Partial<typeof schema.documentField.$inferInsert> = {}) => ({
    caseId,
    document: "final_commercial_invoice",
    field: "quantity",
    value: "19200 kg",
    ...rest,
  });

  it("keeps one value per case, document and field, and the same field on another document", async () => {
    const { id: caseId } = await insertCase();
    await db.insert(schema.documentField).values(field(caseId));
    await expect(db.insert(schema.documentField).values(field(caseId, { value: "19300 kg" }))).rejects.toMatchObject({
      cause: { code: "23505", constraint: "document_field_case_uidx" },
    });
    await db.insert(schema.documentField).values([field(caseId, { document: "final_packing_list" }), field(caseId, { field: "netWeight" })]);
    const other = await insertCase();
    await db.insert(schema.documentField).values(field(other.id));
    expect(await db.select().from(schema.documentField).where(eq(schema.documentField.caseId, caseId))).toHaveLength(3);
  });

  it("refuses a blank value", async () => {
    const { id: caseId } = await insertCase();
    await expect(db.insert(schema.documentField).values(field(caseId, { value: "  " }))).rejects.toMatchObject({
      cause: { code: "23514", constraint: "document_field_value_check" },
    });
  });

  it("is removed with its case", async () => {
    const { id: caseId } = await insertCase();
    await db.insert(schema.documentField).values(field(caseId));
    await db.delete(schema.exportCase).where(eq(schema.exportCase.id, caseId));
    expect(await db.select().from(schema.documentField).where(eq(schema.documentField.caseId, caseId))).toEqual([]);
  });
});

describe("case amendments", () => {
  const amendment = (caseId: string, rest: Partial<typeof schema.caseAmendment.$inferInsert> = {}) => ({
    caseId,
    version: 2,
    reason: "The buyer changed the payment instrument",
    changes: [{ field: "paymentTerms" as const, label: "Payment terms", before: ["cad"], after: ["lc"] }],
    impact: { affected: ["STEP-025" as const], reopened: ["STEP-025" as const], reverify: ["STEP-025" as const], evidence: [], unlocked: [] },
    ...rest,
  });

  it("keeps each version of a case once, with what changed and what it set back", async () => {
    const { id: caseId } = await insertCase();
    const [first] = await db.insert(schema.caseAmendment).values(amendment(caseId)).returning();
    expect(first).toMatchObject({ version: 2, resolvedAt: null, changes: [{ field: "paymentTerms", before: ["cad"], after: ["lc"] }] });
    await expect(db.insert(schema.caseAmendment).values(amendment(caseId))).rejects.toMatchObject({
      cause: { code: "23505", constraint: "case_amendment_version_uidx" },
    });
    await db.insert(schema.caseAmendment).values(amendment(caseId, { version: 3 }));
    const other = await insertCase();
    await db.insert(schema.caseAmendment).values(amendment(other.id));
    expect(await db.select().from(schema.caseAmendment).where(eq(schema.caseAmendment.caseId, caseId))).toHaveLength(2);
  });

  it("starts at version 2, because version 1 is the case as it was first recorded, and needs a reason", async () => {
    const { id: caseId } = await insertCase();
    await expect(db.insert(schema.caseAmendment).values(amendment(caseId, { version: 1 }))).rejects.toMatchObject({
      cause: { code: "23514", constraint: "case_amendment_version_check" },
    });
    await expect(db.insert(schema.caseAmendment).values(amendment(caseId, { reason: "  " }))).rejects.toMatchObject({
      cause: { code: "23514", constraint: "case_amendment_reason_check" },
    });
  });

  it("is removed with its case", async () => {
    const { id: caseId } = await insertCase();
    await db.insert(schema.caseAmendment).values(amendment(caseId));
    await db.delete(schema.exportCase).where(eq(schema.exportCase.id, caseId));
    expect(await db.select().from(schema.caseAmendment).where(eq(schema.caseAmendment.caseId, caseId))).toEqual([]);
  });
});
