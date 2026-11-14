import { asc, eq, sql } from "drizzle-orm";
import { schema } from "@entrust/db";
import { employeeRange, isPassportId, normalisePassportId, passportStanding, type PassportStanding } from "@entrust/trade-engine";
import { requireStaff, type Ctx } from "./access";
import type { Executor } from "./db";
import { ServiceError } from "./errors";
import { recordTradeChange } from "./trade-shared";

// The Entrust Africa Verified SME Passport. A business is verified by Entrust staff, who then publish a passport: a page anyone
// can open from the QR code on the printed passport. The public page is built from the passport row only, so nothing from the
// diagnostic, the scores or the finances can reach it. A passport can start from a business on the platform or from an application
// in the SME register (a business can have a passport before it has an account). What those hold is only a suggestion shown to staff:
// the public page shows whatever staff confirm.

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
  logoUrl: string | null;
  country: string;
  sector: string | null;
  established: number | null;
  employeesRange: string | null;
  ownership: string | null;
  founder: string | null;
  headline: string | null;
  overview: string | null;
  products: { name: string; detail: string | null; code: string | null; africonnectUrl: string | null }[];
  womenInTrade: string[];
  targetMarkets: Row["targetMarkets"];
  seeking: string | null;
  checks: string[];
  website: string | null;
  email: string | null;
  phones: string[];
  address: string | null;
  africonnectUrl: string | null;
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
  logoUrl: row.logoUrl,
  country: row.country,
  sector: row.sector,
  established: row.established,
  employeesRange: row.employeesRange,
  ownership: row.ownership,
  founder: row.founder,
  headline: row.headline,
  overview: row.overview,
  // Passports saved before products could link to AfriConnect have no link.
  products: row.products.map((p) => ({ name: p.name, detail: p.detail, code: p.code, africonnectUrl: p.africonnectUrl ?? null })),
  womenInTrade: row.womenInTrade,
  targetMarkets: row.targetMarkets,
  seeking: row.seeking,
  checks: row.checks,
  website: row.website,
  email: row.email,
  phones: row.phones,
  address: row.address,
  africonnectUrl: row.africonnectUrl,
});

// ---- What anyone who scans the code sees ----

export interface PublicPassport {
  passportId: string;
  standing: PassportStanding;
  displayName: string;
  tier: Row["tier"];
  verifiedOn: string;
  validUntil: string;
  /**
   * Left out for a suspended or revoked passport: the page says only that it is no longer valid. Never holds the business's
   * website, email, telephone numbers or address: buyers are sent to the business's store on AfriConnect instead.
   */
  details: Omit<PassportContent, PrivateLine | "passportId" | "tier" | "status" | "statusReason" | "verifiedOn" | "validUntil" | "displayName"> | null;
}

/** The contact lines staff keep on a passport. They stay off the public page so buyers deal with the business through AfriConnect. */
type PrivateLine = "website" | "email" | "phones" | "address";

export async function publicPassport(db: Executor, input: string, now: Date = new Date()): Promise<PublicPassport> {
  const passportId = normalisePassportId(input);
  const [row] = await db.select().from(schema.smePassport).where(eq(schema.smePassport.passportId, passportId));
  if (!row) throw new ServiceError("not_found", `No passport ${passportId} was found.`);
  const standing = passportStanding(row.status, row.validUntil, now);
  const {
    passportId: _id,
    tier: _tier,
    status: _status,
    statusReason: _reason,
    verifiedOn: _v,
    validUntil: _u,
    displayName: _n,
    website: _w,
    email: _e,
    phones: _p,
    address: _a,
    ...details
  } = contentOf(row);
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

type Suggestion = Pick<PassportContent, "displayName" | "country" | "sector" | "established" | "employeesRange" | "ownership" | "founder" | "website" | "email" | "phones" | "address">;

const text = (value: unknown): string | null => (typeof value === "string" && value.trim() ? value.trim() : null);
/** An application's "1-10" is written "1–10" on the passport, as the ranges from the headcount are. */
const tidyRange = (value: string | null): string | null => (value ? value.replace(/\s*-\s*/g, "–") : null);

export interface PassportSource {
  kind: "business" | "application";
  label: string;
  smeId: string | null;
  organizationId: string | null;
  applicationId: string | null;
}

export interface PassportPrefill {
  source: PassportSource;
  /** The passport already made from this source, if there is one: open it instead of starting another. */
  existingPassportId: string | null;
  /** What is held about the business, to start a passport from. Nothing here is public until staff save it. */
  suggestion: Suggestion;
}

async function businessBySmeId(db: Executor, smeId: string) {
  const [profile] = await db.select().from(schema.smeProfile).where(sql`upper(${schema.smeProfile.smeId}) = ${smeId.trim().toUpperCase()}`);
  if (!profile) throw new ServiceError("not_found", "No business has that SME ID.");
  return profile;
}

/** Only responses from Ethiopia are ever read, as everywhere else in the register. */
async function applicationById(db: Executor, applicationId: string) {
  const [row] = await db.select().from(schema.programApplication).where(eq(schema.programApplication.id, applicationId));
  if (!row || row.country !== "ET") throw new ServiceError("not_found", "That application isn't in the register.");
  return row;
}

/** What the platform holds for a business or a register application, and the passport already made from it. Admins and facilitators. */
export async function passportPrefill(ctx: Ctx, from: { smeId?: string | undefined; applicationId?: string | undefined }): Promise<PassportPrefill> {
  requireStaff(ctx.principal, ["admin", "facilitator"], "see a business's passport");
  if (from.smeId) {
    const profile = await businessBySmeId(ctx.db, from.smeId);
    const [existing] = await ctx.db.select({ passportId: schema.smePassport.passportId }).from(schema.smePassport).where(eq(schema.smePassport.organizationId, profile.organizationId));
    return {
      source: { kind: "business", label: profile.legalName, smeId: profile.smeId, organizationId: profile.organizationId, applicationId: null },
      existingPassportId: existing?.passportId ?? null,
      suggestion: {
        displayName: profile.tradingName ?? profile.legalName,
        country: profile.country,
        sector: profile.sector,
        established: profile.yearEstablished,
        employeesRange: employeeRange(profile.permanentEmployees, profile.temporaryEmployees),
        ownership: profile.womanOwned ? "Woman-owned" : null,
        founder: null,
        website: profile.website,
        email: profile.businessEmail,
        phones: profile.businessPhone ? [profile.businessPhone] : [],
        address: profile.address,
      },
    };
  }
  if (from.applicationId) {
    const app = await applicationById(ctx.db, from.applicationId);
    const [existing] = await ctx.db.select({ passportId: schema.smePassport.passportId }).from(schema.smePassport).where(eq(schema.smePassport.applicationId, app.id));
    const a = app.answers as Record<string, unknown>;
    const year = Number(a.yearEstablished);
    return {
      source: { kind: "application", label: app.businessName, smeId: null, organizationId: null, applicationId: app.id },
      existingPassportId: existing?.passportId ?? null,
      suggestion: {
        displayName: app.businessName,
        country: app.country ?? "ET",
        sector: text(a.category),
        established: Number.isInteger(year) && year > 1800 ? year : null,
        employeesRange: tidyRange(text(a.employees)),
        ownership: text(a.ownership),
        founder: app.contactName,
        website: text(a.website),
        email: text(a.contactEmail) ?? app.email,
        phones: app.phone ? [app.phone] : [],
        address: app.location,
      },
    };
  }
  throw new ServiceError("invalid", "Say which business: an SME ID or an application.");
}

export interface PassportEditorView {
  passport: PassportContent;
  source: PassportSource | null;
}

/** One passport as staff see it, with what it was made from. */
export async function passportForStaff(ctx: Ctx, input: string): Promise<PassportEditorView> {
  requireStaff(ctx.principal, ["admin", "facilitator"], "see a passport");
  const [row] = await ctx.db.select().from(schema.smePassport).where(eq(schema.smePassport.passportId, normalisePassportId(input)));
  if (!row) throw new ServiceError("not_found", "No passport has that number.");
  return { passport: contentOf(row), source: await sourceOf(ctx.db, row) };
}

async function sourceOf(db: Executor, row: Row): Promise<PassportSource | null> {
  if (row.organizationId) {
    const [profile] = await db.select().from(schema.smeProfile).where(eq(schema.smeProfile.organizationId, row.organizationId));
    if (profile) return { kind: "business", label: profile.legalName, smeId: profile.smeId, organizationId: profile.organizationId, applicationId: null };
  }
  if (row.applicationId) {
    const [app] = await db.select({ name: schema.programApplication.businessName }).from(schema.programApplication).where(eq(schema.programApplication.id, row.applicationId));
    if (app) return { kind: "application", label: app.name, smeId: null, organizationId: null, applicationId: row.applicationId };
  }
  return null;
}

export interface PassportListItem {
  passportId: string;
  displayName: string;
  tier: Row["tier"];
  standing: PassportStanding;
  verifiedOn: string;
  validUntil: string;
}

export async function listPassports(ctx: Ctx): Promise<{ items: PassportListItem[] }> {
  requireStaff(ctx.principal, ["admin", "facilitator"], "see the passports");
  const rows = await ctx.db.select().from(schema.smePassport).orderBy(asc(schema.smePassport.passportId));
  return {
    items: rows.map((passport) => ({
      passportId: passport.passportId,
      displayName: passport.displayName,
      tier: passport.tier,
      standing: passportStanding(passport.status, passport.validUntil, ctx.now),
      verifiedOn: passport.verifiedOn,
      validUntil: passport.validUntil,
    })),
  };
}

export type PassportInput = Omit<PassportContent, "passportId"> & { smeId?: string | undefined; applicationId?: string | undefined };

/**
 * Issues or updates the passport with this number. Only an administrator does this: it is a public statement that Entrust checked
 * the business. A new passport can say which business or application it was made from (`smeId` or `applicationId`); that link is kept
 * and can't be moved to another passport. The number never changes. Every save is written to the audit log.
 */
export async function savePassport(ctx: Ctx, number: string, input: PassportInput): Promise<PassportContent> {
  requireStaff(ctx.principal, ["admin"], "issue or change a passport");
  const passportId = normalisePassportId(number);
  if (!isPassportId(passportId)) throw new ServiceError("invalid", "A passport number looks like EA-ETH-0002.");
  if (input.validUntil < input.verifiedOn) throw new ServiceError("invalid", "The passport can't end before it was verified.");
  if (input.status !== "active" && !input.statusReason?.trim()) throw new ServiceError("invalid", "Say why the passport is suspended or revoked.");
  if (input.smeId && input.applicationId) throw new ServiceError("invalid", "A passport comes from a business or an application, not both.");

  return ctx.db.transaction(async (tx) => {
    const [existing] = await tx.select().from(schema.smePassport).where(eq(schema.smePassport.passportId, passportId));
    const { smeId, applicationId, ...fields } = input;
    const values = { ...fields, statusReason: input.status === "active" ? null : (input.statusReason?.trim() ?? null) };

    // A number belongs to one business: saving it again with a different business or application is a mistake, not an update.
    if (existing && smeId && existing.organizationId !== (await businessBySmeId(tx, smeId)).organizationId) throw new ServiceError("conflict", `${passportId} is already issued to another business.`);
    if (existing && applicationId && existing.applicationId !== applicationId) throw new ServiceError("conflict", `${passportId} is already issued to another business.`);

    const link: { organizationId?: string; applicationId?: string } = {};
    if (!existing && smeId) {
      const profile = await businessBySmeId(tx, smeId);
      const [taken] = await tx.select({ passportId: schema.smePassport.passportId }).from(schema.smePassport).where(eq(schema.smePassport.organizationId, profile.organizationId));
      if (taken) throw new ServiceError("conflict", `That business already has passport ${taken.passportId}.`);
      link.organizationId = profile.organizationId;
    }
    if (!existing && applicationId) {
      const app = await applicationById(tx, applicationId);
      const [taken] = await tx.select({ passportId: schema.smePassport.passportId }).from(schema.smePassport).where(eq(schema.smePassport.applicationId, app.id));
      if (taken) throw new ServiceError("conflict", `That application already has passport ${taken.passportId}.`);
      link.applicationId = app.id;
    }

    const [saved] = existing
      ? await tx.update(schema.smePassport).set(values).where(eq(schema.smePassport.id, existing.id)).returning()
      : await tx.insert(schema.smePassport).values({ ...values, ...link, passportId, createdByUserId: ctx.principal.userId }).returning();
    await recordTradeChange(tx, ctx.principal.userId, {
      action: existing ? "trade.passport.updated" : "trade.passport.issued",
      entityType: "sme_passport",
      entityId: saved!.id,
      organizationId: saved!.organizationId,
      before: existing ? contentOf(existing) : null,
      after: contentOf(saved!),
    });
    return contentOf(saved!);
  });
}
