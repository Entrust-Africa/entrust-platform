import { and, asc, count, eq, inArray, sql } from "drizzle-orm";
import { schema } from "@entrust/db";
import {
  DEFAULT_SELECTION_TARGET,
  VERIFICATION_CLASSES,
  applicantProfile,
  summarise,
  type DashboardRow,
  type SelectionTarget,
  type VerificationClass,
} from "@entrust/summit-engine";
import type { DashboardViewType } from "../schemas/summit";
import type { Ctx } from "./access";
import type { Executor } from "./db";
import { ServiceError } from "./errors";
import { pickPeriod, requireCommitteeView, type PeriodRow } from "./summit-committee";
import { templateOf } from "./summit-applications";
import { scoreApplications } from "./summit-scores";
import { recordSummitChange } from "./summit-status";

// The live distribution dashboard of the Summit (#80, spec section 8) and the committee's planning target. The figures
// are worked out from the database on every request, so they follow the applications as they come in. The arithmetic
// is `summarise` in the engine; this gathers one row per application for it.

async function selectionTargetOf(db: Executor, periodId: string): Promise<SelectionTarget> {
  const [plan] = await db.select().from(schema.selectionTarget).where(eq(schema.selectionTarget.periodId, periodId));
  return plan ? { perCountry: plan.perCountry, overrides: plan.overrides } : { perCountry: DEFAULT_SELECTION_TARGET, overrides: {} };
}

async function dashboardFor(db: Executor, period: PeriodRow, now: Date): Promise<DashboardViewType> {
  const applications = await db
    .select({ row: schema.application, country: schema.smeProfile.country })
    .from(schema.application)
    .leftJoin(schema.smeProfile, eq(schema.smeProfile.organizationId, schema.application.organizationId))
    .where(eq(schema.application.periodId, period.id))
    .orderBy(asc(schema.application.number));
  const ids = applications.map((a) => a.row.id);
  const submitted = applications.filter((a) => a.row.submittedAt !== null).map((a) => a.row);

  const [target, scored, eligibility, recommendations, verification] = await Promise.all([
    selectionTargetOf(db, period.id),
    scoreApplications(db, period, submitted),
    ids.length
      ? db
          .select({ applicationId: schema.eligibilityResult.applicationId, outcome: schema.eligibilityResult.outcome })
          .from(schema.eligibilityResult)
          .where(inArray(schema.eligibilityResult.applicationId, ids))
          .orderBy(asc(schema.eligibilityResult.screenedAt))
      : [],
    ids.length
      ? db
          .select({ applicationId: schema.applicationRecommendation.applicationId, suitable: schema.applicationRecommendation.suitableOpportunity })
          .from(schema.applicationRecommendation)
          .where(inArray(schema.applicationRecommendation.applicationId, ids))
          .orderBy(asc(schema.applicationRecommendation.recordedAt))
      : [],
    ids.length
      ? db
          .select({ class: schema.verificationRecord.class, claims: count(), applications: sql<number>`count(distinct ${schema.verificationRecord.applicationId})` })
          .from(schema.verificationRecord)
          .where(inArray(schema.verificationRecord.applicationId, ids))
          .groupBy(schema.verificationRecord.class)
      : [],
  ]);
  // Oldest first, so the last of each application is the current one.
  const outcomeOf = new Map(eligibility.map((e) => [e.applicationId, e.outcome]));
  const suitableOf = new Map(recommendations.map((r) => [r.applicationId, r.suitable]));
  const byClass = Object.fromEntries(VERIFICATION_CLASSES.map((c) => [c, 0])) as Record<VerificationClass, number>;
  for (const v of verification) byClass[v.class] = v.claims;
  const [classified] = ids.length
    ? await db
        .select({ applications: sql<number>`count(distinct ${schema.verificationRecord.applicationId})` })
        .from(schema.verificationRecord)
        .where(inArray(schema.verificationRecord.applicationId, ids))
    : [];

  const rows = applications.map(({ row, country }): DashboardRow => {
    const profile = applicantProfile(templateOf(row.templateVersion), row.answers);
    const score = scored.get(row.id);
    const assessed = score?.assessment?.completedAt != null;
    return {
      country,
      status: row.status,
      submitted: row.submittedAt !== null,
      eligible: outcomeOf.get(row.id) === "eligible",
      assessed,
      score: assessed ? (score?.result?.total ?? null) : null,
      sector: profile.sector,
      pathway: score?.pathway ?? row.pathway ?? null,
      suitableOpportunity: suitableOf.get(row.id) ?? null,
      womanOwned: profile.womanOwned,
      youthOwned: profile.youthOwned,
    };
  });

  const figures = summarise({
    rows,
    countries: period.countries,
    target,
    verification: byClass,
    classifiedApplications: Number(classified?.applications ?? 0),
  });
  return {
    period: { id: period.id, name: period.name, countries: period.countries },
    generatedAt: now.toISOString(),
    ...figures,
    target: { ...figures.target, overrides: { ...target.overrides } },
  };
}

/** The dashboard for a period: the committee, administrators and facilitators. */
export async function getDashboard(ctx: Ctx, periodId?: string): Promise<DashboardViewType> {
  requireCommitteeView(ctx, "see the dashboard");
  const period = await pickPeriod(ctx.db, periodId);
  if (!period) throw new ServiceError("not_found", periodId ? "No such application period." : "There is no application period yet.");
  return dashboardFor(ctx.db, period, ctx.now);
}

/**
 * Changes the planning target: the figure for every country, or for single countries (a null removes a country's own
 * figure). Only for the period's own countries. The committee decides it; every change is audited with the figures
 * before and after.
 */
export async function setSelectionTarget(
  ctx: Ctx,
  periodId: string,
  input: { perCountry?: number | undefined; countries?: Readonly<Record<string, number | null>> | undefined },
): Promise<DashboardViewType> {
  if (!ctx.principal.committee) throw new ServiceError("forbidden", "Only a member of the selection committee can change the selection target.");

  await ctx.db.transaction(async (tx) => {
    const [period] = await tx.select().from(schema.applicationPeriod).where(eq(schema.applicationPeriod.id, periodId)).for("update");
    if (!period) throw new ServiceError("not_found", "No such application period.");

    const allowed = new Set(period.countries.map((c) => c.toUpperCase()));
    const before = await selectionTargetOf(tx, periodId);
    const overrides: Record<string, number> = { ...before.overrides };
    for (const [code, figure] of Object.entries(input.countries ?? {})) {
      const country = code.toUpperCase();
      if (!allowed.has(country)) throw new ServiceError("invalid", `${country} isn't one of the countries of this period.`);
      if (figure === null) delete overrides[country];
      else overrides[country] = figure;
    }
    const perCountry = input.perCountry ?? before.perCountry;
    await tx
      .insert(schema.selectionTarget)
      .values({ periodId, perCountry, overrides, updatedBy: ctx.principal.userId })
      .onConflictDoUpdate({ target: schema.selectionTarget.periodId, set: { perCountry, overrides, updatedBy: ctx.principal.userId, updatedAt: ctx.now } });
    await recordSummitChange(tx, ctx.principal.userId, {
      action: "summit.selectionTarget.changed",
      entityType: "summit_period",
      entityId: periodId,
      organizationId: null,
      before,
      after: { perCountry, overrides },
    });
  });

  const period = await pickPeriod(ctx.db, periodId);
  return dashboardFor(ctx.db, period as PeriodRow, ctx.now);
}
