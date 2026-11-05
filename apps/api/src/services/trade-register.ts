import { asc, desc, eq, inArray } from "drizzle-orm";
import { schema } from "@entrust/db";
import { deriveRegister, isApplicationResponses, readRegister, sameBusiness, summariseRegister, type RegisterInput } from "@entrust/trade-engine";
import type { RegisterDetailView, RegisterImportedView, RegisterListView } from "../schemas/trade";
import { requireStaff, type Ctx } from "./access";
import { ServiceError } from "./errors";
import { readUploadedWorkbook } from "./register-workbook";

// Entrust's register of pilot SMEs, from the diagnostic workbook. Staff only: a sponsor sees none of it. The workbook is
// where staff keep the data, so loading it again brings the register up to date: a business is matched on its SME ID,
// and one the new file leaves out is kept. A blank email or note in the file never wipes one already recorded.

const FIELDS = [
  "companyName", "participantName", "phone", "email", "yearEstablished", "location", "employees", "exportLicence", "currentBank",
  "mainProduct", "monthlyProductionCapacity", "averageMonthlyRevenue", "largestOrderCompleted", "currentMarkets", "targetExportMarket",
  "monthlyOperatingCost", "estimatedMonthlyProfit", "existingLoan", "loanAmount", "cashflowStability", "workingCapitalGap",
  "equipmentInvestmentNeeded", "exportLogisticsGap", "costingKnowledge", "productionCapacityStrength", "documentationKnowledge",
  "financialRecordKeeping", "marketReadiness", "entrustSupportNeeded", "bankOpportunity", "serviceNotes",
] as const satisfies readonly (keyof RegisterInput)[];

/** A stored row as the record it was loaded from. */
export const toInput = (row: typeof schema.smeRegister.$inferSelect): RegisterInput => ({
  code: row.code,
  ...Object.fromEntries(FIELDS.map((f) => [f, row[f]])),
} as RegisterInput);

/** Every business in the register, by SME ID, with what is worked out from each, and the totals across them. */
export async function listRegister(ctx: Ctx): Promise<RegisterListView> {
  requireStaff(ctx.principal, ["admin", "facilitator", "reviewer"], "see the SME register");
  const rows = await ctx.db.select().from(schema.smeRegister).orderBy(asc(schema.smeRegister.code));
  const records = rows.map((row) => deriveRegister(toInput(row)));
  return {
    items: records.map((record, i) => ({ ...record, id: rows[i]!.id, updatedAt: rows[i]!.updatedAt.toISOString() })),
    summary: summariseRegister(records),
  };
}

/**
 * One business in the register, with everything recorded about it. If it also applied to a programme (the same phone number or email
 * address), those responses are listed so staff can open them. Only responses from Ethiopia are ever looked at.
 */
export async function getRegisterRecord(ctx: Ctx, id: string): Promise<RegisterDetailView> {
  requireStaff(ctx.principal, ["admin", "facilitator", "reviewer"], "see the SME register");
  const [row] = await ctx.db.select().from(schema.smeRegister).where(eq(schema.smeRegister.id, id));
  if (!row) throw new ServiceError("not_found", "That business isn't in the register.");

  const applications = await ctx.db
    .select({ id: schema.programApplication.id, program: schema.programApplication.program, submittedAt: schema.programApplication.submittedAt, businessName: schema.programApplication.businessName, phone: schema.programApplication.phone, email: schema.programApplication.email })
    .from(schema.programApplication)
    .where(eq(schema.programApplication.country, "ET"))
    .orderBy(desc(schema.programApplication.submittedAt), desc(schema.programApplication.id));
  return {
    ...deriveRegister(toInput(row)),
    id: row.id,
    updatedAt: row.updatedAt.toISOString(),
    alsoApplied: applications
      .filter((a) => sameBusiness(a, row))
      .map((a) => ({ id: a.id, program: a.program, submittedAt: a.submittedAt.toISOString(), businessName: a.businessName })),
  };
}

/** Loads the diagnostic workbook into the register: new businesses are added, changed ones updated, the rest left as they are. */
export async function importRegister(ctx: Ctx, input: { fileName?: string | undefined; contentBase64: string }): Promise<RegisterImportedView> {
  requireStaff(ctx.principal, ["admin", "facilitator"], "load the SME register");
  const sheets = readUploadedWorkbook(input.contentBase64);
  if (isApplicationResponses(sheets)) {
    throw new ServiceError("invalid", "That is a form's responses, not the diagnostic workbook. Load it on the Applications tab.");
  }

  let read: ReturnType<typeof readRegister>;
  try {
    read = readRegister(sheets);
  } catch (error) {
    if (error instanceof ServiceError) throw error;
    throw new ServiceError("invalid", error instanceof Error ? error.message : "The workbook couldn't be read.");
  }
  const { records, warnings } = read;

  return ctx.db.transaction(async (tx) => {
    const existing = await tx.select().from(schema.smeRegister).where(inArray(schema.smeRegister.code, records.map((r) => r.code)));
    const byCode = new Map(existing.map((row) => [row.code, row]));
    let created = 0;
    let updated = 0;
    let unchanged = 0;
    for (const loaded of records) {
      const row = byCode.get(loaded.code);
      if (!row) {
        await tx.insert(schema.smeRegister).values(loaded);
        created += 1;
        continue;
      }
      // The email and notes come from a sheet the file may not have, so a blank there never wipes what is recorded.
      const record = { ...loaded, email: loaded.email ?? row.email, serviceNotes: loaded.serviceNotes ?? row.serviceNotes };
      if (FIELDS.some((f) => row[f] !== record[f])) {
        await tx.update(schema.smeRegister).set(record).where(inArray(schema.smeRegister.id, [row.id]));
        updated += 1;
      } else {
        unchanged += 1;
      }
    }
    await tx.insert(schema.auditLog).values({
      actorUserId: ctx.principal.userId,
      platform: "trade",
      action: "sme_register.import",
      entityType: "sme_register",
      entityId: crypto.randomUUID(),
      after: { fileName: input.fileName ?? null, total: records.length, created, updated, unchanged, warnings: warnings.length },
    });
    return { total: records.length, created, updated, unchanged, warnings };
  });
}
