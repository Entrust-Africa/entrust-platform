import { asc, eq, sql } from "drizzle-orm";
import { schema } from "@entrust/db";
import { employeeRange, isPassportId, normalisePassportId, passportStanding, type PassportStanding } from "@entrust/trade-engine";
import { requireStaff, type Ctx } from "./access";
import type { Executor } from "./db";
import { ServiceError } from "./errors";
import { recordTradeChange } from "./trade-shared";

// The Entrust Africa Verified SME Passport. A business is verified by Entrust staff, who then publish a passport: a page anyone
// can open from the QR code on the printed passport. The public page is built from the passport row only, so nothing from the
// diagnostic, the scores or the finances can reach it. The diagnostic's headcount is only a suggestion shown to staff: the range on
// the public page is whatever staff confirm.

type Row = typeof schema.smePassport.$inferSelect;

export interface PassportContent {
  passportId: string;
  tier: Row["tier"];
  status: Row["status"];
  statusReason: string | null;
  verifiedOn: string;
  validUntil: string;
  displayName: string;
  tagline: string | null;
  country: string;
  sector: string | null;
  established: number | null;
  employeesRange: string | null;
  ownership: string | null;
  founder: string | null;
  headline: string | null;
  overview: string | null;
  products: Row["products"];
  womenInTrade: string[];
  targetMarkets: Row["targetMarkets"];
  seeking: string | null;
  checks: string[];
  website: string | null;
  email: string | null;
  phones: string[];
  address: string | null;
}

const contentOf = (row: Row): PassportContent => ({
  passportId: row.passportId,
  tier: row.tier,
  status: row.status,
  statusReason: row.statusReason,
  verifiedOn: row.verifiedOn,
  validUntil: row.validUntil,
  displayName: row.displayName,
  tagline: row.tagline,
  country: row.country,
  sector: row.sector,
  established: row.established,
  employeesRange: row.employeesRange,
  ownership: row.ownership,
  founder: row.founder,
  headline: row.headline,
  overview: row.overview,
  products: row.products,
  womenInTrade: row.womenInTrade,
  targetMarkets: row.targetMarkets,
  seeking: row.seeking,
  checks: row.checks,
  website: row.website,
  email: row.email,
  phones: row.phones,
  address: row.address,
});

// ---- What anyone who scans the code sees ----

export interface PublicPassport {
  passportId: string;
  standing: PassportStanding;
  displayName: string;
  tier: Row["tier"];
  verifiedOn: string;
  validUntil: string;
  /** Left out for a suspended or revoked passport: the page says only that it is no longer valid. */
  details: Omit<PassportContent, "passportId" | "tier" | "status" | "statusReason" | "verifiedOn" | "validUntil" | "displayName"> | null;
}

export async function publicPassport(db: Executor, input: string, now: Date = new Date()): Promise<PublicPassport> {
  const passportId = normalisePassportId(input);
  const [row] = await db.select().from(schema.smePassport).where(eq(schema.smePassport.passportId, passportId));
  if (!row) throw new ServiceError("not_found", `No passport ${passportId} was found.`);
  const standing = passportStanding(row.status, row.validUntil, now);
  const { passportId: _id, tier: _tier, status: _status, statusReason: _reason, verifiedOn: _v, validUntil: _u, displayName: _n, ...details } = contentOf(row);
  return {
    passportId: row.passportId,
    standing,
    displayName: row.displayName,
    tier: row.tier,
    verifiedOn: row.verifiedOn,
    validUntil: row.validUntil,
    details: standing === "active" || standing === "expired" ? details : null,
  };
}

// ---- Staff ----

async function profileBySmeId(db: Executor, smeId: string) {
  const [profile] = await db.select().from(schema.smeProfile).where(sql`upper(${schema.smeProfile.smeId}) = ${smeId.trim().toUpperCase()}`);
  if (!profile) throw new ServiceError("not_found", "No business has that SME ID.");
  return profile;
}

export interface PassportEditorView {
  business: { organizationId: string; smeId: string; legalName: string };
  passport: PassportContent | null;
  /** What the platform already knows about the business, to start a passport from. Nothing here is public until staff save it. */
  suggestion: Pick<PassportContent, "displayName" | "country" | "sector" | "established" | "employeesRange" | "ownership" | "website" | "email" | "phones" | "address">;
}

/** A business's passport (or none) and what the platform holds that could fill one in. Admins and facilitators. */
export async function passportForBusiness(ctx: Ctx, smeId: string): Promise<PassportEditorView> {
  requireStaff(ctx.principal, ["admin", "facilitator"], "see a business's passport");
  const profile = await profileBySmeId(ctx.db, smeId);
  const [row] = await ctx.db.select().from(schema.smePassport).where(eq(schema.smePassport.organizationId, profile.organizationId));
  return {
    business: { organizationId: profile.organizationId, smeId: profile.smeId, legalName: profile.legalName },
    passport: row ? contentOf(row) : null,
    suggestion: {
      displayName: profile.tradingName ?? profile.legalName,
      country: profile.country,
      sector: profile.sector,
      established: profile.yearEstablished,
      employeesRange: employeeRange(profile.permanentEmployees, profile.temporaryEmployees),
      ownership: profile.womanOwned ? "Woman-owned" : null,
      website: profile.website,
      email: profile.businessEmail,
      phones: profile.businessPhone ? [profile.businessPhone] : [],
      address: profile.address,
    },
  };
}

export interface PassportListItem {
  passportId: string;
  smeId: string;
  displayName: string;
  tier: Row["tier"];
  standing: PassportStanding;
  verifiedOn: string;
  validUntil: string;
}

export async function listPassports(ctx: Ctx): Promise<{ items: PassportListItem[] }> {
  requireStaff(ctx.principal, ["admin", "facilitator"], "see the passports");
  const rows = await ctx.db
    .select({ passport: schema.smePassport, smeId: schema.smeProfile.smeId })
    .from(schema.smePassport)
    .innerJoin(schema.smeProfile, eq(schema.smeProfile.organizationId, schema.smePassport.organizationId))
    .orderBy(asc(schema.smePassport.passportId));
  return {
    items: rows.map(({ passport, smeId }) => ({
      passportId: passport.passportId,
      smeId,
      displayName: passport.displayName,
      tier: passport.tier,
      standing: passportStanding(passport.status, passport.validUntil, ctx.now),
      verifiedOn: passport.verifiedOn,
      validUntil: passport.validUntil,
    })),
  };
}

export type PassportInput = Omit<PassportContent, "passportId"> & { passportId?: string | undefined };

/**
 * Issues or updates a business's passport. Only an administrator does this: it is a public statement that Entrust checked the
 * business. The passport number is given when it is first issued and never changes. Every save is written to the audit log.
 */
export async function savePassport(ctx: Ctx, smeId: string, input: PassportInput): Promise<PassportContent> {
  requireStaff(ctx.principal, ["admin"], "issue or change a passport");
  const profile = await profileBySmeId(ctx.db, smeId);
  if (input.validUntil < input.verifiedOn) throw new ServiceError("invalid", "The passport can't end before it was verified.");
  if (input.status !== "active" && !input.statusReason?.trim()) throw new ServiceError("invalid", "Say why the passport is suspended or revoked.");

  return ctx.db.transaction(async (tx) => {
    const [existing] = await tx.select().from(schema.smePassport).where(eq(schema.smePassport.organizationId, profile.organizationId));
    let passportId: string;
    if (existing) {
      passportId = existing.passportId;
      if (input.passportId && normalisePassportId(input.passportId) !== passportId) throw new ServiceError("invalid", "A passport's number can't be changed.");
    } else {
      if (!input.passportId || !isPassportId(input.passportId)) throw new ServiceError("invalid", "Give the passport number, such as EA-ETH-0002.");
      passportId = normalisePassportId(input.passportId);
      const [taken] = await tx.select({ id: schema.smePassport.id }).from(schema.smePassport).where(eq(schema.smePassport.passportId, passportId));
      if (taken) throw new ServiceError("conflict", `${passportId} is already issued to another business.`);
    }
    const { passportId: _ignored, ...fields } = input;
    const values = { ...fields, statusReason: input.status === "active" ? null : (input.statusReason?.trim() ?? null) };
    const [saved] = existing
      ? await tx.update(schema.smePassport).set(values).where(eq(schema.smePassport.id, existing.id)).returning()
      : await tx.insert(schema.smePassport).values({ ...values, passportId, organizationId: profile.organizationId, createdByUserId: ctx.principal.userId }).returning();
    await recordTradeChange(tx, ctx.principal.userId, {
      action: existing ? "trade.passport.updated" : "trade.passport.issued",
      entityType: "sme_passport",
      entityId: saved!.id,
      organizationId: profile.organizationId,
      before: existing ? contentOf(existing) : null,
      after: contentOf(saved!),
    });
    return contentOf(saved!);
  });
}
