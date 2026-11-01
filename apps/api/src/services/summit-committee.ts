import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { schema } from "@entrust/db";
import {
  COMMITTEE_DECISIONS,
  COMMITTEE_DECISION_STATUS,
  COMMITTEE_STATUSES,
  RECOMMENDATIONS,
  VERIFIABLE_CLAIMS,
  applicantProfile,
  rankByScore,
  readinessPercent,
  type ApplicantProfile,
  type CommitteeDecision,
} from "@entrust/summit-engine";
import type { CommitteeItemView, CommitteeListView, CompareViewType } from "../schemas/summit";
import type { Ctx } from "./access";
import type { Executor } from "./db";
import { ServiceError } from "./errors";
import { findApplication } from "./summit-access";
import { loadPeriod, templateOf } from "./summit-applications";
import { requireOpenSelection } from "./summit-final-list";
import { scoreApplications, type Scored } from "./summit-scores";
import { changeStatus, recordSummitChange } from "./summit-status";

// The selection committee's side of the Summit (#80): comparing applicants, filtering them, and recording a decision
// with its reason. The committee reads an application from the start of committee review; it changes nothing of the
// assessment, only its own decision and its comments.

const person = (id: string | null, name: string | null) => (id && name ? { id, name } : null);

/** Who may look at the committee's lists: the committee, and the administrators who run the selection. */
export function requireCommitteeView(ctx: Ctx, doing: string): void {
  const { staffRole, committee } = ctx.principal;
  if (!committee && staffRole !== "admin" && staffRole !== "facilitator") {
    throw new ServiceError("forbidden", `Only the selection committee, administrators and facilitators can ${doing}.`);
  }
}

export type PeriodRow = typeof schema.applicationPeriod.$inferSelect;

interface Entry {
  item: CommitteeItemView;
  profile: ApplicantProfile;
  /** Words of the filters that read text, lower-cased once. */
  search: string;
  adjustments: number;
  rationale: string | null;
  claims: { claim: string; label: string | null; class: (typeof schema.verificationRecord.$inferSelect)["class"] }[];
}

/**
 * Every application of the period in a committee stage, with its score and rank. The score is computed from the stored
 * points and the rules version the assessment was made under, adjustments included, the same way the officer's
 * workspace shows it. Ranks are over the whole period, so a filter never changes an applicant's place.
 */
async function committeeEntries(db: Executor, period: PeriodRow): Promise<Entry[]> {
  const rows = await db
    .select({
      row: schema.application,
      organizationName: schema.organization.name,
      smeId: schema.smeProfile.smeId,
      country: schema.smeProfile.country,
    })
    .from(schema.application)
    .innerJoin(schema.organization, eq(schema.organization.id, schema.application.organizationId))
    .leftJoin(schema.smeProfile, eq(schema.smeProfile.organizationId, schema.application.organizationId))
    .where(and(eq(schema.application.periodId, period.id), inArray(schema.application.status, [...COMMITTEE_STATUSES])))
    .orderBy(asc(schema.application.number));
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.row.id);
  const [scored, recommendations, decisions, verification] = await Promise.all([
    scoreApplications(db, period, rows.map((r) => r.row)),
    db
      .select()
      .from(schema.applicationRecommendation)
      .where(inArray(schema.applicationRecommendation.applicationId, ids))
      .orderBy(asc(schema.applicationRecommendation.recordedAt)),
    db
      .select({ decision: schema.committeeDecision, userId: schema.user.id, userName: schema.user.name })
      .from(schema.committeeDecision)
      .leftJoin(schema.user, eq(schema.user.id, schema.committeeDecision.decidedBy))
      .where(inArray(schema.committeeDecision.applicationId, ids))
      .orderBy(asc(schema.committeeDecision.decidedAt)),
    db.select().from(schema.verificationRecord).where(inArray(schema.verificationRecord.applicationId, ids)).orderBy(asc(schema.verificationRecord.recordedAt)),
  ]);
  // Oldest first, so the last of each application is the current one.
  const recommendationOf = new Map(recommendations.map((r) => [r.applicationId, r]));
  const decisionOf = new Map(decisions.map((d) => [d.decision.applicationId, d]));

  const entries = rows.map(({ row, organizationName, smeId, country }): Entry => {
    const template = templateOf(row.templateVersion);
    const { rules, pathway, result, adjustments } = scored.get(row.id) as Scored;

    const profile = applicantProfile(template, row.answers);
    const recommendation = recommendationOf.get(row.id);
    const decided = decisionOf.get(row.id);
    const item: CommitteeItemView = {
      id: row.id,
      number: row.number,
      organizationName,
      smeId,
      country,
      sector: profile.sector,
      pathway,
      status: row.status as CommitteeItemView["status"],
      womanOwned: profile.womanOwned,
      youthOwned: profile.youthOwned,
      score: result?.total ?? null,
      points: result?.points ?? null,
      possible: result?.possible ?? 100,
      rank: null,
      readiness: result ? readinessPercent(result) : null,
      categories: rules.rubric.categories.map((category) => {
        const summary = result?.categories.find((c) => c.id === category.id);
        return {
          id: category.id,
          title: category.title,
          maxPoints: category.maxPoints,
          applicable: summary?.applicable ?? true,
          points: summary?.points ?? null,
        };
      }),
      recommendation: recommendation
        ? {
            recommendation: recommendation.recommendation,
            label: RECOMMENDATIONS.find((r) => r.id === recommendation.recommendation)?.label ?? recommendation.recommendation,
            suitableOpportunity: recommendation.suitableOpportunity,
          }
        : null,
      decision: decided
        ? {
            decision: decided.decision.decision,
            label: COMMITTEE_DECISIONS.find((d) => d.id === decided.decision.decision)?.label ?? decided.decision.decision,
            reason: decided.decision.reason,
            by: person(decided.userId, decided.userName),
            at: decided.decision.decidedAt.toISOString(),
          }
        : null,
    };
    return {
      item,
      profile,
      search: [organizationName, row.number, smeId ?? ""].join(" ").toLowerCase(),
      adjustments,
      rationale: recommendation?.rationale ?? null,
      claims: verification
        .filter((v) => v.applicationId === row.id)
        .map((v) => ({ claim: v.claim, label: VERIFIABLE_CLAIMS.find((c) => c.id === v.claim)?.label ?? null, class: v.class })),
    };
  });

  const ranks = rankByScore(entries.map((e) => ({ id: e.item.id, total: e.item.score })));
  for (const entry of entries) entry.item.rank = ranks.get(entry.item.id) ?? null;
  return entries;
}

export async function pickPeriod(db: Executor, periodId: string | undefined): Promise<PeriodRow | null> {
  if (periodId) return loadPeriod(db, periodId).catch(() => null);
  const [newest] = await db.select().from(schema.applicationPeriod).orderBy(desc(schema.applicationPeriod.opensAt)).limit(1);
  return newest ?? null;
}

export interface CommitteeQuery {
  periodId?: string | undefined;
  country?: string | undefined;
  sector?: string | undefined;
  pathway?: string | undefined;
  recommendation?: string | undefined;
  status?: string | undefined;
  minScore?: number | undefined;
  maxScore?: number | undefined;
  minReadiness?: number | undefined;
  womanOwned?: boolean | undefined;
  youthOwned?: boolean | undefined;
  q?: string | undefined;
  sort: "rank" | "score" | "readiness" | "name" | "country";
  limit: number;
  offset: number;
}

/** A number sorts before a missing one, highest first. */
const descending = (a: number | null, b: number | null): number => (a === null ? (b === null ? 0 : 1) : b === null ? -1 : b - a);
const ascending = (a: number | null, b: number | null): number => (a === null ? (b === null ? 0 : 1) : b === null ? -1 : a - b);

const SORTS: Record<CommitteeQuery["sort"], (a: CommitteeItemView, b: CommitteeItemView) => number> = {
  rank: (a, b) => ascending(a.rank, b.rank),
  score: (a, b) => descending(a.score, b.score),
  readiness: (a, b) => descending(a.readiness, b.readiness),
  name: (a, b) => a.organizationName.localeCompare(b.organizationName),
  country: (a, b) => (a.country ?? "~").localeCompare(b.country ?? "~"),
};

/**
 * The applications in a committee stage, to compare and filter. Each has its score, rank, readiness, category points,
 * the officer's recommendation and the committee's latest decision. The score of an application the officer adjusted is
 * the adjusted one.
 */
export async function listForCommittee(ctx: Ctx, query: CommitteeQuery): Promise<CommitteeListView> {
  requireCommitteeView(ctx, "compare applicants");
  const period = await pickPeriod(ctx.db, query.periodId);
  if (!period) {
    if (query.periodId) throw new ServiceError("not_found", "No such application period.");
    return { period: null, items: [], total: 0, counts: Object.fromEntries(COMMITTEE_STATUSES.map((s) => [s, 0])) };
  }
  const entries = await committeeEntries(ctx.db, period);

  const counts: Record<string, number> = Object.fromEntries(COMMITTEE_STATUSES.map((s) => [s, 0]));
  for (const { item } of entries) counts[item.status] = (counts[item.status] ?? 0) + 1;

  const sector = query.sector?.toLowerCase();
  const search = query.q?.toLowerCase();
  const matching = entries
    .filter(({ item, profile, search: haystack }) => {
      if (query.country && item.country?.toUpperCase() !== query.country.toUpperCase()) return false;
      if (sector && !item.sector?.toLowerCase().includes(sector)) return false;
      if (query.pathway && item.pathway !== query.pathway) return false;
      if (query.recommendation && item.recommendation?.recommendation !== query.recommendation) return false;
      if (query.status && item.status !== query.status) return false;
      if (query.minScore !== undefined && !(item.score !== null && item.score >= query.minScore)) return false;
      if (query.maxScore !== undefined && !(item.score !== null && item.score <= query.maxScore)) return false;
      if (query.minReadiness !== undefined && !(item.readiness !== null && item.readiness >= query.minReadiness)) return false;
      if (query.womanOwned !== undefined && profile.womanOwned !== query.womanOwned) return false;
      if (query.youthOwned !== undefined && profile.youthOwned !== query.youthOwned) return false;
      if (search && !haystack.includes(search)) return false;
      return true;
    })
    .map((e) => e.item)
    // A tie keeps the application number's order, so the list doesn't shuffle between requests.
    .sort((a, b) => SORTS[query.sort](a, b) || a.number.localeCompare(b.number));

  return {
    period: { id: period.id, name: period.name },
    items: matching.slice(query.offset, query.offset + query.limit),
    total: matching.length,
    counts,
  };
}

/** Two to five applications side by side: score and category points, the recommendation and why, and what was verified. */
export async function compareForCommittee(ctx: Ctx, ids: readonly string[]): Promise<CompareViewType> {
  requireCommitteeView(ctx, "compare applicants");
  const unique = [...new Set(ids)];
  if (unique.length < 2) throw new ServiceError("invalid", "Name at least two different applications to compare.");

  const found = await ctx.db
    .select({ id: schema.application.id, periodId: schema.application.periodId, status: schema.application.status })
    .from(schema.application)
    .where(inArray(schema.application.id, unique));
  // An application the committee hasn't reached looks the same as one that doesn't exist.
  const reachable = found.filter((f) => (COMMITTEE_STATUSES as readonly string[]).includes(f.status));
  if (reachable.length !== unique.length) throw new ServiceError("not_found", "One of those applications isn't in committee review.");

  const entries = new Map<string, Entry>();
  for (const periodId of new Set(reachable.map((f) => f.periodId))) {
    for (const entry of await committeeEntries(ctx.db, await loadPeriod(ctx.db, periodId))) entries.set(entry.item.id, entry);
  }
  return {
    items: unique.map((id) => {
      const entry = entries.get(id) as Entry;
      return {
        ...entry.item,
        profile: { annualRevenue: entry.profile.annualRevenue, employees: entry.profile.employees, commercialAsk: entry.profile.commercialAsk },
        rationale: entry.rationale,
        verification: entry.claims,
        adjustments: entry.adjustments,
      };
    }),
  };
}

/**
 * Records the committee's decision on an application, with the reason: selected, waitlisted, not selected, or further
 * review required, which keeps it with the committee. A decision can be replaced by another, every one is kept, until
 * the final list is approved. Only a member of the committee decides. The applicant is told when the list is approved.
 */
export async function recordDecision(ctx: Ctx, id: string, input: { decision: string; reason: string }): Promise<CommitteeItemView> {
  const decision = COMMITTEE_DECISIONS.find((d) => d.id === input.decision)?.id as CommitteeDecision | undefined;
  if (!decision) throw new ServiceError("invalid", `"${input.decision}" isn't a committee decision.`);

  const periodId = await ctx.db.transaction(async (tx) => {
    const { row, access } = await findApplication(tx, ctx.principal, id, { lock: true });
    if (!access.committee) throw new ServiceError("forbidden", "Only a member of the selection committee can decide.");
    await requireOpenSelection(tx, row.periodId, "change a decision");

    const before = { status: row.status };
    const to = COMMITTEE_DECISION_STATUS[decision];
    if (to !== row.status) await changeStatus(tx, row, to, ctx.principal.userId, input.reason);
    await tx.insert(schema.committeeDecision).values({ applicationId: id, decision, reason: input.reason, decidedBy: ctx.principal.userId });
    await recordSummitChange(tx, ctx.principal.userId, {
      action: "summit.committee.decided",
      entityType: "summit_application",
      entityId: id,
      organizationId: row.organizationId,
      before,
      after: { decision, status: to },
      reason: input.reason,
    });
    return row.periodId;
  });

  const entries = await committeeEntries(ctx.db, await loadPeriod(ctx.db, periodId));
  const entry = entries.find((e) => e.item.id === id);
  if (!entry) throw new Error(`Application ${id} left committee review`);
  return entry.item;
}
