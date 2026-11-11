import { and, asc, desc, eq, isNotNull } from "drizzle-orm";
import { schema } from "@entrust/db";
import { ACTION_REVIEW_QUESTIONS, ACTION_STATUSES, isActionOverdue, milestoneForDueDate, milestoneProgress, type ActionMilestone, type ActionStatus } from "@entrust/trade-engine";
import type { CreateActionItemInput, RecordActionReviewInput, UpdateActionItemInput } from "../schemas/trade";
import type { Ctx } from "./access";
import { ServiceError } from "./errors";
import { accessTo, recordTradeChange } from "./trade-shared";

// The 90-day action plan (FR-11, M12). It belongs to the business, not an enrolment, so it stays available after the certificate.
// The SME writes and approves its own plan: nothing here creates a commitment from assessment results.

const REGISTER_WORKSHEET = "m12-action-register";

type ItemRow = typeof schema.actionItem.$inferSelect;
const today = (ctx: Ctx) => ctx.now.toISOString().slice(0, 10);

async function organizationFor(ctx: Ctx, organizationId?: string) {
  const id = organizationId ?? (ctx.principal.smeRoles.size === 1 ? [...ctx.principal.smeRoles.keys()][0] : undefined);
  if (!id) throw new ServiceError("invalid", "Say which organisation (`organizationId`) this is for.");
  const access = await accessTo(ctx.db, ctx.principal, id);
  if (!access) throw new ServiceError("not_found", "Organisation not found.");
  return { organizationId: id, access };
}

const view = (row: ItemRow, on: string) => ({
  id: row.id,
  organizationId: row.organizationId,
  description: row.description,
  priority: row.priority,
  responsible: row.responsible,
  startDate: row.startDate,
  dueDate: row.dueDate,
  resources: row.resources,
  expectedResult: row.expectedResult,
  performanceIndicator: row.performanceIndicator,
  status: row.status as ActionStatus,
  evidence: row.evidence,
  reviewComments: row.reviewComments,
  milestone: row.milestone as ActionMilestone,
  fromRegister: row.sourceWorksheetVersionId !== null,
  overdue: isActionOverdue(row, on),
  updatedAt: row.updatedAt.toISOString(),
});

export async function getActionPlan(ctx: Ctx, input: { organizationId?: string | undefined }) {
  const { organizationId } = await organizationFor(ctx, input.organizationId);
  const on = today(ctx);
  const items = await ctx.db.select().from(schema.actionItem).where(eq(schema.actionItem.organizationId, organizationId)).orderBy(asc(schema.actionItem.milestone), asc(schema.actionItem.dueDate), asc(schema.actionItem.createdAt));
  const reviews = await ctx.db.select().from(schema.actionReview).where(eq(schema.actionReview.organizationId, organizationId)).orderBy(desc(schema.actionReview.createdAt));
  return {
    organizationId,
    items: items.map((row) => view(row, on)),
    milestones: milestoneProgress(items, on),
    questions: Object.fromEntries(Object.entries(ACTION_REVIEW_QUESTIONS).map(([day, questions]) => [day, questions.map((q) => ({ ...q }))])),
    reviews: reviews.map((r) => ({ id: r.id, day: r.day as ActionMilestone, answers: r.answers, createdAt: r.createdAt.toISOString() })),
  };
}

export async function createActionItem(ctx: Ctx, input: CreateActionItemInput) {
  const { organizationId, access } = await organizationFor(ctx, input.organizationId);
  if (!access.write) throw new ServiceError("forbidden", "Write access required.");
  const [row] = await ctx.db
    .insert(schema.actionItem)
    .values({
      organizationId,
      description: input.description,
      priority: input.priority ?? null,
      responsible: input.responsible,
      startDate: input.startDate ?? null,
      dueDate: input.dueDate,
      resources: input.resources ?? null,
      expectedResult: input.expectedResult ?? null,
      performanceIndicator: input.performanceIndicator ?? null,
      milestone: input.milestone ?? milestoneForDueDate(input.dueDate, today(ctx)),
      createdByUserId: ctx.principal.userId,
    })
    .returning();
  await recordTradeChange(ctx.db, ctx.principal.userId, { action: "trade.action_item.created", organizationId, entityType: "action_item", entityId: row!.id, after: { description: row!.description, dueDate: row!.dueDate } });
  return view(row!, today(ctx));
}

export async function updateActionItem(ctx: Ctx, id: string, input: UpdateActionItemInput) {
  const [existing] = await ctx.db.select().from(schema.actionItem).where(eq(schema.actionItem.id, id));
  const access = existing ? await accessTo(ctx.db, ctx.principal, existing.organizationId) : null;
  if (!existing || !access) throw new ServiceError("not_found", "Action not found.");
  if (!access.write) throw new ServiceError("forbidden", "Write access required.");
  const [row] = await ctx.db
    .update(schema.actionItem)
    .set({ ...input, updatedAt: ctx.now })
    .where(eq(schema.actionItem.id, id))
    .returning();
  await recordTradeChange(ctx.db, ctx.principal.userId, {
    action: "trade.action_item.updated",
    organizationId: existing.organizationId,
    entityType: "action_item",
    entityId: id,
    before: { status: existing.status, dueDate: existing.dueDate },
    after: { status: row!.status, dueDate: row!.dueDate },
  });
  return view(row!, today(ctx));
}

/**
 * Brings the newest submitted M12 action register into the tracker, once. The SME's own register is the source, so nothing is
 * typed twice and nothing is invented. Bringing the same version in again changes nothing.
 */
export async function importActionRegister(ctx: Ctx, input: { organizationId?: string | undefined }) {
  // Two quick clicks take turns on the register version, so the second finds the first's import and adds nothing.
  return ctx.db.transaction((db) => applyActionRegisterImport({ ...ctx, db }, input));
}

const actionKey = (description: string) => description.trim().replace(/\s+/g, " ").toLowerCase();

async function applyActionRegisterImport(ctx: Ctx, input: { organizationId?: string | undefined }) {
  const { organizationId, access } = await organizationFor(ctx, input.organizationId);
  if (!access.write) throw new ServiceError("forbidden", "Write access required.");
  const [latest] = await ctx.db
    .select({ version: schema.worksheetVersion })
    .from(schema.worksheetVersion)
    .innerJoin(schema.enrollment, eq(schema.enrollment.id, schema.worksheetVersion.enrollmentId))
    .where(and(eq(schema.enrollment.organizationId, organizationId), eq(schema.worksheetVersion.worksheetId, REGISTER_WORKSHEET), eq(schema.worksheetVersion.status, "submitted")))
    .orderBy(desc(schema.worksheetVersion.submittedAt))
    .limit(1);
  if (!latest) throw new ServiceError("precondition_failed", "Submit your 90-Day Action Register in M12 first.");
  await ctx.db.select({ id: schema.worksheetVersion.id }).from(schema.worksheetVersion).where(eq(schema.worksheetVersion.id, latest.version.id)).for("update");

  const [already] = await ctx.db
    .select({ id: schema.actionItem.id })
    .from(schema.actionItem)
    .where(and(eq(schema.actionItem.organizationId, organizationId), eq(schema.actionItem.sourceWorksheetVersionId, latest.version.id)))
    .limit(1);
  if (already) return { imported: 0 };

  // A newer version of the register repeats the actions an earlier one brought in: those are already in the tracker, and
  // may have moved on there, so only the new ones come in.
  const imported = await ctx.db
    .select({ description: schema.actionItem.description })
    .from(schema.actionItem)
    .where(and(eq(schema.actionItem.organizationId, organizationId), isNotNull(schema.actionItem.sourceWorksheetVersionId)));
  const known = new Set(imported.map((i) => actionKey(i.description)));

  const rows = (latest.version.values as { actions?: Record<string, unknown>[] }).actions ?? [];
  const text = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : null);
  const on = today(ctx);
  const values = rows.flatMap((row) => {
    const description = text(row.action);
    if (!description || known.has(actionKey(description))) return [];
    known.add(actionKey(description));
    const dueDate = text(row.deadline);
    const status = text(row.status);
    return [{
      organizationId,
      description,
      responsible: text(row.responsible) ?? "To be confirmed",
      startDate: text(row.start),
      dueDate,
      resources: text(row.resources),
      expectedResult: text(row.result),
      performanceIndicator: text(row.measure),
      evidence: text(row.evidence),
      status: status && (ACTION_STATUSES as readonly string[]).includes(status) ? status : "not_started",
      milestone: milestoneForDueDate(dueDate, on),
      sourceWorksheetVersionId: latest.version.id,
      createdByUserId: ctx.principal.userId,
    }];
  });
  if (values.length) await ctx.db.insert(schema.actionItem).values(values);
  await recordTradeChange(ctx.db, ctx.principal.userId, { action: "trade.action_plan.imported", organizationId, entityType: "worksheet_version", entityId: latest.version.id, after: { imported: values.length } });
  return { imported: values.length };
}

export async function recordActionReview(ctx: Ctx, input: RecordActionReviewInput) {
  const { organizationId, access } = await organizationFor(ctx, input.organizationId);
  if (!access.write) throw new ServiceError("forbidden", "Write access required.");
  const known = new Set(ACTION_REVIEW_QUESTIONS[input.day as ActionMilestone].map((q) => q.id));
  for (const key of Object.keys(input.answers)) if (!known.has(key)) throw new ServiceError("invalid", `${key}: this review has no such question.`);
  const [row] = await ctx.db.insert(schema.actionReview).values({ organizationId, day: input.day, answers: input.answers, createdByUserId: ctx.principal.userId }).returning();
  await recordTradeChange(ctx.db, ctx.principal.userId, { action: "trade.action_review.recorded", organizationId, entityType: "action_review", entityId: row!.id, after: { day: input.day } });
  return { id: row!.id, day: row!.day as ActionMilestone, answers: row!.answers, createdAt: row!.createdAt.toISOString() };
}
