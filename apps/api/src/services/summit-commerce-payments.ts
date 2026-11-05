import { and, eq, inArray } from "drizzle-orm";
import { schema } from "@entrust/db";
import { PAYMENT_TRANSITIONS, type PaymentStatus, type PaymentSubject } from "@entrust/summit-engine";
import type { z } from "@hono/zod-openapi";
import type { EvidenceUrl, Payment, PaymentPatch } from "../schemas/summit-commerce";
import { requireStaff, type Ctx } from "./access";
import type { Executor } from "./db";
import { ServiceError } from "./errors";
import { getStorageProvider } from "./storage";
import { recordSummitChange } from "./summit-status";

// Payments for bookings, sponsorships and delegate registrations (section 12). Money arrives outside the platform (a bank
// transfer, say); an administrator records the reference, attaches the proof, checks it, and only then marks the payment
// confirmed. Nothing here marks anything paid on its own.

type PaymentRow = typeof schema.commercePayment.$inferSelect;
export type PaymentView = z.infer<typeof Payment>;

/**
 * Opens the payment for a booking, sponsorship or delegate registration, as pending. A payment that was cancelled (the
 * sponsor declined and then came back) is reopened at the new amount; any other existing payment is left as it is.
 */
export async function openPayment(
  db: Executor,
  payment: { editionId: string; subjectType: PaymentSubject; subjectId: string; amountDueCents: number },
): Promise<PaymentRow> {
  await db.insert(schema.commercePayment).values(payment).onConflictDoNothing();
  const where = and(eq(schema.commercePayment.subjectType, payment.subjectType), eq(schema.commercePayment.subjectId, payment.subjectId));
  const [row] = await db.select().from(schema.commercePayment).where(where);
  if (!row) throw new Error("The payment was not saved.");
  if (row.status !== "cancelled") return row;
  const [reopened] = await db.update(schema.commercePayment).set({ status: "pending", amountDueCents: payment.amountDueCents }).where(where).returning();
  return reopened ?? row;
}

/** A payment that was never paid is cancelled with what it was for. One already confirmed stays, for a person to refund. */
export async function cancelOpenPayment(db: Executor, subjectType: PaymentSubject, subjectId: string): Promise<void> {
  await db
    .update(schema.commercePayment)
    .set({ status: "cancelled" })
    .where(
      and(
        eq(schema.commercePayment.subjectType, subjectType),
        eq(schema.commercePayment.subjectId, subjectId),
        inArray(schema.commercePayment.status, ["pending", "awaiting_verification"]),
      ),
    );
}

export async function paymentOf(db: Executor, subjectType: PaymentSubject, subjectId: string): Promise<PaymentRow | undefined> {
  const [row] = await db
    .select()
    .from(schema.commercePayment)
    .where(and(eq(schema.commercePayment.subjectType, subjectType), eq(schema.commercePayment.subjectId, subjectId)));
  return row;
}

export async function paymentView(db: Executor, row: PaymentRow): Promise<PaymentView> {
  const [evidence] = row.evidenceFileId
    ? await db.select({ id: schema.file.id, name: schema.file.originalName }).from(schema.file).where(eq(schema.file.id, row.evidenceFileId))
    : [];
  const [verifier] = row.verifiedBy ? await db.select({ id: schema.user.id, name: schema.user.name }).from(schema.user).where(eq(schema.user.id, row.verifiedBy)) : [];
  return {
    id: row.id,
    subjectType: row.subjectType,
    subjectId: row.subjectId,
    status: row.status,
    amountDueCents: row.amountDueCents,
    amountReceivedCents: row.amountReceivedCents,
    method: row.method,
    reference: row.reference,
    evidence: evidence ?? null,
    note: row.note,
    verifiedBy: verifier ?? null,
    verifiedAt: row.verifiedAt?.toISOString() ?? null,
    updatedAt: row.updatedAt.toISOString(),
  };
}

function requirePayments(ctx: Ctx, doing: string): void {
  requireStaff(ctx.principal, ["admin", "facilitator"], doing);
}

/** The proof of payment must be a file in Entrust's own organisation, so a payment can't point at a business's private file. */
async function requireEvidenceFile(db: Executor, fileId: string): Promise<void> {
  const entrust = process.env.ENTRUST_ORG_ID;
  const [file] = await db.select({ organizationId: schema.file.organizationId }).from(schema.file).where(eq(schema.file.id, fileId));
  if (!file || !entrust || file.organizationId !== entrust) {
    throw new ServiceError("invalid", "The proof of payment must be a file uploaded to Entrust's organisation.");
  }
}

/**
 * Records what an administrator learns about a payment: its reference, method, the amount that arrived, the proof, and
 * its status. Recording a reference or proof on a pending payment moves it to "awaiting verification"; only an explicit
 * change to "confirmed" marks it paid, and that needs a reference or proof and an amount that covers what is owed. Only an
 * administrator changes what is owed.
 */
export async function updatePayment(ctx: Ctx, id: string, patch: z.infer<typeof PaymentPatch>): Promise<PaymentView> {
  requirePayments(ctx, "record payments");
  if (patch.amountDueCents !== undefined) requireStaff(ctx.principal, ["admin"], "change the amount owed");
  const row = await ctx.db.transaction(async (tx) => {
    const [current] = await tx.select().from(schema.commercePayment).where(eq(schema.commercePayment.id, id)).for("update");
    if (!current) throw new ServiceError("not_found", "No such payment.");
    if (patch.evidenceFileId) await requireEvidenceFile(tx, patch.evidenceFileId);

    const set: Partial<typeof schema.commercePayment.$inferInsert> = {};
    for (const key of ["amountDueCents", "amountReceivedCents", "method", "reference", "note", "evidenceFileId"] as const) {
      if (patch[key] !== undefined) (set as Record<string, unknown>)[key] = patch[key];
    }
    const next = { ...current, ...set };

    let status: PaymentStatus = patch.status ?? current.status;
    if (patch.status === undefined && current.status === "pending" && (set.reference || set.evidenceFileId || set.amountReceivedCents)) {
      status = "awaiting_verification";
    }
    if (status !== current.status && !PAYMENT_TRANSITIONS[current.status].includes(status)) {
      throw new ServiceError("invalid_transition", `A payment can't go from ${current.status.replaceAll("_", " ")} to ${status.replaceAll("_", " ")}.`);
    }
    if (status === "confirmed" && current.status !== "confirmed") {
      if (!next.reference && !next.evidenceFileId) throw new ServiceError("precondition_failed", "Record the payment's reference or attach the proof of payment before confirming it.");
      if (next.amountReceivedCents === null || next.amountReceivedCents < next.amountDueCents) {
        throw new ServiceError("precondition_failed", "The amount received doesn't cover the amount due. Record the amount that arrived, or change the amount due first.");
      }
      set.verifiedBy = ctx.principal.userId;
      set.verifiedAt = ctx.now;
    }
    if (status === "confirmed" && current.status === "confirmed" && (set.amountDueCents !== undefined || set.amountReceivedCents !== undefined) && next.amountReceivedCents !== null && next.amountReceivedCents < next.amountDueCents) {
      throw new ServiceError("precondition_failed", "A confirmed payment must cover what is owed.");
    }
    set.status = status;

    const changed = Object.entries(set).filter(([key, value]) => JSON.stringify((current as Record<string, unknown>)[key]) !== JSON.stringify(value));
    if (changed.length === 0) return current;
    const [updated] = await tx.update(schema.commercePayment).set(set).where(eq(schema.commercePayment.id, id)).returning();
    if (!updated) throw new Error("The payment was not saved.");
    await recordSummitChange(tx, ctx.principal.userId, {
      action: "summit.commerce.payment.updated",
      entityType: "commerce_payment",
      entityId: id,
      organizationId: null,
      before: Object.fromEntries(changed.map(([key]) => [key, (current as Record<string, unknown>)[key]])),
      after: Object.fromEntries(changed),
    });
    return updated;
  });
  return paymentView(ctx.db, row);
}

/** A short-lived link to the proof of payment, for an administrator to review. */
export async function evidenceUrl(ctx: Ctx, id: string): Promise<z.infer<typeof EvidenceUrl>> {
  requirePayments(ctx, "review proof of payment");
  const [row] = await ctx.db
    .select({ storageKey: schema.file.storageKey, fileName: schema.file.originalName, contentType: schema.file.contentType })
    .from(schema.commercePayment)
    .innerJoin(schema.file, eq(schema.file.id, schema.commercePayment.evidenceFileId))
    .where(eq(schema.commercePayment.id, id));
  if (!row) throw new ServiceError("not_found", "This payment has no proof attached.");
  const expiresInSeconds = 900;
  const downloadUrl = await getStorageProvider().createPresignedDownloadUrl(row.storageKey, row.fileName, expiresInSeconds, row.contentType);
  return { downloadUrl, expiresInSeconds, fileName: row.fileName, contentType: row.contentType };
}
