import { and, asc, desc, eq, gt, lt, lte, ne } from "drizzle-orm";
import { schema } from "@entrust/db";
import type { PeriodView } from "../schemas/summit";
import { requireStaff, type Ctx } from "./access";
import type { Executor } from "./db";
import { ServiceError } from "./errors";
import { findApplicationTemplate, findSummitRules, latestApprovedRules, latestPublishedTemplate } from "./summit-forms";
import { recordSummitChange } from "./summit-status";

// Application periods (#79): when SMEs can apply, from which countries, and on which version of the form and the rules.
// A super administrator (Entrust admin) sets them.

export type PeriodRow = typeof schema.applicationPeriod.$inferSelect;

export const periodState = (row: Pick<PeriodRow, "opensAt" | "closesAt">, now: Date): PeriodView["state"] =>
  now < row.opensAt ? "upcoming" : now < row.closesAt ? "open" : "closed";

export const periodView = (row: PeriodRow, now: Date): PeriodView => ({
  id: row.id,
  name: row.name,
  opensAt: row.opensAt.toISOString(),
  closesAt: row.closesAt.toISOString(),
  countries: row.countries,
  templateVersion: row.templateVersion,
  rulesVersion: row.rulesVersion,
  state: periodState(row, now),
});

/** The period open now, if there is one. Periods don't overlap. */
export async function openPeriod(db: Executor, now: Date): Promise<PeriodRow | undefined> {
  const [row] = await db
    .select()
    .from(schema.applicationPeriod)
    .where(and(lte(schema.applicationPeriod.opensAt, now), gt(schema.applicationPeriod.closesAt, now)))
    .limit(1);
  return row;
}

/** What the public page shows: the period open now, otherwise the next to open, otherwise the one that closed last. */
export async function currentPeriod(ctx: Pick<Ctx, "db" | "now">): Promise<PeriodView | null> {
  const open = await openPeriod(ctx.db, ctx.now);
  if (open) return periodView(open, ctx.now);
  const [next] = await ctx.db
    .select()
    .from(schema.applicationPeriod)
    .where(gt(schema.applicationPeriod.opensAt, ctx.now))
    .orderBy(asc(schema.applicationPeriod.opensAt))
    .limit(1);
  if (next) return periodView(next, ctx.now);
  const [last] = await ctx.db.select().from(schema.applicationPeriod).orderBy(desc(schema.applicationPeriod.closesAt)).limit(1);
  return last ? periodView(last, ctx.now) : null;
}

export async function listPeriods(ctx: Ctx): Promise<PeriodView[]> {
  if (!ctx.principal.staffRole) throw new ServiceError("forbidden", "Only Entrust staff can list application periods.");
  const rows = await ctx.db.select().from(schema.applicationPeriod).orderBy(desc(schema.applicationPeriod.opensAt));
  return rows.map((row) => periodView(row, ctx.now));
}

const normaliseCountries = (countries: readonly string[]): string[] => {
  const codes = [...new Set(countries.map((c) => c.trim().toUpperCase()))];
  const bad = codes.find((c) => !/^[A-Z]{2}$/.test(c));
  if (bad) throw new ServiceError("invalid", `"${bad}" isn't a two-letter country code.`);
  return codes;
};

async function assertNoOverlap(db: Executor, window: { opensAt: Date; closesAt: Date }, exceptId?: string): Promise<void> {
  const [clash] = await db
    .select({ name: schema.applicationPeriod.name })
    .from(schema.applicationPeriod)
    .where(
      and(
        lt(schema.applicationPeriod.opensAt, window.closesAt),
        gt(schema.applicationPeriod.closesAt, window.opensAt),
        exceptId ? ne(schema.applicationPeriod.id, exceptId) : undefined,
      ),
    )
    .limit(1);
  if (clash) throw new ServiceError("invalid", `That window overlaps "${clash.name}". Application periods can't overlap.`);
}

export interface PeriodInput {
  name: string;
  opensAt: string;
  closesAt: string;
  countries: readonly string[];
  templateVersion?: string | undefined;
  rulesVersion?: string | undefined;
}

/**
 * Opens a period for applications. It names the version of the application form the applicants answer, which must
 * be published, and the version of the rules used to screen and score them, which must be approved. Until Entrust
 * confirms the questions and the form is published, no period can be created.
 */
export async function createPeriod(ctx: Ctx, input: PeriodInput): Promise<PeriodView> {
  requireStaff(ctx.principal, ["admin"], "set application periods");
  const opensAt = new Date(input.opensAt);
  const closesAt = new Date(input.closesAt);
  if (!(closesAt > opensAt)) throw new ServiceError("invalid", "The period has to close after it opens.");
  const countries = normaliseCountries(input.countries);

  const template = input.templateVersion ? findApplicationTemplate(input.templateVersion) : latestPublishedTemplate();
  if (!template) {
    throw new ServiceError(
      "precondition_failed",
      input.templateVersion
        ? `There is no application form version ${input.templateVersion}.`
        : "There is no published application form yet. Entrust has to confirm the questions before applications can open.",
    );
  }
  if (template.status !== "published") {
    throw new ServiceError("precondition_failed", `Application form ${template.version} is a draft. Applications open only on a published version.`);
  }
  const rules = input.rulesVersion ? findSummitRules(input.rulesVersion) : latestApprovedRules();
  if (!rules) throw new ServiceError("precondition_failed", input.rulesVersion ? `There are no rules version ${input.rulesVersion}.` : "There are no approved rules yet.");
  if (rules.status !== "approved") {
    throw new ServiceError("precondition_failed", `Rules ${rules.version} are a draft. Applications are screened and scored on an approved version.`);
  }

  return ctx.db.transaction(async (tx) => {
    await assertNoOverlap(tx, { opensAt, closesAt });
    const [row] = await tx
      .insert(schema.applicationPeriod)
      .values({
        name: input.name,
        opensAt,
        closesAt,
        countries,
        templateVersion: template.version,
        rulesVersion: rules.version,
        createdBy: ctx.principal.userId,
      })
      .returning();
    if (!row) throw new Error("The period was not created");
    await recordSummitChange(tx, ctx.principal.userId, {
      action: "summit.period.created",
      entityType: "summit_period",
      entityId: row.id,
      organizationId: null,
      after: periodView(row, ctx.now),
    });
    return periodView(row, ctx.now);
  });
}

export interface PeriodPatch {
  name?: string | undefined;
  opensAt?: string | undefined;
  closesAt?: string | undefined;
  countries?: readonly string[] | undefined;
}

/** Changes a period's name, window or countries. The form and rules versions stay, since applications already use them. */
export async function updatePeriod(ctx: Ctx, id: string, patch: PeriodPatch): Promise<PeriodView> {
  requireStaff(ctx.principal, ["admin"], "change application periods");
  return ctx.db.transaction(async (tx) => {
    const [current] = await tx.select().from(schema.applicationPeriod).where(eq(schema.applicationPeriod.id, id)).for("update");
    if (!current) throw new ServiceError("not_found", "Application period not found.");
    const opensAt = patch.opensAt ? new Date(patch.opensAt) : current.opensAt;
    const closesAt = patch.closesAt ? new Date(patch.closesAt) : current.closesAt;
    if (!(closesAt > opensAt)) throw new ServiceError("invalid", "The period has to close after it opens.");
    await assertNoOverlap(tx, { opensAt, closesAt }, id);
    const countries = patch.countries ? normaliseCountries(patch.countries) : current.countries;
    if (countries.length === 0) throw new ServiceError("invalid", "A period needs at least one country.");

    const [row] = await tx
      .update(schema.applicationPeriod)
      .set({ name: patch.name ?? current.name, opensAt, closesAt, countries })
      .where(eq(schema.applicationPeriod.id, id))
      .returning();
    if (!row) throw new Error("The period was not updated");
    await recordSummitChange(tx, ctx.principal.userId, {
      action: "summit.period.updated",
      entityType: "summit_period",
      entityId: id,
      organizationId: null,
      before: periodView(current, ctx.now),
      after: periodView(row, ctx.now),
    });
    return periodView(row, ctx.now);
  });
}
