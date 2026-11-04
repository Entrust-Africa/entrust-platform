import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { schema } from "@entrust/db";
import type { Executor } from "./db";
import { ServiceError } from "./errors";

const CORPORATE_SUFFIXES = [
  "private limited company",
  "share company",
  "p l c",
  "plc",
  "s c",
  "sc",
  "llc",
  "l t d",
  "ltd",
  "limited",
  "corp",
  "corporation",
  "inc",
  "incorporated",
];

// Regex matching suffixes as whole words / trailing parts.
const SUFFIX_REGEX = new RegExp(
  `\\b(${CORPORATE_SUFFIXES.map((s) => s.replace(/\s+/g, "\\s+")).join("|")})\\b`,
  "gi",
);

/**
 * Normalises an organisation's legal name by ignoring case, punctuation,
 * and common corporate suffixes such as PLC, S.C., Share Company, and Private Limited Company.
 */
export function normalizeLegalName(name: string): string {
  if (!name) return "";
  let normalized = name.toLowerCase();

  // Replace punctuation characters with space
  normalized = normalized.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()'"\[\]]/g, " ");

  // Remove corporate suffixes
  normalized = normalized.replace(SUFFIX_REGEX, " ");

  // Collapse consecutive whitespaces and trim
  return normalized.replace(/\s+/g, " ").trim();
}

export interface CheckDuplicatesInput {
  legalName: string;
  registrationNumber?: string | null | undefined;
  country: string;
  excludeOrganizationId?: string | undefined;
}

export interface DuplicateCheckResult {
  registrationNumberConflict?: {
    registrationNumber: string;
    country: string;
    existingSmeId: string;
    existingLegalName: string;
  };
  legalNameWarning?: {
    smeId: string;
    legalName: string;
    organizationId: string;
  };
}

/**
 * Checks for registration number conflict (same registration number in same country)
 * and normalised legal name similarity warning.
 */
export async function checkSmeDuplicates(
  db: Executor,
  input: CheckDuplicatesInput,
): Promise<DuplicateCheckResult> {
  const result: DuplicateCheckResult = {};

  // 1. Exact registration number check in the same country
  if (input.registrationNumber && input.registrationNumber.trim()) {
    const regNum = input.registrationNumber.trim();
    const existing = await db
      .select({
        id: schema.smeProfile.id,
        smeId: schema.smeProfile.smeId,
        legalName: schema.smeProfile.legalName,
        organizationId: schema.smeProfile.organizationId,
      })
      .from(schema.smeProfile)
      .where(
        and(
          eq(schema.smeProfile.country, input.country),
          eq(schema.smeProfile.registrationNumber, regNum),
          input.excludeOrganizationId
            ? sql`${schema.smeProfile.organizationId} != ${input.excludeOrganizationId}`
            : sql`true`,
        ),
      )
      .limit(1);

    if (existing[0]) {
      result.registrationNumberConflict = {
        registrationNumber: regNum,
        country: input.country,
        existingSmeId: existing[0].smeId,
        existingLegalName: existing[0].legalName,
      };
      return result;
    }
  }

  // 2. Normalised legal name collision check
  const targetNorm = normalizeLegalName(input.legalName);
  if (targetNorm) {
    const activeProfiles = await db
      .select({
        id: schema.smeProfile.id,
        smeId: schema.smeProfile.smeId,
        legalName: schema.smeProfile.legalName,
        organizationId: schema.smeProfile.organizationId,
      })
      .from(schema.smeProfile)
      .where(
        and(
          eq(schema.smeProfile.country, input.country),
          sql`${schema.smeProfile.mergedIntoSmeId} is null`,
          input.excludeOrganizationId
            ? sql`${schema.smeProfile.organizationId} != ${input.excludeOrganizationId}`
            : sql`true`,
        ),
      );

    for (const profile of activeProfiles) {
      if (normalizeLegalName(profile.legalName) === targetNorm) {
        result.legalNameWarning = {
          smeId: profile.smeId,
          legalName: profile.legalName,
          organizationId: profile.organizationId,
        };
        break;
      }
    }
  }

  return result;
}

export interface SmeSearchResult {
  id: string;
  organizationId: string;
  organizationName: string;
  smeId: string;
  legalName: string;
  tradingName: string | null;
  registrationNumber: string | null;
  registrationStatus: string;
  businessStatus: string;
  sector: string | null;
  tin: string | null;
  country: string;
  mergedIntoSmeId: string | null;
  isMerged: boolean;
  createdAt: Date;
}

/**
 * Searches the SME registry by name, trading name, SME ID, TIN, or registration number.
 */
export async function searchSmes(
  db: Executor,
  query: string,
  limit = 20,
): Promise<SmeSearchResult[]> {
  const q = query.trim();
  if (!q) return [];
  const pattern = `%${q}%`;

  const rows = await db
    .select({
      id: schema.smeProfile.id,
      organizationId: schema.smeProfile.organizationId,
      organizationName: schema.organization.name,
      smeId: schema.smeProfile.smeId,
      legalName: schema.smeProfile.legalName,
      tradingName: schema.smeProfile.tradingName,
      registrationNumber: schema.smeProfile.registrationNumber,
      registrationStatus: schema.smeProfile.registrationStatus,
      businessStatus: schema.smeProfile.businessStatus,
      sector: schema.smeProfile.sector,
      tin: schema.smeProfile.tin,
      country: schema.smeProfile.country,
      mergedIntoSmeId: schema.smeProfile.mergedIntoSmeId,
      createdAt: schema.smeProfile.createdAt,
    })
    .from(schema.smeProfile)
    .innerJoin(
      schema.organization,
      eq(schema.organization.id, schema.smeProfile.organizationId),
    )
    .where(
      or(
        ilike(schema.smeProfile.smeId, pattern),
        ilike(schema.smeProfile.legalName, pattern),
        ilike(schema.smeProfile.tradingName, pattern),
        ilike(schema.smeProfile.tin, pattern),
        ilike(schema.smeProfile.registrationNumber, pattern),
        ilike(schema.organization.name, pattern),
      ),
    )
    .orderBy(desc(schema.smeProfile.createdAt))
    .limit(Math.min(Math.max(limit, 1), 50));

  return rows.map((r) => ({
    ...r,
    isMerged: r.mergedIntoSmeId !== null,
  }));
}

/**
 * Merges a duplicate SME into a surviving target SME.
 * Merging is allowed only while the duplicate has no CLEAR cases and no TRADE enrolments.
 */
export async function mergeSme(
  db: Executor,
  actorUserId: string,
  duplicateSmeId: string,
  targetSmeId: string,
  reason: string,
): Promise<{ ok: boolean; duplicateSmeId: string; targetSmeId: string }> {
  if (duplicateSmeId === targetSmeId) {
    throw new ServiceError("invalid", "Cannot merge an SME into itself.");
  }
  if (!reason || !reason.trim()) {
    throw new ServiceError("invalid", "A reason is required to merge an SME.");
  }

  // 1. Fetch duplicate
  const [duplicate] = await db
    .select()
    .from(schema.smeProfile)
    .where(eq(schema.smeProfile.smeId, duplicateSmeId));
  if (!duplicate) {
    throw new ServiceError("not_found", `SME '${duplicateSmeId}' not found.`);
  }
  if (duplicate.mergedIntoSmeId) {
    throw new ServiceError(
      "invalid",
      `SME '${duplicateSmeId}' has already been merged into '${duplicate.mergedIntoSmeId}'.`,
    );
  }

  // 2. Fetch target
  const [target] = await db
    .select()
    .from(schema.smeProfile)
    .where(eq(schema.smeProfile.smeId, targetSmeId));
  if (!target) {
    throw new ServiceError("not_found", `Target SME '${targetSmeId}' not found.`);
  }
  if (target.mergedIntoSmeId) {
    throw new ServiceError(
      "invalid",
      `Cannot merge into '${targetSmeId}' because it was merged into '${target.mergedIntoSmeId}'.`,
    );
  }

  // 3. Verify duplicate has no CLEAR cases
  const [caseCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.exportCase)
    .where(eq(schema.exportCase.organizationId, duplicate.organizationId));
  if ((caseCount?.count ?? 0) > 0) {
    throw new ServiceError(
      "invalid",
      "Cannot merge an SME that has existing CLEAR export cases.",
    );
  }

  // 4. Verify duplicate has no TRADE enrolments
  const [enrollmentCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.enrollment)
    .where(eq(schema.enrollment.organizationId, duplicate.organizationId));
  if ((enrollmentCount?.count ?? 0) > 0) {
    throw new ServiceError(
      "invalid",
      "Cannot merge an SME that has existing TRADE enrolments.",
    );
  }

  // 5. Execute merge
  await db
    .update(schema.smeProfile)
    .set({
      mergedIntoSmeId: targetSmeId,
      businessStatus: "closed",
      updatedAt: new Date(),
    })
    .where(eq(schema.smeProfile.smeId, duplicateSmeId));

  await db.insert(schema.auditLog).values({
    actorUserId,
    organizationId: duplicate.organizationId,
    action: "sme_profile.merged",
    entityType: "sme_profile",
    entityId: duplicate.id,
    before: {
      mergedIntoSmeId: null,
      businessStatus: duplicate.businessStatus,
    },
    after: {
      mergedIntoSmeId: targetSmeId,
      targetSmeId,
      businessStatus: "closed",
    },
    reason: reason.trim(),
  });

  return { ok: true, duplicateSmeId, targetSmeId };
}
