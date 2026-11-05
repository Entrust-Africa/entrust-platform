import { and, asc, eq, sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { schema } from "@entrust/db";
import {
  COMMERCE_REPORTS,
  PAYMENT_STATUS_LABELS,
  REVENUE_STREAMS,
  REVENUE_STREAM_LABELS,
  BOOKING_STATUS_LABELS,
  ENQUIRY_STATUS_LABELS,
  countryName,
  revenueOf,
  type CommerceReportId,
  type PaymentStatus,
} from "@entrust/summit-engine";
import type { z } from "@hono/zod-openapi";
import type { CommerceReportCatalogue, CommerceReportTable } from "../schemas/summit-commerce";
import { requireStaff, type Ctx } from "./access";
import type { Executor } from "./db";
import { ServiceError } from "./errors";
import { CONTENT_TYPES, render, type ExportCell, type ExportFormat, type ExportTable } from "./export";
import { pickEdition, revenueRows } from "./summit-commerce-dashboard";
import { SUMMIT_NAME, type ExportedFile } from "./summit-reports";
import { recordSummitChange } from "./summit-status";

// The six exports of section 10: delegate registrations, exhibitors, sponsorship, payments, revenue, and countries and sectors,
// each as Excel, CSV or PDF, or as data for a screen. They hold personal details, so they are for administrators and
// facilitators only, and every export is written to the audit log.

type EditionRow = typeof schema.commerceEdition.$inferSelect;
type Column = ExportTable["columns"][number];
const CLASSIFICATION = "Confidential";

const text = (key: string, label: string): Column => ({ key, label, numeric: false });
const num = (key: string, label: string): Column => ({ key, label, numeric: true });
const usd = (cents: number): number => cents / 100;
const iso = (date: Date | null): string | null => (date ? date.toISOString().replace("T", " ").slice(0, 16) + " UTC" : null);
const yesNo = (value: boolean): string => (value ? "Yes" : "No");
const payLabel = (status: PaymentStatus | null): string | null => (status ? PAYMENT_STATUS_LABELS[status] : null);
const country = (code: string): string => countryName(code) ?? code;

interface Built {
  columns: Column[];
  rows: ExportCell[][];
  titleCells: number;
}

const payJoin = (type: "delegate" | "exhibitor_booking" | "sponsorship", id: AnyPgColumn) =>
  and(eq(schema.commercePayment.subjectType, sql`${type}`), eq(schema.commercePayment.subjectId, id));

async function delegates(db: Executor, edition: EditionRow): Promise<Built> {
  const d = schema.delegateRegistration;
  const rows = await db
    .select({ d, category: schema.commerceProduct.name, pay: schema.commercePayment.status })
    .from(d)
    .innerJoin(schema.commerceProduct, eq(schema.commerceProduct.id, d.productId))
    .leftJoin(schema.commercePayment, payJoin("delegate", d.id))
    .where(eq(d.editionId, edition.id))
    .orderBy(asc(d.number));
  return {
    titleCells: 2,
    columns: [
      text("number", "Reference"), text("name", "Name"), text("email", "Email"), text("phone", "Phone"), text("organisation", "Organisation"),
      text("jobTitle", "Job title"), text("country", "Country"), text("sector", "Sector"), text("category", "Category"), num("amount", "Amount due (USD)"),
      text("payment", "Payment status"), text("selectedSme", "Selected SME"), text("status", "Registration"), text("checkedIn", "Checked in"), text("registered", "Registered"),
    ],
    rows: rows.map(({ d: r, category, pay }) => [
      r.number, r.fullName, r.email, r.phone, r.organisation, r.jobTitle, country(r.country), r.sector, category, usd(r.amountCents),
      payLabel(pay), yesNo(r.applicationId !== null), r.status === "registered" ? "Registered" : "Cancelled", iso(r.checkedInAt), iso(r.createdAt),
    ]),
  };
}

async function exhibitors(db: Executor, edition: EditionRow): Promise<Built> {
  const b = schema.exhibitorBooking;
  const rows = await db
    .select({ b, pkg: schema.commerceProduct.name, pay: schema.commercePayment.status })
    .from(b)
    .innerJoin(schema.commerceProduct, eq(schema.commerceProduct.id, b.productId))
    .leftJoin(schema.commercePayment, payJoin("exhibitor_booking", b.id))
    .where(eq(b.editionId, edition.id))
    .orderBy(asc(b.number));
  return {
    titleCells: 2,
    columns: [
      text("number", "Reference"), text("company", "Company"), text("country", "Country"), text("sector", "Sector"), text("contact", "Contact"), text("position", "Position"),
      text("email", "Email"), text("phone", "Phone"), text("package", "Package"), text("status", "Status"), text("booth", "Booth"), text("zone", "Zone"),
      num("amount", "Amount (USD)"), text("payment", "Payment status"), text("products", "Products and services"), text("website", "Website"), text("registration", "Business registration"), text("applied", "Applied"),
    ],
    rows: rows.map(({ b: r, pkg, pay }) => [
      r.number, r.companyName, country(r.country), r.sector, r.contactName, r.position, r.email, r.phone, pkg, BOOKING_STATUS_LABELS[r.status], r.boothNumber, r.zone,
      usd(r.amountCents), payLabel(pay), r.productsServices, r.website, r.registrationDetails, iso(r.createdAt),
    ]),
  };
}

async function sponsorship(db: Executor, edition: EditionRow): Promise<Built> {
  const e = schema.sponsorEnquiry;
  const rows = await db
    .select({ e, item: schema.commerceProduct.name, kind: schema.commerceProduct.kind, pay: schema.commercePayment.status })
    .from(e)
    .innerJoin(schema.commerceProduct, eq(schema.commerceProduct.id, e.productId))
    .leftJoin(schema.commercePayment, payJoin("sponsorship", e.id))
    .where(eq(e.editionId, edition.id))
    .orderBy(asc(e.number));
  return {
    titleCells: 2,
    columns: [
      text("number", "Reference"), text("organisation", "Organisation"), text("country", "Country"), text("contact", "Contact"), text("position", "Position"), text("email", "Email"),
      text("phone", "Phone"), text("sector", "Sector"), text("item", "Package or opportunity"), text("type", "Type"), text("status", "Status"), num("value", "Value (USD)"),
      text("payment", "Payment status"), text("objectives", "Objectives"), text("changed", "Status changed"), text("enquired", "Enquired"),
    ],
    rows: rows.map(({ e: r, item, kind, pay }) => [
      r.number, r.organisationName, country(r.country), r.contactName, r.position, r.email, r.phone, r.sector, item,
      kind === "sponsorship_level" ? "Sponsorship level" : "Opportunity", ENQUIRY_STATUS_LABELS[r.status], usd(r.valueCents), payLabel(pay), r.objectives, iso(r.statusChangedAt), iso(r.createdAt),
    ]),
  };
}

async function payments(db: Executor, edition: EditionRow): Promise<Built> {
  const p = schema.commercePayment;
  const [delegateRows, bookingRows, sponsorRows] = await Promise.all([
    db
      .select({ p, number: schema.delegateRegistration.number, who: schema.delegateRegistration.fullName, email: schema.delegateRegistration.email, item: schema.commerceProduct.name, by: schema.user.name })
      .from(p)
      .innerJoin(schema.delegateRegistration, and(eq(p.subjectType, sql`'delegate'`), eq(p.subjectId, schema.delegateRegistration.id)))
      .innerJoin(schema.commerceProduct, eq(schema.commerceProduct.id, schema.delegateRegistration.productId))
      .leftJoin(schema.user, eq(schema.user.id, p.verifiedBy))
      .where(eq(p.editionId, edition.id)),
    db
      .select({ p, number: schema.exhibitorBooking.number, who: schema.exhibitorBooking.companyName, email: schema.exhibitorBooking.email, item: schema.commerceProduct.name, by: schema.user.name })
      .from(p)
      .innerJoin(schema.exhibitorBooking, and(eq(p.subjectType, sql`'exhibitor_booking'`), eq(p.subjectId, schema.exhibitorBooking.id)))
      .innerJoin(schema.commerceProduct, eq(schema.commerceProduct.id, schema.exhibitorBooking.productId))
      .leftJoin(schema.user, eq(schema.user.id, p.verifiedBy))
      .where(eq(p.editionId, edition.id)),
    db
      .select({ p, number: schema.sponsorEnquiry.number, who: schema.sponsorEnquiry.organisationName, email: schema.sponsorEnquiry.email, item: schema.commerceProduct.name, by: schema.user.name })
      .from(p)
      .innerJoin(schema.sponsorEnquiry, and(eq(p.subjectType, sql`'sponsorship'`), eq(p.subjectId, schema.sponsorEnquiry.id)))
      .innerJoin(schema.commerceProduct, eq(schema.commerceProduct.id, schema.sponsorEnquiry.productId))
      .leftJoin(schema.user, eq(schema.user.id, p.verifiedBy))
      .where(eq(p.editionId, edition.id)),
  ]);
  const tagged = [
    ...delegateRows.map((r) => ({ ...r, type: "Delegate" })),
    ...bookingRows.map((r) => ({ ...r, type: "Exhibitor" })),
    ...sponsorRows.map((r) => ({ ...r, type: "Sponsor" })),
  ].sort((a, b) => a.number.localeCompare(b.number));
  return {
    titleCells: 2,
    columns: [
      text("number", "Reference"), text("payer", "Payer"), text("email", "Email"), text("type", "Type"), text("item", "Item"), text("status", "Status"),
      num("due", "Amount due (USD)"), num("received", "Amount received (USD)"), text("method", "Method"), text("reference", "Payment reference"),
      text("verifiedBy", "Verified by"), text("verifiedAt", "Verified"), text("note", "Note"),
    ],
    rows: tagged.map(({ p: r, number, who, email, item, by, type }) => [
      number, who, email, type, item, PAYMENT_STATUS_LABELS[r.status], usd(r.amountDueCents), r.amountReceivedCents === null ? null : usd(r.amountReceivedCents),
      r.method, r.reference, by, iso(r.verifiedAt), r.note,
    ]),
  };
}

async function revenue(db: Executor, edition: EditionRow): Promise<Built> {
  const [rows, products] = await Promise.all([
    revenueRows(db, edition.id),
    db.select({ id: schema.commerceProduct.id, name: schema.commerceProduct.name, sortOrder: schema.commerceProduct.sortOrder }).from(schema.commerceProduct).where(eq(schema.commerceProduct.editionId, edition.id)),
  ]);
  const out: ExportCell[][] = [];
  const line = (stream: string, item: string, figures: ReturnType<typeof revenueOf>, count: number): ExportCell[] => [
    stream, item, count, usd(figures.expectedCents), usd(figures.receivedCents), usd(figures.outstandingCents), usd(figures.refundedCents),
  ];
  for (const stream of REVENUE_STREAMS) {
    const ofStream = rows.filter((r) => r.stream === stream);
    for (const product of [...products].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))) {
      const own = ofStream.filter((r) => r.productId === product.id);
      if (own.length) out.push(line(REVENUE_STREAM_LABELS[stream], product.name, revenueOf(own), own.filter((r) => r.status !== "cancelled").reduce((n, r) => n + r.count, 0)));
    }
    out.push(line(REVENUE_STREAM_LABELS[stream], "Total", revenueOf(ofStream), ofStream.filter((r) => r.status !== "cancelled").reduce((n, r) => n + r.count, 0)));
  }
  out.push(line("All streams", "Total", revenueOf(rows), rows.filter((r) => r.status !== "cancelled").reduce((n, r) => n + r.count, 0)));
  return {
    titleCells: 2,
    columns: [text("stream", "Stream"), text("item", "Item"), num("count", "Payments"), num("expected", "Expected (USD)"), num("received", "Received (USD)"), num("outstanding", "Outstanding (USD)"), num("refunded", "Refunded (USD)")],
    rows: out,
  };
}

async function countrySector(db: Executor, edition: EditionRow): Promise<Built> {
  const [d, b, e] = [schema.delegateRegistration, schema.exhibitorBooking, schema.sponsorEnquiry];
  const [dc, bc, ec, ds, bs, es] = await Promise.all([
    db.select({ k: d.country, n: sql<number>`count(*)::int` }).from(d).where(and(eq(d.editionId, edition.id), eq(d.status, "registered"))).groupBy(d.country),
    db.select({ k: b.country, n: sql<number>`count(*)::int` }).from(b).where(and(eq(b.editionId, edition.id), sql`${b.status} in ('submitted', 'approved', 'confirmed')`)).groupBy(b.country),
    db.select({ k: e.country, n: sql<number>`count(*)::int` }).from(e).where(and(eq(e.editionId, edition.id), sql`${e.status} <> 'declined'`)).groupBy(e.country),
    db.select({ k: sql<string>`coalesce(${d.sector}, 'Not given')`, n: sql<number>`count(*)::int` }).from(d).where(and(eq(d.editionId, edition.id), eq(d.status, "registered"))).groupBy(sql`coalesce(${d.sector}, 'Not given')`),
    db.select({ k: b.sector, n: sql<number>`count(*)::int` }).from(b).where(and(eq(b.editionId, edition.id), sql`${b.status} in ('submitted', 'approved', 'confirmed')`)).groupBy(b.sector),
    db.select({ k: e.sector, n: sql<number>`count(*)::int` }).from(e).where(and(eq(e.editionId, edition.id), sql`${e.status} <> 'declined'`)).groupBy(e.sector),
  ]);
  const merge = (label: (key: string) => string, dim: string, a: typeof dc, bb: typeof bc, c: typeof ec): ExportCell[][] => {
    const keys = [...new Set([...a, ...bb, ...c].map((r) => r.k))];
    return keys
      .map((k) => {
        const delegatesN = a.find((r) => r.k === k)?.n ?? 0;
        const exhibitorsN = bb.find((r) => r.k === k)?.n ?? 0;
        const sponsorsN = c.find((r) => r.k === k)?.n ?? 0;
        return [dim, label(k), delegatesN, exhibitorsN, sponsorsN, delegatesN + exhibitorsN + sponsorsN] as ExportCell[];
      })
      .sort((x, y) => (y[5] as number) - (x[5] as number) || String(x[1]).localeCompare(String(y[1])));
  };
  return {
    titleCells: 2,
    columns: [text("dimension", "Grouped by"), text("value", "Country or sector"), num("delegates", "Delegates"), num("exhibitors", "Exhibitor applications"), num("sponsors", "Sponsorship enquiries"), num("total", "Total")],
    rows: [...merge(country, "Country", dc, bc, ec), ...merge((k) => k, "Sector", ds, bs, es)],
  };
}

const BUILDERS: Readonly<Record<CommerceReportId, (db: Executor, edition: EditionRow) => Promise<Built>>> = {
  delegates,
  exhibitors,
  sponsorship,
  payments,
  revenue,
  country_sector: countrySector,
};

const reportKind = (report: (typeof COMMERCE_REPORTS)[number]) => ({ ...report, classification: CLASSIFICATION });

export async function listCommerceReports(ctx: Ctx): Promise<z.infer<typeof CommerceReportCatalogue>> {
  requireStaff(ctx.principal, ["admin", "facilitator"], "see the commercial reports");
  return { items: COMMERCE_REPORTS.map(reportKind) };
}

interface BuiltReport {
  kind: ReturnType<typeof reportKind>;
  edition: EditionRow;
  generatedBy: string;
  table: ExportTable;
}

async function buildReport(ctx: Ctx, id: CommerceReportId, editionId?: string): Promise<BuiltReport> {
  requireStaff(ctx.principal, ["admin", "facilitator"], "export the commercial reports");
  const report = COMMERCE_REPORTS.find((r) => r.id === id);
  if (!report) throw new ServiceError("not_found", "No such report.");
  const edition = await pickEdition(ctx.db, editionId);
  const built = await BUILDERS[id](ctx.db, edition);
  const [generator] = await ctx.db.select({ name: schema.user.name }).from(schema.user).where(eq(schema.user.id, ctx.principal.userId));
  const generatedBy = generator?.name ?? ctx.principal.userId;
  return {
    kind: reportKind(report),
    edition,
    generatedBy,
    table: {
      summit: SUMMIT_NAME,
      title: report.title,
      purpose: report.purpose,
      period: edition.name,
      generatedAt: ctx.now,
      generatedBy,
      filters: "None",
      records: built.rows.length,
      classification: CLASSIFICATION,
      columns: built.columns,
      rows: built.rows,
      titleCells: built.titleCells,
    },
  };
}

async function audit(ctx: Ctx, built: BuiltReport, format: ExportFormat | "json"): Promise<void> {
  await recordSummitChange(ctx.db, ctx.principal.userId, {
    action: "summit.commerce.report.exported",
    entityType: "commerce_edition",
    entityId: built.edition.id,
    organizationId: null,
    after: { report: built.kind.id, title: built.kind.title, format, records: built.table.records, classification: CLASSIFICATION, exportedAt: ctx.now.toISOString() },
  });
}

const EXTENSIONS: Record<ExportFormat, string> = { csv: "csv", xlsx: "xlsx", pdf: "pdf" };
const slug = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "edition";

/** A report as a file. Recorded in the audit log once it is made. */
export async function exportCommerceReport(ctx: Ctx, id: CommerceReportId, format: ExportFormat, editionId?: string): Promise<ExportedFile> {
  const built = await buildReport(ctx, id, editionId);
  const body = await render(built.table, format);
  await audit(ctx, built, format);
  return {
    filename: `adtis-${id.replaceAll("_", "-")}-${slug(built.edition.slug)}-${ctx.now.toISOString().slice(0, 10).replaceAll("-", "")}.${EXTENSIONS[format]}`,
    contentType: CONTENT_TYPES[format],
    body,
  };
}

/** The same report as data, for a screen. It is an export like any other: the same audit entry. */
export async function viewCommerceReport(ctx: Ctx, id: CommerceReportId, editionId?: string): Promise<z.infer<typeof CommerceReportTable>> {
  const built = await buildReport(ctx, id, editionId);
  await audit(ctx, built, "json");
  return {
    report: built.kind,
    edition: { id: built.edition.id, name: built.edition.name },
    generatedAt: built.table.generatedAt.toISOString(),
    generatedBy: built.generatedBy,
    records: built.table.records,
    columns: built.table.columns.map((c) => ({ ...c })),
    rows: built.table.rows.map((r) => [...r]),
  };
}
