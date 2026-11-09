import { and, desc, eq, inArray } from "drizzle-orm";
import { schema } from "@entrust/db";
import type { OutcomeEvidenceTier } from "@entrust/trade-engine";
import type {
  CreateExportOutcomeInput,
  CreateFinancingOutcomeInput,
  OutcomeEventView,
  OutcomeView,
  UpdateExportStatusInput,
  UpdateFinancingStatusInput,
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

function mapEventRow(r: typeof schema.outcomeEvent.$inferSelect): OutcomeEventView {
  return {
    id: r.id,
    outcomeId: r.outcomeId,
    organizationId: r.organizationId,
    actorUserId: r.actorUserId,
    previousStatus: r.previousStatus ?? null,
    newStatus: r.newStatus,
    evidenceTier: r.evidenceTier as OutcomeEvidenceTier,
    evidenceUrl: r.evidenceUrl ?? null,
    notes: r.notes ?? null,
    createdAt: r.createdAt.toISOString(),
  };
}

function mapOutcomeRow(
  r: typeof schema.outcome.$inferSelect,
  events: OutcomeEventView[] = []
): OutcomeView {
  return {
    id: r.id,
    organizationId: r.organizationId,
    enrollmentId: r.enrollmentId ?? null,
    kind: r.kind as "financing" | "export",
    status: r.status,
    lenderName: r.lenderName ?? null,
    financingType: r.financingType ?? null,
    amountRequested: r.amountRequested ? Number(r.amountRequested) : null,
    amountApproved: r.amountApproved ? Number(r.amountApproved) : null,
    amountDisbursed: r.amountDisbursed ? Number(r.amountDisbursed) : null,
    currency: r.currency ?? "USD",
    approvalDate: r.approvalDate?.toISOString() ?? null,
    disbursementDate: r.disbursementDate?.toISOString() ?? null,
    opportunityId: r.opportunityId ?? null,
    buyerName: r.buyerName ?? null,
    destinationCountry: r.destinationCountry ?? null,
    productDescription: r.productDescription ?? null,
    valuePlanned: r.valuePlanned ? Number(r.valuePlanned) : null,
    valueShipped: r.valueShipped ? Number(r.valueShipped) : null,
    valuePaid: r.valuePaid ? Number(r.valuePaid) : null,
    shipmentDate: r.shipmentDate?.toISOString() ?? null,
    deliveryDate: r.deliveryDate?.toISOString() ?? null,
    paymentDate: r.paymentDate?.toISOString() ?? null,
    notes: r.notes ?? null,
    evidenceTier: r.evidenceTier as OutcomeEvidenceTier,
    evidenceUrl: r.evidenceUrl ?? null,
    events,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

/** A formal bank decision is evidence Entrust staff confirm. A business can say what it reports and what it has documented. */
function assertEvidenceTierAllowed(principal: { staffRole: unknown }, tier: string | null | undefined): void {
  if (tier === "formal_bank_decision" && !principal.staffRole) {
    throw new ServiceError("forbidden", "Only Entrust staff can record a formal bank decision.");
  }
}

export async function listOutcomes(
  ctx: Ctx,
  query: { organizationId?: string; enrollmentId?: string; kind?: "financing" | "export" }
): Promise<OutcomeView[]> {
  const { db } = ctx;
  const { organizationId } = await resolveOrganization(db, ctx, query);

  const conditions = [eq(schema.outcome.organizationId, organizationId)];
  if (query.kind) {
    conditions.push(eq(schema.outcome.kind, query.kind));
  }

  const outcomes = await db
    .select()
    .from(schema.outcome)
    .where(and(...conditions))
    .orderBy(desc(schema.outcome.createdAt));

  if (outcomes.length === 0) return [];

  const outcomeIds = outcomes.map((o) => o.id);
  const events = await db
    .select()
    .from(schema.outcomeEvent)
    .where(inArray(schema.outcomeEvent.outcomeId, outcomeIds))
    .orderBy(desc(schema.outcomeEvent.createdAt));

  const eventsByOutcome = new Map<string, OutcomeEventView[]>();
  for (const ev of events) {
    const list = eventsByOutcome.get(ev.outcomeId) ?? [];
    list.push(mapEventRow(ev));
    eventsByOutcome.set(ev.outcomeId, list);
  }

  return outcomes.map((o) => mapOutcomeRow(o, eventsByOutcome.get(o.id) ?? []));
}

export async function createFinancingOutcome(
  ctx: Ctx,
  input: CreateFinancingOutcomeInput
): Promise<OutcomeView> {
  const { db, principal } = ctx;
  const { organizationId, access } = await resolveOrganization(db, ctx, input);
  if (!access.write) throw new ServiceError("forbidden", "Write access required.");

  const [created] = await db
    .insert(schema.outcome)
    .values({
      organizationId,
      enrollmentId: input.enrollmentId ?? null,
      kind: "financing",
      status: input.status ?? "application_prepared",
      lenderName: input.lenderName,
      financingType: input.financingType,
      amountRequested: String(input.amountRequested),
      amountApproved: input.amountApproved !== undefined && input.amountApproved !== null ? String(input.amountApproved) : null,
      amountDisbursed: input.amountDisbursed !== undefined && input.amountDisbursed !== null ? String(input.amountDisbursed) : null,
      currency: input.currency ?? "USD",
      approvalDate: input.approvalDate ? new Date(input.approvalDate) : null,
      disbursementDate: input.disbursementDate ? new Date(input.disbursementDate) : null,
      notes: input.notes ?? null,
      evidenceTier: (assertEvidenceTierAllowed(principal, input.evidenceTier), input.evidenceTier ?? "self_reported"),
      evidenceUrl: input.evidenceUrl ?? null,
    })
    .returning();

  if (!created) throw new ServiceError("invalid", "Failed to create financing outcome");

  const [event] = await db
    .insert(schema.outcomeEvent)
    .values({
      outcomeId: created.id,
      organizationId,
      actorUserId: principal.userId,
      previousStatus: null,
      newStatus: created.status,
      evidenceTier: created.evidenceTier as OutcomeEvidenceTier,
      evidenceUrl: created.evidenceUrl ?? null,
      notes: input.notes ?? "Financing application initialized",
    })
    .returning();

  await recordTradeChange(db, principal.userId, {
    action: "trade.outcome.financing_created",
    organizationId,
    entityId: created.id,
    entityType: "outcome",
    after: created,
  });

  return mapOutcomeRow(created, event ? [mapEventRow(event)] : []);
}

export async function updateFinancingStatus(
  ctx: Ctx,
  outcomeId: string,
  input: UpdateFinancingStatusInput
): Promise<OutcomeView> {
  const { db, principal } = ctx;

  const [outcome] = await db
    .select()
    .from(schema.outcome)
    .where(and(eq(schema.outcome.id, outcomeId), eq(schema.outcome.kind, "financing")))
    .limit(1);

  if (!outcome) throw new ServiceError("not_found", "Financing outcome not found.");

  const access = await accessTo(db, principal, outcome.organizationId);
  if (!access) throw new ServiceError("not_found", "Financing outcome not found.");
  if (!access.write) throw new ServiceError("forbidden", "Write access required.");

  const updateValues: Partial<typeof schema.outcome.$inferInsert> = {
    status: input.status,
    updatedAt: new Date(),
  };

  if (input.amountApproved !== undefined) {
    updateValues.amountApproved = input.amountApproved !== null ? String(input.amountApproved) : null;
  }
  if (input.amountDisbursed !== undefined) {
    updateValues.amountDisbursed = input.amountDisbursed !== null ? String(input.amountDisbursed) : null;
  }
  if (input.approvalDate !== undefined) {
    updateValues.approvalDate = input.approvalDate ? new Date(input.approvalDate) : null;
  }
  if (input.disbursementDate !== undefined) {
    updateValues.disbursementDate = input.disbursementDate ? new Date(input.disbursementDate) : null;
  }
  if (input.evidenceTier !== undefined) {
    // Saving a record staff already confirmed keeps its tier. Only a change to it needs staff.
    if (input.evidenceTier !== outcome.evidenceTier) assertEvidenceTierAllowed(principal, input.evidenceTier);
    updateValues.evidenceTier = input.evidenceTier;
  }
  if (input.evidenceUrl !== undefined) {
    updateValues.evidenceUrl = input.evidenceUrl ?? null;
  }
  if (input.notes !== undefined) {
    updateValues.notes = input.notes ?? null;
  }

  const [updated] = await db
    .update(schema.outcome)
    .set(updateValues)
    .where(eq(schema.outcome.id, outcomeId))
    .returning();

  if (!updated) throw new ServiceError("not_found", "Financing outcome not found.");

  await db.insert(schema.outcomeEvent).values({
    outcomeId,
    organizationId: outcome.organizationId,
    actorUserId: principal.userId,
    previousStatus: outcome.status,
    newStatus: input.status,
    evidenceTier: (input.evidenceTier ?? updated.evidenceTier) as OutcomeEvidenceTier,
    evidenceUrl: input.evidenceUrl ?? updated.evidenceUrl ?? null,
    notes: input.notes ?? `Status transitioned from ${outcome.status} to ${input.status}`,
  });

  await recordTradeChange(db, principal.userId, {
    action: "trade.outcome.financing_updated",
    organizationId: outcome.organizationId,
    entityId: outcomeId,
    entityType: "outcome",
    before: { status: outcome.status },
    after: { status: input.status },
  });

  const events = await db
    .select()
    .from(schema.outcomeEvent)
    .where(eq(schema.outcomeEvent.outcomeId, outcomeId))
    .orderBy(desc(schema.outcomeEvent.createdAt));

  return mapOutcomeRow(updated, events.map(mapEventRow));
}

export async function createExportOutcome(
  ctx: Ctx,
  input: CreateExportOutcomeInput
): Promise<OutcomeView> {
  const { db, principal } = ctx;
  const { organizationId, access } = await resolveOrganization(db, ctx, input);
  if (!access.write) throw new ServiceError("forbidden", "Write access required.");

  const [created] = await db
    .insert(schema.outcome)
    .values({
      organizationId,
      enrollmentId: input.enrollmentId ?? null,
      opportunityId: input.opportunityId ?? null,
      kind: "export",
      status: input.status ?? "planned",
      buyerName: input.buyerName,
      destinationCountry: input.destinationCountry,
      productDescription: input.productDescription,
      valuePlanned: input.valuePlanned !== undefined && input.valuePlanned !== null ? String(input.valuePlanned) : null,
      valueShipped: input.valueShipped !== undefined && input.valueShipped !== null ? String(input.valueShipped) : null,
      valuePaid: input.valuePaid !== undefined && input.valuePaid !== null ? String(input.valuePaid) : null,
      currency: input.currency ?? "USD",
      shipmentDate: input.shipmentDate ? new Date(input.shipmentDate) : null,
      deliveryDate: input.deliveryDate ? new Date(input.deliveryDate) : null,
      paymentDate: input.paymentDate ? new Date(input.paymentDate) : null,
      notes: input.notes ?? null,
      evidenceTier: (assertEvidenceTierAllowed(principal, input.evidenceTier), input.evidenceTier ?? "self_reported"),
      evidenceUrl: input.evidenceUrl ?? null,
    })
    .returning();

  if (!created) throw new ServiceError("invalid", "Failed to create export outcome");

  const [event] = await db
    .insert(schema.outcomeEvent)
    .values({
      outcomeId: created.id,
      organizationId,
      actorUserId: principal.userId,
      previousStatus: null,
      newStatus: created.status,
      evidenceTier: created.evidenceTier as OutcomeEvidenceTier,
      evidenceUrl: created.evidenceUrl ?? null,
      notes: input.notes ?? "Export outcome recorded",
    })
    .returning();

  await recordTradeChange(db, principal.userId, {
    action: "trade.outcome.export_created",
    organizationId,
    entityId: created.id,
    entityType: "outcome",
    after: created,
  });

  return mapOutcomeRow(created, event ? [mapEventRow(event)] : []);
}

export async function updateExportStatus(
  ctx: Ctx,
  outcomeId: string,
  input: UpdateExportStatusInput
): Promise<OutcomeView> {
  const { db, principal } = ctx;

  const [outcome] = await db
    .select()
    .from(schema.outcome)
    .where(and(eq(schema.outcome.id, outcomeId), eq(schema.outcome.kind, "export")))
    .limit(1);

  if (!outcome) throw new ServiceError("not_found", "Export outcome not found.");

  const access = await accessTo(db, principal, outcome.organizationId);
  if (!access) throw new ServiceError("not_found", "Export outcome not found.");
  if (!access.write) throw new ServiceError("forbidden", "Write access required.");

  const updateValues: Partial<typeof schema.outcome.$inferInsert> = {
    status: input.status,
    updatedAt: new Date(),
  };

  if (input.valueShipped !== undefined) {
    updateValues.valueShipped = input.valueShipped !== null ? String(input.valueShipped) : null;
  }
  if (input.valuePaid !== undefined) {
    updateValues.valuePaid = input.valuePaid !== null ? String(input.valuePaid) : null;
  }
  if (input.shipmentDate !== undefined) {
    updateValues.shipmentDate = input.shipmentDate ? new Date(input.shipmentDate) : null;
  }
  if (input.deliveryDate !== undefined) {
    updateValues.deliveryDate = input.deliveryDate ? new Date(input.deliveryDate) : null;
  }
  if (input.paymentDate !== undefined) {
    updateValues.paymentDate = input.paymentDate ? new Date(input.paymentDate) : null;
  }
  if (input.evidenceTier !== undefined) {
    // Saving a record staff already confirmed keeps its tier. Only a change to it needs staff.
    if (input.evidenceTier !== outcome.evidenceTier) assertEvidenceTierAllowed(principal, input.evidenceTier);
    updateValues.evidenceTier = input.evidenceTier;
  }
  if (input.evidenceUrl !== undefined) {
    updateValues.evidenceUrl = input.evidenceUrl ?? null;
  }
  if (input.notes !== undefined) {
    updateValues.notes = input.notes ?? null;
  }

  const [updated] = await db
    .update(schema.outcome)
    .set(updateValues)
    .where(eq(schema.outcome.id, outcomeId))
    .returning();

  if (!updated) throw new ServiceError("not_found", "Export outcome not found.");

  await db.insert(schema.outcomeEvent).values({
    outcomeId,
    organizationId: outcome.organizationId,
    actorUserId: principal.userId,
    previousStatus: outcome.status,
    newStatus: input.status,
    evidenceTier: (input.evidenceTier ?? updated.evidenceTier) as OutcomeEvidenceTier,
    evidenceUrl: input.evidenceUrl ?? updated.evidenceUrl ?? null,
    notes: input.notes ?? `Export status transitioned from ${outcome.status} to ${input.status}`,
  });

  await recordTradeChange(db, principal.userId, {
    action: "trade.outcome.export_updated",
    organizationId: outcome.organizationId,
    entityId: outcomeId,
    entityType: "outcome",
    before: { status: outcome.status },
    after: { status: input.status },
  });

  const events = await db
    .select()
    .from(schema.outcomeEvent)
    .where(eq(schema.outcomeEvent.outcomeId, outcomeId))
    .orderBy(desc(schema.outcomeEvent.createdAt));

  return mapOutcomeRow(updated, events.map(mapEventRow));
}

export async function listOutcomeEvents(
  ctx: Ctx,
  outcomeId: string
): Promise<OutcomeEventView[]> {
  const { db, principal } = ctx;

  const [outcome] = await db
    .select({ organizationId: schema.outcome.organizationId })
    .from(schema.outcome)
    .where(eq(schema.outcome.id, outcomeId))
    .limit(1);

  if (!outcome) throw new ServiceError("not_found", "Outcome not found.");

  const access = await accessTo(db, principal, outcome.organizationId);
  if (!access) throw new ServiceError("not_found", "Outcome not found.");

  const events = await db
    .select()
    .from(schema.outcomeEvent)
    .where(eq(schema.outcomeEvent.outcomeId, outcomeId))
    .orderBy(desc(schema.outcomeEvent.createdAt));

  return events.map(mapEventRow);
}
