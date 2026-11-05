import { and, count, eq, sql } from "drizzle-orm";
import { schema } from "@entrust/db";
import {
  ENQUIRY_OPEN,
  REVENUE_STREAMS,
  REVENUE_STREAM_LABELS,
  boothFigures,
  boothTotals,
  countryName,
  revenueOf,
  type PaymentFigures,
  type PaymentStatus,
  type ProductKind,
  type RevenueStream,
} from "@entrust/summit-engine";
import type { z } from "@hono/zod-openapi";
import type { CommerceDashboard } from "../schemas/summit-commerce";
import { requireStaff, type Ctx } from "./access";
import type { Executor } from "./db";
import { ServiceError } from "./errors";
import { currentEdition } from "./summit-commerce";

// The commercial dashboard (section 10): registrations, exhibition space, sponsorship and revenue for one edition, read live
// from the same records the rest of the commercial side writes, so it can never disagree with them.

type EditionRow = typeof schema.commerceEdition.$inferSelect;
type View = z.infer<typeof CommerceDashboard>;

/** The edition asked for, or the current one. */
export async function pickEdition(db: Executor, editionId?: string): Promise<EditionRow> {
  if (editionId) {
    const [row] = await db.select().from(schema.commerceEdition).where(eq(schema.commerceEdition.id, editionId));
    if (!row) throw new ServiceError("not_found", "No such edition.");
    return row;
  }
  const current = await currentEdition(db);
  if (!current) throw new ServiceError("not_found", "There is no edition yet. Create one first.");
  return current;
}

const float = (column: ReturnType<typeof sql>) => sql<number>`coalesce(sum(${column}), 0)::float8`;

/** Payments of an edition summed by stream, product and status. */
export interface RevenueRow extends PaymentFigures {
  stream: RevenueStream;
  productId: string;
}

export async function revenueRows(db: Executor, editionId: string): Promise<RevenueRow[]> {
  const p = schema.commercePayment;
  const figures = {
    n: count(),
    due: float(sql`${p.amountDueCents}`),
    received: float(sql`coalesce(${p.amountReceivedCents}, ${p.amountDueCents})`),
  };
  const [delegates, bookings, sponsors] = await Promise.all([
    db
      .select({ productId: schema.delegateRegistration.productId, status: p.status, ...figures })
      .from(p)
      .innerJoin(schema.delegateRegistration, and(eq(p.subjectType, sql`'delegate'`), eq(p.subjectId, schema.delegateRegistration.id)))
      .where(eq(p.editionId, editionId))
      .groupBy(schema.delegateRegistration.productId, p.status),
    db
      .select({ productId: schema.exhibitorBooking.productId, status: p.status, ...figures })
      .from(p)
      .innerJoin(schema.exhibitorBooking, and(eq(p.subjectType, sql`'exhibitor_booking'`), eq(p.subjectId, schema.exhibitorBooking.id)))
      .where(eq(p.editionId, editionId))
      .groupBy(schema.exhibitorBooking.productId, p.status),
    db
      .select({ productId: schema.sponsorEnquiry.productId, status: p.status, ...figures })
      .from(p)
      .innerJoin(schema.sponsorEnquiry, and(eq(p.subjectType, sql`'sponsorship'`), eq(p.subjectId, schema.sponsorEnquiry.id)))
      .where(eq(p.editionId, editionId))
      .groupBy(schema.sponsorEnquiry.productId, p.status),
  ]);
  const tag = (stream: RevenueStream) => (r: { productId: string; status: PaymentStatus; n: number; due: number; received: number }): RevenueRow => ({
    stream,
    productId: r.productId,
    status: r.status,
    count: r.n,
    dueCents: r.due,
    receivedCents: r.received,
  });
  return [...delegates.map(tag("delegates")), ...bookings.map(tag("exhibition")), ...sponsors.map(tag("sponsorship"))];
}

export async function getCommerceDashboard(ctx: Ctx, editionId?: string): Promise<View> {
  requireStaff(ctx.principal, ["admin", "facilitator"], "see the commercial dashboard");
  const edition = await pickEdition(ctx.db, editionId);
  const id = edition.id;
  const d = schema.delegateRegistration;
  const b = schema.exhibitorBooking;
  const e = schema.sponsorEnquiry;
  const payJoin = and(eq(schema.commercePayment.subjectType, sql`'delegate'`), eq(schema.commercePayment.subjectId, d.id));

  const [products, delegateRows, countries, sectors, bookingRows, enquiryRows, revenue] = await Promise.all([
    ctx.db.select().from(schema.commerceProduct).where(eq(schema.commerceProduct.editionId, id)),
    ctx.db
      .select({ productId: d.productId, status: d.status, pay: schema.commercePayment.status, n: count(), arrived: sql<number>`count(${d.checkedInAt})::int` })
      .from(d)
      .leftJoin(schema.commercePayment, payJoin)
      .where(eq(d.editionId, id))
      .groupBy(d.productId, d.status, schema.commercePayment.status),
    ctx.db.select({ country: d.country, n: count() }).from(d).where(and(eq(d.editionId, id), eq(d.status, "registered"))).groupBy(d.country),
    ctx.db
      .select({ sector: sql<string>`coalesce(${d.sector}, 'Not given')`, n: count() })
      .from(d)
      .where(and(eq(d.editionId, id), eq(d.status, "registered")))
      .groupBy(sql`coalesce(${d.sector}, 'Not given')`),
    ctx.db
      .select({ productId: b.productId, status: b.status, n: count(), value: float(sql`${b.amountCents}`) })
      .from(b)
      .where(eq(b.editionId, id))
      .groupBy(b.productId, b.status),
    ctx.db
      .select({ productId: e.productId, status: e.status, n: count(), value: float(sql`${e.valueCents}`) })
      .from(e)
      .where(eq(e.editionId, id))
      .groupBy(e.productId, e.status),
    revenueRows(ctx.db, id),
  ]);
  const name = new Map(products.map((p) => [p.id, p]));

  // Registrations.
  const registered = delegateRows.filter((r) => r.status === "registered");
  const paid = (r: (typeof delegateRows)[number]) => r.pay === "confirmed";
  const unpaid = (r: (typeof delegateRows)[number]) => r.pay === "pending" || r.pay === "awaiting_verification";
  const sum = <T,>(rows: readonly T[], pick: (row: T) => number) => rows.reduce((total, row) => total + pick(row), 0);
  const categories = products.filter((p) => p.kind === "delegate_category");

  // Exhibition.
  const packages = products.filter((p) => p.kind === "exhibition_package" && p.status !== "archived");
  const boothCount = (productId: string, statuses: readonly string[]) => sum(bookingRows.filter((r) => r.productId === productId && statuses.includes(r.status)), (r) => r.n);
  const figures = packages.map((p) => ({
    product: p,
    ...boothFigures({
      capacity: p.capacity,
      submitted: boothCount(p.id, ["submitted"]),
      reserved: boothCount(p.id, ["approved"]),
      confirmed: boothCount(p.id, ["confirmed"]),
      markedSoldOut: p.markedSoldOut,
    }),
  }));
  const totals = boothTotals(figures);

  // Sponsorship.
  const sponsored = products.filter((p) => p.kind === "sponsorship_level" || p.kind === "opportunity");
  const enquiriesOf = (productId: string, statuses: readonly string[]) => enquiryRows.filter((r) => r.productId === productId && statuses.includes(r.status));
  const open = ENQUIRY_OPEN as readonly string[];
  const allEnquiries = enquiryRows;
  const confirmedEnquiries = enquiryRows.filter((r) => r.status === "confirmed");
  const openEnquiries = enquiryRows.filter((r) => open.includes(r.status));

  // Revenue.
  const figuresOf = (rows: readonly RevenueRow[]) => revenueOf(rows);
  const total = figuresOf(revenue);
  const byStream = REVENUE_STREAMS.map((stream) => ({ stream, label: REVENUE_STREAM_LABELS[stream], ...pickRevenue(figuresOf(revenue.filter((r) => r.stream === stream))) }));
  const productIds = [...new Set(revenue.map((r) => r.productId))];
  const byProduct = productIds
    .map((productId) => {
      const rows = revenue.filter((r) => r.productId === productId);
      const product = name.get(productId);
      return {
        productId,
        name: product?.name ?? "Unknown",
        kind: (product?.kind ?? "opportunity") as ProductKind,
        stream: rows[0]!.stream,
        count: sum(rows.filter((r) => r.status !== "cancelled"), (r) => r.count),
        ...pickRevenue(figuresOf(rows)),
      };
    })
    .sort((x, y) => y.expectedCents - x.expectedCents || x.name.localeCompare(y.name));
  const potentialCents =
    sum(bookingRows.filter((r) => r.status === "submitted"), (r) => r.value) + sum(openEnquiries, (r) => r.value);

  return {
    edition: { id, slug: edition.slug, name: edition.name, expectedAttendance: edition.expectedAttendance, selectedSmes: edition.selectedSmes },
    generatedAt: ctx.now.toISOString(),
    registrations: {
      total: sum(registered, (r) => r.n),
      confirmed: sum(registered.filter(paid), (r) => r.n),
      pending: sum(registered.filter(unpaid), (r) => r.n),
      cancelled: sum(delegateRows.filter((r) => r.status === "cancelled"), (r) => r.n),
      checkedIn: sum(delegateRows, (r) => r.arrived),
      // Every category the edition sells, even with no one registered yet; an archived one only if someone registered in it.
      byCategory: categories
        .map((p) => {
          const rows = registered.filter((r) => r.productId === p.id);
          return { productId: p.id, name: p.name, status: p.status, registered: sum(rows, (r) => r.n), confirmed: sum(rows.filter(paid), (r) => r.n), pending: sum(rows.filter(unpaid), (r) => r.n) };
        })
        .filter((c) => c.status !== "archived" || c.registered > 0)
        .map(({ status: _status, ...c }) => c),
      byCountry: countries.map((c) => ({ country: c.country, name: countryName(c.country) ?? c.country, count: c.n })).sort((x, y) => y.count - x.count || x.name.localeCompare(y.name)),
      bySector: sectors.map((s) => ({ sector: s.sector, count: s.n })).sort((x, y) => y.count - x.count || x.sector.localeCompare(y.sector)),
    },
    exhibition: {
      capacitySet: totals.capacitySet,
      totalBooths: totals.totalBooths,
      available: totals.available,
      submitted: sum(figures, (f) => f.submitted),
      reserved: sum(figures, (f) => f.reserved),
      confirmed: sum(figures, (f) => f.confirmed),
      byPackage: figures.map((f) => ({
        productId: f.product.id,
        name: f.product.name,
        capacity: f.capacity,
        submitted: f.submitted,
        reserved: f.reserved,
        confirmed: f.confirmed,
        available: f.available,
        soldOut: f.soldOut,
      })),
    },
    sponsorship: {
      enquiries: sum(allEnquiries, (r) => r.n),
      confirmed: sum(confirmedEnquiries, (r) => r.n),
      valueCents: sum(confirmedEnquiries, (r) => r.value),
      pipelineCount: sum(openEnquiries, (r) => r.n),
      pipelineValueCents: sum(openEnquiries, (r) => r.value),
      byStatus: Object.fromEntries(["new", "contacted", "negotiation", "proposal_sent", "confirmed", "declined"].map((s) => [s, sum(allEnquiries.filter((r) => r.status === s), (r) => r.n)])),
      byProduct: sponsored
        .filter((p) => p.status !== "archived" || enquiryRows.some((r) => r.productId === p.id))
        .map((p) => ({
          productId: p.id,
          name: p.name,
          kind: p.kind,
          enquiries: sum(enquiriesOf(p.id, ["new", "contacted", "negotiation", "proposal_sent", "confirmed", "declined"]), (r) => r.n),
          confirmed: sum(enquiriesOf(p.id, ["confirmed"]), (r) => r.n),
          confirmedValueCents: sum(enquiriesOf(p.id, ["confirmed"]), (r) => r.value),
          openValueCents: sum(enquiriesOf(p.id, open), (r) => r.value),
        })),
    },
    revenue: { ...pickRevenue(total), potentialCents, byStream, byProduct },
  };
}

const pickRevenue = (r: ReturnType<typeof revenueOf>) => ({
  expectedCents: r.expectedCents,
  receivedCents: r.receivedCents,
  outstandingCents: r.outstandingCents,
  refundedCents: r.refundedCents,
});
