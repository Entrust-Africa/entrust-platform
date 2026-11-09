import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { ensureBuyer, raiseBuyerStatus } from "./trade-buyers";
import { schema } from "@entrust/db";
import {
  evaluateQualificationScorecard,
  mapExportJourneyStage,
  validateM05Deliverable,
  type LeadQualificationInput,
  type PipelineStage,
  type VerificationLadderStatus,
} from "@entrust/trade-engine";
import type {
  ActivityView,
  CreateOpportunityActivityInput,
  CreateOpportunityInput,
  ExportJourneyStageView,
  OpportunityScorecardInput,
  OpportunityView,
  PipelineQuery,
} from "../schemas/trade";
import type { Ctx } from "./access";
import type { Executor } from "./db";
import { ServiceError } from "./errors";
import { accessTo, recordTradeChange, type Access } from "./trade-shared";

async function resolveOrganization(
  db: Executor,
  ctx: Ctx,
  input: { organizationId?: string | undefined; enrollmentId?: string | undefined }
): Promise<{ organizationId: string; access: Access }> {
  const { principal } = ctx;
  if (input.enrollmentId) {
    const [enrollment] = await db
      .select({ id: schema.enrollment.id, organizationId: schema.enrollment.organizationId })
      .from(schema.enrollment)
      .where(eq(schema.enrollment.id, input.enrollmentId));
    if (!enrollment) throw new ServiceError("not_found", "Enrolment not found.");
    const access = await accessTo(db, principal, enrollment.organizationId);
    if (!access) throw new ServiceError("not_found", "Enrolment not found.");
    return { organizationId: enrollment.organizationId, access };
  }

  const organizationId =
    input.organizationId ??
    (principal.smeRoles.size === 1 ? [...principal.smeRoles.keys()][0] : undefined);

  if (!organizationId) {
    throw new ServiceError("invalid", "Specify an organisation (`organizationId`) or enrolment (`enrollmentId`).");
  }

  const access = await accessTo(db, principal, organizationId);
  if (!access) throw new ServiceError("not_found", "Organisation not found.");

  return { organizationId, access };
}

function mapActivityRow(r: typeof schema.commercialActivity.$inferSelect): ActivityView {
  return {
    id: r.id,
    opportunityId: r.opportunityId,
    organizationId: r.organizationId,
    actorUserId: r.actorUserId,
    type: r.type as ActivityView["type"],
    summary: r.summary,
    occurredAt: r.occurredAt.toISOString(),
    followUpDate: r.followUpDate?.toISOString() ?? null,
    evidenceUrl: r.evidenceUrl ?? null,
    createdAt: r.createdAt.toISOString(),
  };
}

function mapOpportunityRow(
  opp: typeof schema.commercialOpportunity.$inferSelect,
  activityCount: number,
  latestActivity: ActivityView | null
): OpportunityView {
  return {
    id: opp.id,
    organizationId: opp.organizationId,
    enrollmentId: opp.enrollmentId,
    title: opp.title,
    companyName: opp.companyName,
    buyerName: opp.buyerName ?? null,
    country: opp.country,
    website: opp.website ?? null,
    sourceLinks: (opp.sourceLinks as string[]) ?? [],
    decisionMakerRole: opp.decisionMakerRole ?? null,
    notes: opp.notes ?? null,
    verificationStatus: opp.verificationStatus as OpportunityView["verificationStatus"],
    stage: opp.stage as OpportunityView["stage"],
    scorecard: (opp.scorecard as Record<string, number>) ?? null,
    scorecardTotal: opp.scorecardTotal ?? null,
    scorecardBand: opp.scorecardBand as OpportunityView["scorecardBand"],
    estimatedValue: opp.estimatedValue ? Number(opp.estimatedValue) : null,
    currency: opp.currency ?? "USD",
    activityCount,
    latestActivity,
    createdAt: opp.createdAt.toISOString(),
    updatedAt: opp.updatedAt.toISOString(),
  };
}

export async function listOpportunities(
  ctx: Ctx,
  query: { organizationId?: string; enrollmentId?: string }
): Promise<OpportunityView[]> {
  const { db } = ctx;
  const { organizationId } = await resolveOrganization(db, ctx, query);

  const opportunities = await db
    .select()
    .from(schema.commercialOpportunity)
    .where(eq(schema.commercialOpportunity.organizationId, organizationId))
    .orderBy(desc(schema.commercialOpportunity.createdAt));

  if (opportunities.length === 0) return [];

  const oppIds = opportunities.map((o) => o.id);
  const activities = await db
    .select()
    .from(schema.commercialActivity)
    .where(inArray(schema.commercialActivity.opportunityId, oppIds))
    .orderBy(desc(schema.commercialActivity.occurredAt));

  const activitiesByOpp = new Map<string, typeof schema.commercialActivity.$inferSelect[]>();
  for (const act of activities) {
    const list = activitiesByOpp.get(act.opportunityId) ?? [];
    list.push(act);
    activitiesByOpp.set(act.opportunityId, list);
  }

  return opportunities.map((opp) => {
    const oppActs = activitiesByOpp.get(opp.id) ?? [];
    const latest = oppActs[0] ? mapActivityRow(oppActs[0]) : null;
    return mapOpportunityRow(opp, oppActs.length, latest);
  });
}

export async function createOpportunity(
  ctx: Ctx,
  input: CreateOpportunityInput
): Promise<OpportunityView> {
  const { db, principal } = ctx;
  const { organizationId, access } = await resolveOrganization(db, ctx, input);
  if (!access.write) throw new ServiceError("forbidden", "Write access required.");

  // The opportunity points at the business's one record of this buyer, made if it isn't there yet.
  const buyer = await ensureBuyer(db, organizationId, { name: input.companyName, country: input.country, website: input.website, verificationStatus: input.verificationStatus });

  const [created] = await db
    .insert(schema.commercialOpportunity)
    .values({
      organizationId,
      buyerId: buyer?.id ?? null,
      enrollmentId: input.enrollmentId ?? null,
      title: input.title,
      companyName: input.companyName,
      buyerName: input.buyerName ?? null,
      country: input.country,
      website: input.website ?? null,
      sourceLinks: input.sourceLinks ?? [],
      decisionMakerRole: input.decisionMakerRole ?? null,
      notes: input.notes ?? null,
      verificationStatus: input.verificationStatus ?? "unverified",
      stage: input.stage ?? "lead_discovered",
      estimatedValue: input.estimatedValue !== undefined && input.estimatedValue !== null ? String(input.estimatedValue) : null,
      currency: input.currency ?? "USD",
      status: "identified",
    })
    .returning();

  if (!created) throw new ServiceError("invalid", "Failed to create opportunity");

  await recordTradeChange(db, principal.userId, {
    action: "trade.opportunity.created",
    organizationId,
    entityId: created.id,
    entityType: "opportunity",
    after: created,
  });

  return mapOpportunityRow(created, 0, null);
}

export async function updateOpportunityStage(
  ctx: Ctx,
  opportunityId: string,
  newStage: PipelineStage
): Promise<OpportunityView> {
  const { db, principal } = ctx;

  const [opp] = await db
    .select()
    .from(schema.commercialOpportunity)
    .where(eq(schema.commercialOpportunity.id, opportunityId))
    .limit(1);

  if (!opp) throw new ServiceError("not_found", "Opportunity not found.");

  const access = await accessTo(db, principal, opp.organizationId);
  if (!access) throw new ServiceError("not_found", "Opportunity not found.");
  if (!access.write) throw new ServiceError("forbidden", "Write access required.");

  // Crucial requirement: Refuse stage transitions on any lead where no dated commercial activity exists.
  const [activityCountRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.commercialActivity)
    .where(eq(schema.commercialActivity.opportunityId, opportunityId));

  const count = Number(activityCountRow?.count ?? 0);
  if (count === 0) {
    throw new ServiceError(
      "precondition_failed",
      "Stage transition requires at least one recorded commercial activity for this lead."
    );
  }

  const [updated] = await db
    .update(schema.commercialOpportunity)
    .set({
      stage: newStage,
      updatedAt: new Date(),
    })
    .where(eq(schema.commercialOpportunity.id, opportunityId))
    .returning();

  if (!updated) throw new ServiceError("not_found", "Opportunity not found.");

  await recordTradeChange(db, principal.userId, {
    action: "trade.opportunity.stage_updated",
    organizationId: opp.organizationId,
    entityId: opportunityId,
    entityType: "opportunity",
    before: { stage: opp.stage },
    after: { stage: newStage },
  });

  const activities = await db
    .select()
    .from(schema.commercialActivity)
    .where(eq(schema.commercialActivity.opportunityId, opportunityId))
    .orderBy(desc(schema.commercialActivity.occurredAt));

  const latest = activities[0] ? mapActivityRow(activities[0]) : null;
  return mapOpportunityRow(updated, activities.length, latest);
}

export async function recordOpportunityActivity(
  ctx: Ctx,
  opportunityId: string,
  input: CreateOpportunityActivityInput
): Promise<ActivityView> {
  const { db, principal } = ctx;

  const [opp] = await db
    .select()
    .from(schema.commercialOpportunity)
    .where(eq(schema.commercialOpportunity.id, opportunityId))
    .limit(1);

  if (!opp) throw new ServiceError("not_found", "Opportunity not found.");

  const access = await accessTo(db, principal, opp.organizationId);
  if (!access) throw new ServiceError("not_found", "Opportunity not found.");
  if (!access.write) throw new ServiceError("forbidden", "Write access required.");

  const [activity] = await db
    .insert(schema.commercialActivity)
    .values({
      opportunityId,
      organizationId: opp.organizationId,
      actorUserId: principal.userId,
      type: input.type,
      summary: input.summary,
      occurredAt: new Date(input.occurredAt),
      followUpDate: input.followUpDate ? new Date(input.followUpDate) : null,
      evidenceUrl: input.evidenceUrl ?? null,
    })
    .returning();

  if (!activity) throw new ServiceError("invalid", "Failed to record activity");

  // If activity is logged and verificationStatus is unverified, advance to identity_checked or qualified_opportunity
  let nextVerification = opp.verificationStatus;
  if (opp.verificationStatus === "unverified") {
    nextVerification = "identity_checked";
  }
  if (input.type === "rfq") {
    nextVerification = "qualified_opportunity";
  }

  await db
    .update(schema.commercialOpportunity)
    .set({
      verificationStatus: nextVerification,
      updatedAt: new Date(),
    })
    .where(eq(schema.commercialOpportunity.id, opportunityId));
  await raiseBuyerStatus(db, opp.buyerId, nextVerification);

  await recordTradeChange(db, principal.userId, {
    action: "trade.opportunity.activity_recorded",
    organizationId: opp.organizationId,
    entityId: activity.id,
    entityType: "activity",
    after: activity,
  });

  return mapActivityRow(activity);
}

export async function listOpportunityActivities(
  ctx: Ctx,
  opportunityId: string
): Promise<ActivityView[]> {
  const { db, principal } = ctx;

  const [opp] = await db
    .select({ organizationId: schema.commercialOpportunity.organizationId })
    .from(schema.commercialOpportunity)
    .where(eq(schema.commercialOpportunity.id, opportunityId))
    .limit(1);

  if (!opp) throw new ServiceError("not_found", "Opportunity not found.");

  const access = await accessTo(db, principal, opp.organizationId);
  if (!access) throw new ServiceError("not_found", "Opportunity not found.");

  const rows = await db
    .select()
    .from(schema.commercialActivity)
    .where(eq(schema.commercialActivity.opportunityId, opportunityId))
    .orderBy(desc(schema.commercialActivity.occurredAt));

  return rows.map(mapActivityRow);
}

export async function scoreOpportunity(
  ctx: Ctx,
  opportunityId: string,
  criteria: OpportunityScorecardInput
): Promise<OpportunityView> {
  const { db, principal } = ctx;

  const [opp] = await db
    .select()
    .from(schema.commercialOpportunity)
    .where(eq(schema.commercialOpportunity.id, opportunityId))
    .limit(1);

  if (!opp) throw new ServiceError("not_found", "Opportunity not found.");

  const access = await accessTo(db, principal, opp.organizationId);
  if (!access) throw new ServiceError("not_found", "Opportunity not found.");
  if (!access.write) throw new ServiceError("forbidden", "Write access required.");

  const scorecardResult = evaluateQualificationScorecard(criteria as LeadQualificationInput);

  const [updated] = await db
    .update(schema.commercialOpportunity)
    .set({
      scorecard: criteria,
      scorecardTotal: scorecardResult.total,
      scorecardBand: scorecardResult.band,
      updatedAt: new Date(),
    })
    .where(eq(schema.commercialOpportunity.id, opportunityId))
    .returning();

  if (!updated) throw new ServiceError("not_found", "Opportunity not found.");

  await recordTradeChange(db, principal.userId, {
    action: "trade.opportunity.scorecard_saved",
    organizationId: opp.organizationId,
    entityId: opportunityId,
    entityType: "opportunity",
    after: scorecardResult,
  });

  const activities = await db
    .select()
    .from(schema.commercialActivity)
    .where(eq(schema.commercialActivity.opportunityId, opportunityId))
    .orderBy(desc(schema.commercialActivity.occurredAt));

  const latest = activities[0] ? mapActivityRow(activities[0]) : null;
  return mapOpportunityRow(updated, activities.length, latest);
}

export async function getExportJourneyStage(
  ctx: Ctx,
  query: { organizationId?: string; enrollmentId?: string }
): Promise<ExportJourneyStageView> {
  const { db } = ctx;
  const { organizationId } = await resolveOrganization(db, ctx, query);

  const opportunities = await db
    .select({
      id: schema.commercialOpportunity.id,
      stage: schema.commercialOpportunity.stage,
      verificationStatus: schema.commercialOpportunity.verificationStatus,
    })
    .from(schema.commercialOpportunity)
    .where(eq(schema.commercialOpportunity.organizationId, organizationId));

  const exportOutcomes = await db
    .select({
      status: schema.outcome.status,
      valueShipped: schema.outcome.valueShipped,
      valuePaid: schema.outcome.valuePaid,
      shipmentDate: schema.outcome.shipmentDate,
      deliveryDate: schema.outcome.deliveryDate,
      paymentDate: schema.outcome.paymentDate,
    })
    .from(schema.outcome)
    .where(and(eq(schema.outcome.organizationId, organizationId), eq(schema.outcome.kind, "export")));

  const hasPaymentReceived = exportOutcomes.some(
    (o) => o.status === "paid" || (o.valuePaid !== null && Number(o.valuePaid) > 0) || o.paymentDate !== null
  );
  const hasDelivered = exportOutcomes.some(
    (o) => o.status === "delivered" || o.deliveryDate !== null
  );
  const hasShipmentUnderway = exportOutcomes.some(
    (o) => o.status === "shipped" || (o.valueShipped !== null && Number(o.valueShipped) > 0) || o.shipmentDate !== null
  );

  const journey = mapExportJourneyStage(
    opportunities.map((o) => ({
      id: o.id,
      stage: o.stage as PipelineStage,
      verificationStatus: o.verificationStatus as VerificationLadderStatus,
    })),
    { hasShipmentUnderway, hasDelivered, hasPaymentReceived }
  );
  const m05Deliverable = validateM05Deliverable(
    opportunities.map((o) => ({ verificationStatus: o.verificationStatus as VerificationLadderStatus }))
  );

  return {
    stageNumber: journey.stageNumber,
    title: journey.title,
    description: journey.description,
    furthestOpportunityId: journey.furthestOpportunityId,
    activeOpportunitiesCount: opportunities.length,
    m05DeliverableStatus: m05Deliverable,
  };
}
