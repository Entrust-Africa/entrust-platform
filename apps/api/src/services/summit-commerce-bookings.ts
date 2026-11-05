import { and, count, desc, eq, ilike, inArray, ne, or, sql } from "drizzle-orm";
import { schema } from "@entrust/db";
import {
  BOOKING_HOLDS_BOOTH,
  BOOKING_OPEN,
  BOOKING_STATUSES,
  BOOKING_TRANSITIONS,
  availability,
  confirmationBlockers,
  priceLabel,
  type BookingStatus,
} from "@entrust/summit-engine";
import type { z } from "@hono/zod-openapi";
import type {
  AllocationBody,
  ApproveBody,
  BookingDetail,
  BookingList,
  BookingQuery,
  ExhibitorApplicationBody,
  ExhibitorApplicationReceipt,
  ReasonBody,
} from "../schemas/summit-commerce";
import { requireStaff, type Ctx } from "./access";
import type { Executor } from "./db";
import { ServiceError } from "./errors";
import { currentEdition } from "./summit-commerce";
import { heldBooths } from "./summit-commerce-inventory";
import { amountText, firstName, paymentParagraphs, sendNotice, siteUrl } from "./summit-commerce-mail";
import { cancelOpenPayment, openPayment, paymentOf, paymentView } from "./summit-commerce-payments";
import { recordSummitChange } from "./summit-status";

// Exhibitor bookings (section 6): an exhibitor applies on the public form; an administrator approves (which holds a booth
// and asks for payment), someone verifies the payment, and an administrator confirms the booth. Nothing moves on its own.

type BookingRow = typeof schema.exhibitorBooking.$inferSelect;
type Detail = z.infer<typeof BookingDetail>;
type List = z.infer<typeof BookingList>;
type Receipt = z.infer<typeof ExhibitorApplicationReceipt>;

/** A repeat submission gets no second receipt inside this window, so the form can't be used to flood an inbox. */
const RECEIPT_WINDOW_MS = 24 * 60 * 60 * 1000;

function requireHandler(ctx: Ctx, doing: string): void {
  requireStaff(ctx.principal, ["admin", "facilitator"], doing);
}

// ---- The public application ----

/**
 * Records an application for exhibition space and emails a receipt. It holds no booth: only an approval does. A second
 * application from the same address for the same package replaces the first while it is still waiting (the applicant fixing
 * a mistake) and otherwise returns the existing reference unchanged, so approved details can't be rewritten from the
 * public form. A package that is sold out takes no applications. A form whose trap field is filled in is answered as if it
 * worked and stored nowhere.
 */
export async function applyForBooth(ctx: Pick<Ctx, "db" | "now">, body: z.infer<typeof ExhibitorApplicationBody>): Promise<Receipt> {
  if (body.nickname) return { number: "EXH-0000", packageName: "", amountCents: 0, price: "" };

  const edition = await currentEdition(ctx.db);
  if (!edition) throw new ServiceError("not_found", "Exhibition applications are not open yet.");
  const [product] = await ctx.db
    .select()
    .from(schema.commerceProduct)
    .where(
      and(
        eq(schema.commerceProduct.editionId, edition.id),
        eq(schema.commerceProduct.slug, body.packageSlug),
        eq(schema.commerceProduct.kind, "exhibition_package"),
        eq(schema.commerceProduct.status, "published"),
      ),
    );
  if (!product) throw new ServiceError("not_found", "That exhibition package doesn't exist.");
  const held = await heldBooths(ctx.db, product.id);
  if (availability({ capacity: product.capacity, taken: held, markedSoldOut: product.markedSoldOut }).soldOut) {
    throw new ServiceError("precondition_failed", `${product.name} is sold out. Please choose another package or contact the ADTIS secretariat.`);
  }

  const email = body.email.toLowerCase();
  const details = {
    companyName: body.companyName,
    country: body.country,
    registrationDetails: body.registrationDetails,
    contactName: body.contactName,
    position: body.position,
    email,
    phone: body.phone,
    sector: body.sector,
    productsServices: body.productsServices,
    website: body.website || null,
    preferredZone: body.preferredZone || null,
    boothRequirements: body.boothRequirements || null,
    comments: body.comments || null,
    consentedAt: ctx.now,
  };

  const row = await ctx.db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(schema.exhibitorBooking)
      .where(
        and(
          eq(schema.exhibitorBooking.productId, product.id),
          eq(schema.exhibitorBooking.email, email),
          inArray(schema.exhibitorBooking.status, [...BOOKING_OPEN]),
        ),
      )
      .for("update");
    if (existing?.status === "submitted") {
      const [updated] = await tx.update(schema.exhibitorBooking).set(details).where(eq(schema.exhibitorBooking.id, existing.id)).returning();
      return updated ?? existing;
    }
    if (existing) return existing;
    const [created] = await tx
      .insert(schema.exhibitorBooking)
      .values({ ...details, editionId: edition.id, productId: product.id, amountCents: product.priceCents })
      .returning();
    if (!created) throw new Error("The application was not saved.");
    await recordSummitChange(tx, null, {
      action: "summit.commerce.booking.submitted",
      entityType: "exhibitor_booking",
      entityId: created.id,
      organizationId: null,
      after: { number: created.number, package: product.slug, company: created.companyName, amountCents: created.amountCents },
    });
    return created;
  });

  await sendReceipt(ctx, row, product.name);
  return { number: row.number, packageName: product.name, amountCents: row.amountCents, price: priceLabel(row.amountCents) };
}

async function sendReceipt(ctx: Pick<Ctx, "db" | "now">, row: BookingRow, packageName: string): Promise<void> {
  if (row.receiptSentAt && ctx.now.getTime() - row.receiptSentAt.getTime() < RECEIPT_WINDOW_MS) return;
  const queued = await sendNotice({
    to: row.email,
    subject: `We have your ADTIS exhibition application ${row.number}`,
    heading: "We have your application",
    greeting: `Hello ${firstName(row.contactName)},`,
    paragraphs: [
      `Thank you for applying to exhibit at the Africa Diaspora Trade & Investment Summit. The ADTIS team will review your application for ${row.companyName}.`,
      "No booth is reserved yet, and nothing is due. If your application is approved we will email you the payment instructions; your booth is confirmed once the payment has been verified.",
    ],
    details: [
      { label: "Reference", value: row.number },
      { label: "Package", value: packageName },
      { label: "Price", value: `${amountText(row.amountCents)} (USD)` },
    ],
  });
  if (queued) await ctx.db.update(schema.exhibitorBooking).set({ receiptSentAt: ctx.now }).where(eq(schema.exhibitorBooking.id, row.id));
}

// ---- Reading ----

const itemFields = {
  id: schema.exhibitorBooking.id,
  number: schema.exhibitorBooking.number,
  status: schema.exhibitorBooking.status,
  productId: schema.exhibitorBooking.productId,
  packageName: schema.commerceProduct.name,
  packageSlug: schema.commerceProduct.slug,
  companyName: schema.exhibitorBooking.companyName,
  country: schema.exhibitorBooking.country,
  sector: schema.exhibitorBooking.sector,
  contactName: schema.exhibitorBooking.contactName,
  email: schema.exhibitorBooking.email,
  phone: schema.exhibitorBooking.phone,
  amountCents: schema.exhibitorBooking.amountCents,
  boothNumber: schema.exhibitorBooking.boothNumber,
  zone: schema.exhibitorBooking.zone,
  paymentStatus: schema.commercePayment.status,
  createdAt: schema.exhibitorBooking.createdAt,
  decidedAt: schema.exhibitorBooking.decidedAt,
};

const joined = (db: Executor) =>
  db
    .select(itemFields)
    .from(schema.exhibitorBooking)
    .innerJoin(schema.commerceProduct, eq(schema.commerceProduct.id, schema.exhibitorBooking.productId))
    .leftJoin(
      schema.commercePayment,
      and(eq(schema.commercePayment.subjectType, sql`'exhibitor_booking'`), eq(schema.commercePayment.subjectId, schema.exhibitorBooking.id)),
    );

const toItem = (row: Awaited<ReturnType<typeof joined>>[number]) => ({
  ...row,
  createdAt: row.createdAt.toISOString(),
  decidedAt: row.decidedAt?.toISOString() ?? null,
});

export async function listBookings(ctx: Ctx, query: z.infer<typeof BookingQuery>): Promise<List> {
  requireHandler(ctx, "list exhibitor bookings");
  const editionId = query.editionId ?? (await currentEdition(ctx.db))?.id;
  if (!editionId) return { items: [], total: 0, byStatus: {} };
  const search = query.q ? `%${query.q.replace(/[\\%_]/g, (m) => `\\${m}`)}%` : null;
  const where = and(
    eq(schema.exhibitorBooking.editionId, editionId),
    query.status ? eq(schema.exhibitorBooking.status, query.status) : undefined,
    query.productId ? eq(schema.exhibitorBooking.productId, query.productId) : undefined,
    search
      ? or(
          ilike(schema.exhibitorBooking.companyName, search),
          ilike(schema.exhibitorBooking.contactName, search),
          ilike(schema.exhibitorBooking.email, search),
          ilike(schema.exhibitorBooking.number, search),
        )
      : undefined,
  );
  const [rows, [filtered], perStatus] = await Promise.all([
    joined(ctx.db).where(where).orderBy(desc(schema.exhibitorBooking.createdAt), desc(schema.exhibitorBooking.id)).limit(query.limit).offset(query.offset),
    ctx.db.select({ n: count() }).from(schema.exhibitorBooking).where(where),
    ctx.db
      .select({ status: schema.exhibitorBooking.status, n: count() })
      .from(schema.exhibitorBooking)
      .where(eq(schema.exhibitorBooking.editionId, editionId))
      .groupBy(schema.exhibitorBooking.status),
  ]);
  return {
    items: rows.map(toItem),
    total: filtered?.n ?? 0,
    byStatus: Object.fromEntries(BOOKING_STATUSES.map((s) => [s, perStatus.find((r) => r.status === s)?.n ?? 0])),
  };
}

async function loadBooking(db: Executor, id: string, lock = false): Promise<BookingRow> {
  const query = db.select().from(schema.exhibitorBooking).where(eq(schema.exhibitorBooking.id, id));
  const [row] = lock ? await query.for("update") : await query;
  if (!row) throw new ServiceError("not_found", "No such exhibitor booking.");
  return row;
}

async function detail(db: Executor, row: BookingRow): Promise<Detail> {
  const [[item], [product], paymentRow, [decider]] = await Promise.all([
    joined(db).where(eq(schema.exhibitorBooking.id, row.id)),
    db.select().from(schema.commerceProduct).where(eq(schema.commerceProduct.id, row.productId)),
    paymentOf(db, "exhibitor_booking", row.id),
    row.decidedBy ? db.select({ id: schema.user.id, name: schema.user.name }).from(schema.user).where(eq(schema.user.id, row.decidedBy)) : Promise.resolve([]),
  ]);
  if (!item || !product) throw new Error("A booking lost its package.");
  const taken = await heldBooths(db, product.id);
  const { remaining, soldOut } = availability({ capacity: product.capacity, taken, markedSoldOut: product.markedSoldOut });
  return {
    ...toItem(item),
    registrationDetails: row.registrationDetails,
    position: row.position,
    productsServices: row.productsServices,
    website: row.website,
    preferredZone: row.preferredZone,
    boothRequirements: row.boothRequirements,
    comments: row.comments,
    decisionNote: row.decisionNote,
    decidedBy: decider ?? null,
    confirmedAt: row.confirmedAt?.toISOString() ?? null,
    payment: paymentRow ? await paymentView(db, paymentRow) : null,
    blockers: confirmationBlockers(row, paymentRow?.status ?? null),
    packageAvailability: { remaining, soldOut },
  };
}

export async function getBooking(ctx: Ctx, id: string): Promise<Detail> {
  requireHandler(ctx, "see an exhibitor booking");
  return detail(ctx.db, await loadBooking(ctx.db, id));
}

// ---- Decisions ----

function requireMove(row: BookingRow, to: BookingStatus): void {
  if (!BOOKING_TRANSITIONS[row.status].includes(to)) {
    throw new ServiceError("invalid_transition", `A booking can't go from ${row.status} to ${to}.`);
  }
}

/** A booth number belongs to one held booking of the edition. */
async function requireFreeBooth(db: Executor, row: BookingRow, boothNumber: string): Promise<void> {
  const [clash] = await db
    .select({ number: schema.exhibitorBooking.number })
    .from(schema.exhibitorBooking)
    .where(
      and(
        eq(schema.exhibitorBooking.editionId, row.editionId),
        eq(schema.exhibitorBooking.boothNumber, boothNumber),
        inArray(schema.exhibitorBooking.status, [...BOOKING_HOLDS_BOOTH]),
        ne(schema.exhibitorBooking.id, row.id),
      ),
    );
  if (clash) throw new ServiceError("invalid", `Booth ${boothNumber} is already given to ${clash.number}.`);
}

async function requireKnownZone(db: Executor, editionId: string, zone: string): Promise<void> {
  const [edition] = await db.select({ zones: schema.commerceEdition.exhibitionZones }).from(schema.commerceEdition).where(eq(schema.commerceEdition.id, editionId));
  if (edition && edition.zones.length > 0 && !edition.zones.includes(zone)) {
    throw new ServiceError("invalid", `"${zone}" isn't one of this edition's zones (${edition.zones.join(", ")}).`);
  }
}

/**
 * Approves an application: the booth is held against the package's capacity, a payment is opened for the price the
 * applicant applied at, and the applicant is emailed the payment instructions. An approval is refused when the package has
 * no booth left or is marked sold out.
 */
export async function approveBooking(ctx: Ctx, id: string, body: z.infer<typeof ApproveBody>): Promise<Detail> {
  requireHandler(ctx, "approve an exhibitor application");
  const { row, edition, packageName } = await ctx.db.transaction(async (tx) => {
    // The package row is locked first, so two approvals for its last booth can't both pass the count.
    const [peek] = await tx.select({ productId: schema.exhibitorBooking.productId }).from(schema.exhibitorBooking).where(eq(schema.exhibitorBooking.id, id));
    if (!peek) throw new ServiceError("not_found", "No such exhibitor booking.");
    const [product] = await tx.select().from(schema.commerceProduct).where(eq(schema.commerceProduct.id, peek.productId)).for("update");
    const current = await loadBooking(tx, id, true);
    requireMove(current, "approved");
    if (!product) throw new Error("A booking lost its package.");
    const held = await heldBooths(tx, product.id, current.id);
    if (availability({ capacity: product.capacity, taken: held, markedSoldOut: product.markedSoldOut }).soldOut) {
      throw new ServiceError("precondition_failed", `${product.name} has no booth left to approve this application for.`);
    }
    if (body.boothNumber) await requireFreeBooth(tx, current, body.boothNumber);
    if (body.zone) await requireKnownZone(tx, current.editionId, body.zone);

    const [updated] = await tx
      .update(schema.exhibitorBooking)
      .set({
        status: "approved",
        decidedBy: ctx.principal.userId,
        decidedAt: ctx.now,
        decisionNote: body.note || null,
        ...(body.boothNumber ? { boothNumber: body.boothNumber } : {}),
        ...(body.zone ? { zone: body.zone } : {}),
      })
      .where(eq(schema.exhibitorBooking.id, id))
      .returning();
    if (!updated) throw new Error("The booking was not saved.");
    await openPayment(tx, { editionId: updated.editionId, subjectType: "exhibitor_booking", subjectId: updated.id, amountDueCents: updated.amountCents });
    await recordSummitChange(tx, ctx.principal.userId, {
      action: "summit.commerce.booking.approved",
      entityType: "exhibitor_booking",
      entityId: id,
      organizationId: null,
      before: { status: current.status },
      after: { status: "approved", boothNumber: updated.boothNumber, zone: updated.zone },
      reason: body.note || null,
    });
    const [edition] = await tx.select().from(schema.commerceEdition).where(eq(schema.commerceEdition.id, updated.editionId));
    if (!edition) throw new Error("A booking lost its edition.");
    return { row: updated, edition, packageName: product.name };
  });

  await sendNotice({
    to: row.email,
    subject: `Your ADTIS exhibition application ${row.number} is approved`,
    heading: "Your application is approved",
    greeting: `Hello ${firstName(row.contactName)},`,
    paragraphs: [
      `Good news: your application to exhibit at ${edition.name} has been approved, and a ${packageName} is being held for ${row.companyName}.`,
      ...(row.decisionNote ? [row.decisionNote] : []),
      ...paymentParagraphs(edition.paymentMethods, row.number),
      edition.taxNote,
    ],
    details: [
      { label: "Reference", value: row.number },
      { label: "Package", value: packageName },
      { label: "Amount due", value: `${amountText(row.amountCents)} (USD)` },
    ],
  });
  return detail(ctx.db, row);
}

export async function rejectBooking(ctx: Ctx, id: string, body: z.infer<typeof ReasonBody>): Promise<Detail> {
  requireHandler(ctx, "reject an exhibitor application");
  const { row, wasHolding } = await ctx.db.transaction(async (tx) => {
    const current = await loadBooking(tx, id, true);
    requireMove(current, "rejected");
    const [updated] = await tx
      .update(schema.exhibitorBooking)
      .set({ status: "rejected", decidedBy: ctx.principal.userId, decidedAt: ctx.now, decisionNote: body.reason, boothNumber: null, zone: null })
      .where(eq(schema.exhibitorBooking.id, id))
      .returning();
    if (!updated) throw new Error("The booking was not saved.");
    await cancelOpenPayment(tx, "exhibitor_booking", id);
    await recordSummitChange(tx, ctx.principal.userId, {
      action: "summit.commerce.booking.rejected",
      entityType: "exhibitor_booking",
      entityId: id,
      organizationId: null,
      before: { status: current.status },
      after: { status: "rejected" },
      reason: body.reason,
    });
    return { row: updated, wasHolding: BOOKING_HOLDS_BOOTH.includes(current.status) };
  });
  await sendNotice({
    to: row.email,
    subject: `About your ADTIS exhibition application ${row.number}`,
    heading: "About your application",
    greeting: `Hello ${firstName(row.contactName)},`,
    paragraphs: [
      `Thank you for your interest in exhibiting at the Africa Diaspora Trade & Investment Summit. We are unable to offer ${row.companyName} exhibition space${wasHolding ? ", and the booth we were holding has been released" : ""}.`,
      `Reason given: ${body.reason}`,
      "If you have questions, please reply to this email or contact the ADTIS secretariat.",
    ],
    details: [{ label: "Reference", value: row.number }],
  });
  return detail(ctx.db, row);
}

export async function cancelBooking(ctx: Ctx, id: string, body: z.infer<typeof ReasonBody>): Promise<Detail> {
  requireHandler(ctx, "cancel an exhibitor booking");
  const { row, wasHolding } = await ctx.db.transaction(async (tx) => {
    const current = await loadBooking(tx, id, true);
    requireMove(current, "cancelled");
    const [updated] = await tx
      .update(schema.exhibitorBooking)
      .set({ status: "cancelled", decisionNote: body.reason })
      .where(eq(schema.exhibitorBooking.id, id))
      .returning();
    if (!updated) throw new Error("The booking was not saved.");
    await cancelOpenPayment(tx, "exhibitor_booking", id);
    await recordSummitChange(tx, ctx.principal.userId, {
      action: "summit.commerce.booking.cancelled",
      entityType: "exhibitor_booking",
      entityId: id,
      organizationId: null,
      before: { status: current.status },
      after: { status: "cancelled" },
      reason: body.reason,
    });
    return { row: updated, wasHolding: BOOKING_HOLDS_BOOTH.includes(current.status) };
  });
  if (wasHolding) {
    await sendNotice({
      to: row.email,
      subject: `Your ADTIS exhibition booking ${row.number} is cancelled`,
      heading: "Your booking is cancelled",
      greeting: `Hello ${firstName(row.contactName)},`,
      paragraphs: [`Your exhibition booking for ${row.companyName} has been cancelled and the booth released.`, `Reason: ${body.reason}`, "Please contact the ADTIS secretariat if this is not what you expected."],
      details: [{ label: "Reference", value: row.number }],
    });
  }
  return detail(ctx.db, row);
}

/** Gives an approved or confirmed booking its booth number and zone, or clears them. */
export async function allocateBooth(ctx: Ctx, id: string, body: z.infer<typeof AllocationBody>): Promise<Detail> {
  requireHandler(ctx, "allocate a booth");
  const row = await ctx.db.transaction(async (tx) => {
    const current = await loadBooking(tx, id, true);
    if (!BOOKING_HOLDS_BOOTH.includes(current.status)) {
      throw new ServiceError("invalid_transition", "A booth can only be allocated to an approved or confirmed booking.");
    }
    if (current.status === "confirmed" && body.boothNumber === null) {
      throw new ServiceError("precondition_failed", "A confirmed booking keeps its booth number. Cancel the booking to release it.");
    }
    if (body.boothNumber) await requireFreeBooth(tx, current, body.boothNumber);
    if (body.zone) await requireKnownZone(tx, current.editionId, body.zone);
    const [updated] = await tx
      .update(schema.exhibitorBooking)
      .set({ boothNumber: body.boothNumber, zone: body.zone })
      .where(eq(schema.exhibitorBooking.id, id))
      .returning();
    if (!updated) throw new Error("The booking was not saved.");
    await recordSummitChange(tx, ctx.principal.userId, {
      action: "summit.commerce.booking.allocated",
      entityType: "exhibitor_booking",
      entityId: id,
      organizationId: null,
      before: { boothNumber: current.boothNumber, zone: current.zone },
      after: { boothNumber: updated.boothNumber, zone: updated.zone },
    });
    return updated;
  });
  return detail(ctx.db, row);
}

/**
 * Confirms the booth: the booking must be approved, its payment verified and a booth number given. Then the exhibitor
 * receives the booking confirmation. Nothing confirms a booking on its own.
 */
export async function confirmBooking(ctx: Ctx, id: string): Promise<Detail> {
  requireHandler(ctx, "confirm a booth");
  const { row, packageName } = await ctx.db.transaction(async (tx) => {
    const current = await loadBooking(tx, id, true);
    if (current.status === "confirmed") throw new ServiceError("invalid_transition", "This booking is already confirmed.");
    const payment = await paymentOf(tx, "exhibitor_booking", id);
    const blockers = confirmationBlockers(current, payment?.status ?? null);
    if (blockers.length) throw new ServiceError(current.status === "approved" ? "precondition_failed" : "invalid_transition", blockers.join(" "));
    const [updated] = await tx
      .update(schema.exhibitorBooking)
      .set({ status: "confirmed", confirmedAt: ctx.now })
      .where(eq(schema.exhibitorBooking.id, id))
      .returning();
    if (!updated) throw new Error("The booking was not saved.");
    await recordSummitChange(tx, ctx.principal.userId, {
      action: "summit.commerce.booking.confirmed",
      entityType: "exhibitor_booking",
      entityId: id,
      organizationId: null,
      before: { status: current.status },
      after: { status: "confirmed", boothNumber: updated.boothNumber, zone: updated.zone },
    });
    const [product] = await tx.select({ name: schema.commerceProduct.name }).from(schema.commerceProduct).where(eq(schema.commerceProduct.id, updated.productId));
    return { row: updated, packageName: product?.name ?? "exhibition package" };
  });
  const site = siteUrl();
  await sendNotice({
    to: row.email,
    subject: `Your ADTIS booth is confirmed (${row.number})`,
    heading: "Your booth is confirmed",
    greeting: `Hello ${firstName(row.contactName)},`,
    paragraphs: [
      `Your payment has been verified and your booth at the Africa Diaspora Trade & Investment Summit is confirmed for ${row.companyName}. Please keep this email as your booking confirmation.`,
      "Details for set-up and exhibitor passes will follow as the summit dates are announced.",
    ],
    details: [
      { label: "Reference", value: row.number },
      { label: "Package", value: packageName },
      { label: "Booth", value: row.boothNumber ?? "" },
      ...(row.zone ? [{ label: "Zone", value: row.zone }] : []),
    ],
    ...(site ? { action: { label: "Visit the ADTIS site", url: site } } : {}),
  });
  return detail(ctx.db, row);
}
