import { and, asc, count, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { schema } from "@entrust/db";
import {
  ENQUIRY_OPEN,
  ENQUIRY_STATUSES,
  ENQUIRY_TRANSITIONS,
  availability,
  productPriceLabel,
  type EnquiryStatus,
} from "@entrust/summit-engine";
import type { z } from "@hono/zod-openapi";
import type {
  EnquiryDetail,
  EnquiryList,
  EnquiryPatch,
  EnquiryQuery,
  EnquiryStatusBody,
  SponsorEnquiryBody,
  SponsorEnquiryReceipt,
} from "../schemas/summit-commerce";
import { requireStaff, type Ctx } from "./access";
import type { Executor } from "./db";
import { ServiceError } from "./errors";
import { currentEdition } from "./summit-commerce";
import { confirmedSponsors } from "./summit-commerce-inventory";
import { amountText, firstName, paymentParagraphs, sendNotice, siteUrl } from "./summit-commerce-mail";
import { cancelOpenPayment, openPayment, paymentOf, paymentView } from "./summit-commerce-payments";
import { recordSummitChange } from "./summit-status";

// Sponsorship and opportunity enquiries (section 7): the public form records one, and the organisers take it through the
// pipeline (new, contacted, negotiation, proposal sent, confirmed or declined). Confirming makes the organisation a
// sponsor and opens a payment for what the sponsorship is worth.

type EnquiryRow = typeof schema.sponsorEnquiry.$inferSelect;
type Detail = z.infer<typeof EnquiryDetail>;
type List = z.infer<typeof EnquiryList>;
type Receipt = z.infer<typeof SponsorEnquiryReceipt>;

const RECEIPT_WINDOW_MS = 24 * 60 * 60 * 1000;
const SPONSORED_KINDS = ["sponsorship_level", "opportunity"] as const;

function requireHandler(ctx: Ctx, doing: string): void {
  requireStaff(ctx.principal, ["admin", "facilitator"], doing);
}

// ---- The public form ----

/**
 * Records an enquiry and emails a receipt. A second enquiry from the same address for the same level or opportunity
 * replaces the first while it is new and otherwise returns the existing reference, so a conversation under way isn't
 * rewritten from the public form. A form whose trap field is filled in is answered as if it worked and stored nowhere.
 */
export async function submitEnquiry(ctx: Pick<Ctx, "db" | "now">, body: z.infer<typeof SponsorEnquiryBody>): Promise<Receipt> {
  if (body.nickname) return { number: "SPN-0000", productName: "", price: "" };

  const edition = await currentEdition(ctx.db);
  if (!edition) throw new ServiceError("not_found", "Sponsorship enquiries are not open yet.");
  const [product] = await ctx.db
    .select()
    .from(schema.commerceProduct)
    .where(
      and(
        eq(schema.commerceProduct.editionId, edition.id),
        eq(schema.commerceProduct.slug, body.productSlug),
        inArray(schema.commerceProduct.kind, [...SPONSORED_KINDS]),
        eq(schema.commerceProduct.status, "published"),
      ),
    );
  if (!product) throw new ServiceError("not_found", "That sponsorship level or opportunity doesn't exist.");
  const taken = await confirmedSponsors(ctx.db, product.id);
  if (availability({ capacity: product.capacity, taken, markedSoldOut: product.markedSoldOut }).soldOut) {
    throw new ServiceError("precondition_failed", `${product.name} is no longer available. Please choose another option or contact the ADTIS secretariat.`);
  }

  const email = body.email.toLowerCase();
  const details = {
    organisationName: body.organisationName,
    country: body.country,
    contactName: body.contactName,
    position: body.position,
    email,
    phone: body.phone,
    sector: body.sector,
    objectives: body.objectives,
    requirements: body.requirements || null,
    consentedAt: ctx.now,
  };

  const row = await ctx.db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(schema.sponsorEnquiry)
      .where(
        and(
          eq(schema.sponsorEnquiry.productId, product.id),
          eq(schema.sponsorEnquiry.email, email),
          inArray(schema.sponsorEnquiry.status, [...ENQUIRY_OPEN, "confirmed"]),
        ),
      )
      .for("update");
    if (existing?.status === "new") {
      const [updated] = await tx.update(schema.sponsorEnquiry).set(details).where(eq(schema.sponsorEnquiry.id, existing.id)).returning();
      return updated ?? existing;
    }
    if (existing) return existing;
    const [created] = await tx
      .insert(schema.sponsorEnquiry)
      .values({ ...details, editionId: edition.id, productId: product.id, valueCents: product.priceCents })
      .returning();
    if (!created) throw new Error("The enquiry was not saved.");
    await recordSummitChange(tx, null, {
      action: "summit.commerce.enquiry.submitted",
      entityType: "sponsor_enquiry",
      entityId: created.id,
      organizationId: null,
      after: { number: created.number, product: product.slug, organisation: created.organisationName, valueCents: created.valueCents },
    });
    return created;
  });

  if (!row.receiptSentAt || ctx.now.getTime() - row.receiptSentAt.getTime() >= RECEIPT_WINDOW_MS) {
    const queued = await sendNotice({
      to: row.email,
      subject: `We have your ADTIS sponsorship enquiry ${row.number}`,
      heading: "We have your enquiry",
      greeting: `Hello ${firstName(row.contactName)},`,
      paragraphs: [
        `Thank you for your interest in partnering with the Africa Diaspora Trade & Investment Summit. A member of the ADTIS team will contact you about ${product.name} for ${row.organisationName}.`,
        "Nothing is due and nothing is reserved yet. Sponsorship benefits are confirmed in a signed sponsorship agreement.",
      ],
      details: [
        { label: "Reference", value: row.number },
        { label: "Interested in", value: product.name },
        { label: "Listed price", value: `${product.attributes.priceRange?.trim() || amountText(product.priceCents)} (USD)` },
      ],
    });
    if (queued) await ctx.db.update(schema.sponsorEnquiry).set({ receiptSentAt: ctx.now }).where(eq(schema.sponsorEnquiry.id, row.id));
  }
  return { number: row.number, productName: product.name, price: productPriceLabel(product.priceCents, product.attributes) };
}

// ---- Reading ----

const itemFields = {
  id: schema.sponsorEnquiry.id,
  number: schema.sponsorEnquiry.number,
  status: schema.sponsorEnquiry.status,
  productId: schema.sponsorEnquiry.productId,
  productName: schema.commerceProduct.name,
  productKind: schema.commerceProduct.kind,
  organisationName: schema.sponsorEnquiry.organisationName,
  country: schema.sponsorEnquiry.country,
  contactName: schema.sponsorEnquiry.contactName,
  email: schema.sponsorEnquiry.email,
  sector: schema.sponsorEnquiry.sector,
  valueCents: schema.sponsorEnquiry.valueCents,
  paymentStatus: schema.commercePayment.status,
  createdAt: schema.sponsorEnquiry.createdAt,
  statusChangedAt: schema.sponsorEnquiry.statusChangedAt,
};

const joined = (db: Executor) =>
  db
    .select(itemFields)
    .from(schema.sponsorEnquiry)
    .innerJoin(schema.commerceProduct, eq(schema.commerceProduct.id, schema.sponsorEnquiry.productId))
    .leftJoin(schema.commercePayment, and(eq(schema.commercePayment.subjectType, sql`'sponsorship'`), eq(schema.commercePayment.subjectId, schema.sponsorEnquiry.id)));

const toItem = (row: Awaited<ReturnType<typeof joined>>[number]) => ({
  ...row,
  createdAt: row.createdAt.toISOString(),
  statusChangedAt: row.statusChangedAt.toISOString(),
});

export async function listEnquiries(ctx: Ctx, query: z.infer<typeof EnquiryQuery>): Promise<List> {
  requireHandler(ctx, "list sponsorship enquiries");
  const editionId = query.editionId ?? (await currentEdition(ctx.db))?.id;
  const none = { items: [], total: 0, byStatus: {}, pipeline: { openCount: 0, openValueCents: 0, confirmedCount: 0, confirmedValueCents: 0 } };
  if (!editionId) return none;
  const search = query.q ? `%${query.q.replace(/[\\%_]/g, (m) => `\\${m}`)}%` : null;
  const where = and(
    eq(schema.sponsorEnquiry.editionId, editionId),
    query.status ? eq(schema.sponsorEnquiry.status, query.status) : undefined,
    query.productId ? eq(schema.sponsorEnquiry.productId, query.productId) : undefined,
    query.kind ? eq(schema.commerceProduct.kind, query.kind) : undefined,
    search
      ? or(
          ilike(schema.sponsorEnquiry.organisationName, search),
          ilike(schema.sponsorEnquiry.contactName, search),
          ilike(schema.sponsorEnquiry.email, search),
          ilike(schema.sponsorEnquiry.number, search),
        )
      : undefined,
  );
  const [rows, [filtered], perStatus] = await Promise.all([
    joined(ctx.db).where(where).orderBy(desc(schema.sponsorEnquiry.createdAt), desc(schema.sponsorEnquiry.id)).limit(query.limit).offset(query.offset),
    ctx.db
      .select({ n: count() })
      .from(schema.sponsorEnquiry)
      .innerJoin(schema.commerceProduct, eq(schema.commerceProduct.id, schema.sponsorEnquiry.productId))
      .where(where),
    ctx.db
      .select({ status: schema.sponsorEnquiry.status, n: count(), value: sql<string>`coalesce(sum(${schema.sponsorEnquiry.valueCents}), 0)` })
      .from(schema.sponsorEnquiry)
      .where(eq(schema.sponsorEnquiry.editionId, editionId))
      .groupBy(schema.sponsorEnquiry.status),
  ]);
  const sum = (statuses: readonly EnquiryStatus[], field: "n" | "value") =>
    perStatus.filter((r) => statuses.includes(r.status)).reduce((total, r) => total + Number(r[field]), 0);
  return {
    items: rows.map(toItem),
    total: filtered?.n ?? 0,
    byStatus: Object.fromEntries(ENQUIRY_STATUSES.map((s) => [s, perStatus.find((r) => r.status === s)?.n ?? 0])),
    pipeline: {
      openCount: sum(ENQUIRY_OPEN, "n"),
      openValueCents: sum(ENQUIRY_OPEN, "value"),
      confirmedCount: sum(["confirmed"], "n"),
      confirmedValueCents: sum(["confirmed"], "value"),
    },
  };
}

async function loadEnquiry(db: Executor, id: string, lock = false): Promise<EnquiryRow> {
  const query = db.select().from(schema.sponsorEnquiry).where(eq(schema.sponsorEnquiry.id, id));
  const [row] = lock ? await query.for("update") : await query;
  if (!row) throw new ServiceError("not_found", "No such sponsorship enquiry.");
  return row;
}

async function detail(db: Executor, row: EnquiryRow): Promise<Detail> {
  const [[item], paymentRow, changes] = await Promise.all([
    joined(db).where(eq(schema.sponsorEnquiry.id, row.id)),
    paymentOf(db, "sponsorship", row.id),
    db
      .select({
        at: schema.auditLog.occurredAt,
        by: schema.user.name,
        before: schema.auditLog.before,
        after: schema.auditLog.after,
        reason: schema.auditLog.reason,
      })
      .from(schema.auditLog)
      .leftJoin(schema.user, eq(schema.user.id, schema.auditLog.actorUserId))
      .where(and(eq(schema.auditLog.entityId, row.id), eq(schema.auditLog.action, "summit.commerce.enquiry.status")))
      .orderBy(asc(schema.auditLog.occurredAt)),
  ]);
  if (!item) throw new Error("An enquiry lost its product.");
  return {
    ...toItem(item),
    position: row.position,
    phone: row.phone,
    objectives: row.objectives,
    requirements: row.requirements,
    notes: row.notes,
    payment: paymentRow ? await paymentView(db, paymentRow) : null,
    history: changes.map((c) => ({
      at: c.at.toISOString(),
      by: c.by,
      from: (c.before as { status?: EnquiryStatus } | null)?.status ?? null,
      to: (c.after as { status: EnquiryStatus }).status,
      note: c.reason,
    })),
  };
}

export async function getEnquiry(ctx: Ctx, id: string): Promise<Detail> {
  requireHandler(ctx, "see a sponsorship enquiry");
  return detail(ctx.db, await loadEnquiry(ctx.db, id));
}

// ---- Working the pipeline ----

/** Records what was agreed (the value of the sponsorship) and the organisers' notes. */
export async function updateEnquiry(ctx: Ctx, id: string, patch: z.infer<typeof EnquiryPatch>): Promise<Detail> {
  requireHandler(ctx, "change a sponsorship enquiry");
  const row = await ctx.db.transaction(async (tx) => {
    const current = await loadEnquiry(tx, id, true);
    if (patch.valueCents !== undefined && current.status === "confirmed") {
      throw new ServiceError("precondition_failed", "This sponsorship is confirmed. Change the amount owed on its payment instead.");
    }
    const set: Partial<typeof schema.sponsorEnquiry.$inferInsert> = {};
    if (patch.valueCents !== undefined) set.valueCents = patch.valueCents;
    if (patch.notes !== undefined) set.notes = patch.notes;
    const changed = Object.entries(set).filter(([key, value]) => (current as Record<string, unknown>)[key] !== value);
    if (changed.length === 0) return current;
    const [updated] = await tx.update(schema.sponsorEnquiry).set(set).where(eq(schema.sponsorEnquiry.id, id)).returning();
    if (!updated) throw new Error("The enquiry was not saved.");
    await recordSummitChange(tx, ctx.principal.userId, {
      action: "summit.commerce.enquiry.updated",
      entityType: "sponsor_enquiry",
      entityId: id,
      organizationId: null,
      before: Object.fromEntries(changed.map(([key]) => [key, key === "notes" ? "(notes)" : (current as Record<string, unknown>)[key]])),
      after: Object.fromEntries(changed.map(([key, value]) => [key, key === "notes" ? "(notes)" : value])),
    });
    return updated;
  });
  return detail(ctx.db, row);
}

/**
 * Moves an enquiry along the pipeline. Confirming makes the organisation a sponsor: it is refused when the level's
 * capacity (a title partner's exclusivity, say) is already taken, and it opens a payment for the enquiry's value and emails
 * the payment instructions. Declining cancels a payment that was never paid.
 */
export async function changeEnquiryStatus(ctx: Ctx, id: string, body: z.infer<typeof EnquiryStatusBody>): Promise<Detail> {
  requireHandler(ctx, "move a sponsorship enquiry");
  const { row, edition, productName } = await ctx.db.transaction(async (tx) => {
    const [peek] = await tx.select({ productId: schema.sponsorEnquiry.productId }).from(schema.sponsorEnquiry).where(eq(schema.sponsorEnquiry.id, id));
    if (!peek) throw new ServiceError("not_found", "No such sponsorship enquiry.");
    // The product is locked first, so two confirmations for a single exclusive place can't both pass the count.
    const [product] = await tx.select().from(schema.commerceProduct).where(eq(schema.commerceProduct.id, peek.productId)).for("update");
    if (!product) throw new Error("An enquiry lost its product.");
    const current = await loadEnquiry(tx, id, true);
    if (body.status === current.status) throw new ServiceError("invalid_transition", `This enquiry is already ${current.status.replaceAll("_", " ")}.`);
    if (!ENQUIRY_TRANSITIONS[current.status].includes(body.status)) {
      throw new ServiceError("invalid_transition", `An enquiry can't go from ${current.status.replaceAll("_", " ")} to ${body.status.replaceAll("_", " ")}.`);
    }
    if (body.status === "confirmed") {
      const taken = await confirmedSponsors(tx, product.id, current.id);
      if (availability({ capacity: product.capacity, taken, markedSoldOut: product.markedSoldOut }).soldOut) {
        throw new ServiceError("precondition_failed", `${product.name} has no place left to confirm this sponsor in.`);
      }
    }
    const [updated] = await tx
      .update(schema.sponsorEnquiry)
      .set({ status: body.status, statusChangedAt: ctx.now })
      .where(eq(schema.sponsorEnquiry.id, id))
      .returning();
    if (!updated) throw new Error("The enquiry was not saved.");
    if (body.status === "confirmed") {
      await openPayment(tx, { editionId: updated.editionId, subjectType: "sponsorship", subjectId: updated.id, amountDueCents: updated.valueCents });
    }
    if (body.status === "declined") await cancelOpenPayment(tx, "sponsorship", id);
    await recordSummitChange(tx, ctx.principal.userId, {
      action: "summit.commerce.enquiry.status",
      entityType: "sponsor_enquiry",
      entityId: id,
      organizationId: null,
      before: { status: current.status },
      after: { status: body.status },
      reason: body.note ?? null,
    });
    const [edition] = await tx.select().from(schema.commerceEdition).where(eq(schema.commerceEdition.id, updated.editionId));
    if (!edition) throw new Error("An enquiry lost its edition.");
    return { row: updated, edition, productName: product.name };
  });

  if (row.status === "confirmed") {
    const site = siteUrl();
    await sendNotice({
      to: row.email,
      subject: `Your ADTIS sponsorship is confirmed (${row.number})`,
      heading: "Thank you for sponsoring ADTIS",
      greeting: `Hello ${firstName(row.contactName)},`,
      paragraphs: [
        `We are delighted to confirm ${row.organisationName} as a sponsor of ${edition.name}: ${productName}. The benefits, and any category exclusivity, are set out in the sponsorship agreement, which takes effect when it is signed.`,
        ...paymentParagraphs(edition.paymentMethods, row.number),
        edition.taxNote,
      ],
      details: [
        { label: "Reference", value: row.number },
        { label: "Sponsorship", value: productName },
        { label: "Amount due", value: `${amountText(row.valueCents)} (USD)` },
      ],
      ...(site ? { action: { label: "Visit the ADTIS site", url: site } } : {}),
    });
  }
  return detail(ctx.db, row);
}
