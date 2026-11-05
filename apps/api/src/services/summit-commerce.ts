import { and, asc, count, desc, eq, ne } from "drizzle-orm";
import { schema } from "@entrust/db";
import {
  BENEFIT_AREAS,
  EXHIBITION_COMPARISON,
  STANDARD_EDITION,
  STANDARD_PRODUCTS,
  availability,
  priceLabel,
  productProblems,
  type ProductDefinition,
  type ProductKind,
} from "@entrust/summit-engine";
import type { z } from "@hono/zod-openapi";
import type {
  AdminProduct,
  Catalogue,
  Edition,
  EditionBody,
  EditionDetail,
  EditionList,
  EditionPatch,
  ProductBody,
  ProductPatch,
  PublicProduct,
} from "../schemas/summit-commerce";
import { requireStaff, type Ctx } from "./access";
import type { Executor } from "./db";
import { ServiceError } from "./errors";
import { takenCounts } from "./summit-commerce-inventory";
import { recordSummitChange } from "./summit-status";

// The commercial catalogue (the ADTIS website instructions): an edition, and what it sells. Anyone can read the
// current edition's published products; Entrust administrators change them, and facilitators can look.

type EditionRow = typeof schema.commerceEdition.$inferSelect;
type ProductRow = typeof schema.commerceProduct.$inferSelect;
type CatalogueView = z.infer<typeof Catalogue>;
type PublicProductView = z.infer<typeof PublicProduct>;
type AdminProductView = z.infer<typeof AdminProduct>;
type EditionView = z.infer<typeof Edition>;
type EditionDetailView = z.infer<typeof EditionDetail>;
type EditionListView = z.infer<typeof EditionList>;

const KIND_GROUPS: Readonly<Record<ProductKind, keyof Pick<CatalogueView, "exhibition" | "sponsorship" | "delegates" | "opportunities">>> = {
  exhibition_package: "exhibition",
  sponsorship_level: "sponsorship",
  delegate_category: "delegates",
  opportunity: "opportunities",
};

const productAvailability = (row: ProductRow, taken: number) =>
  availability({ capacity: row.capacity, taken, markedSoldOut: row.markedSoldOut });

function publicProduct(row: ProductRow, taken: number): PublicProductView {
  const { remaining, soldOut } = productAvailability(row, taken);
  return {
    id: row.id,
    slug: row.slug,
    kind: row.kind,
    name: row.name,
    summary: row.summary,
    priceCents: row.priceCents,
    price: priceLabel(row.priceCents),
    complimentary: row.priceCents === 0,
    features: row.features,
    benefits: BENEFIT_AREAS.flatMap((area) => {
      const text = row.benefits[area.id]?.trim();
      return text ? [{ area: area.id, label: area.label, text }] : [];
    }),
    attributes: row.attributes,
    availability: { remaining, soldOut },
  };
}

/** The current edition, if one is set. */
export async function currentEdition(db: Executor): Promise<EditionRow | undefined> {
  const [row] = await db.select().from(schema.commerceEdition).where(eq(schema.commerceEdition.isCurrent, true));
  return row;
}

/**
 * What the website shows: the current edition's published products, grouped, with how many are left. It holds no
 * payment instructions, no draft and nothing about who has booked what.
 */
export async function publicCatalogue(ctx: Pick<Ctx, "db">): Promise<CatalogueView> {
  const edition = await currentEdition(ctx.db);
  const empty = { exhibition: [], sponsorship: [], delegates: [], opportunities: [] };
  const base = {
    benefitAreas: BENEFIT_AREAS.map((a) => ({ id: a.id, label: a.label })),
    comparisonRows: EXHIBITION_COMPARISON.map((r) => ({ id: r.id, label: r.label })),
  };
  if (!edition) return { edition: null, ...base, ...empty };

  const [rows, taken] = await Promise.all([
    ctx.db
      .select()
      .from(schema.commerceProduct)
      .where(and(eq(schema.commerceProduct.editionId, edition.id), eq(schema.commerceProduct.status, "published")))
      .orderBy(asc(schema.commerceProduct.sortOrder), asc(schema.commerceProduct.name)),
    takenCounts(ctx.db, edition.id),
  ]);
  const grouped: Pick<CatalogueView, "exhibition" | "sponsorship" | "delegates" | "opportunities"> = { ...empty };
  for (const row of rows) grouped[KIND_GROUPS[row.kind]].push(publicProduct(row, taken.get(row.id) ?? 0));
  return {
    edition: {
      slug: edition.slug,
      name: edition.name,
      venue: edition.venue,
      datesNote: edition.datesNote,
      days: edition.days,
      expectedAttendance: edition.expectedAttendance,
      selectedSmes: edition.selectedSmes,
      currency: edition.currency,
      pricesIncludeTax: edition.pricesIncludeTax,
      taxNote: edition.taxNote,
    },
    ...base,
    ...grouped,
  };
}

// ---- Administrators ----

function requireView(ctx: Ctx, doing: string): void {
  requireStaff(ctx.principal, ["admin", "facilitator"], doing);
}

function requireEdit(ctx: Ctx, doing: string): void {
  requireStaff(ctx.principal, ["admin"], doing);
}

const editionView = (row: EditionRow, productCount: number): EditionView => ({
  id: row.id,
  slug: row.slug,
  name: row.name,
  venue: row.venue,
  datesNote: row.datesNote,
  days: row.days,
  expectedAttendance: row.expectedAttendance,
  selectedSmes: row.selectedSmes,
  currency: row.currency,
  etbPerUsd: row.etbPerUsd === null ? null : Number(row.etbPerUsd),
  pricesIncludeTax: row.pricesIncludeTax,
  taxNote: row.taxNote,
  paymentMethods: row.paymentMethods,
  applicationPeriodId: row.applicationPeriodId,
  complimentaryPerSme: row.complimentaryPerSme,
  isCurrent: row.isCurrent,
  productCount,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

function adminProduct(row: ProductRow, taken: number): AdminProductView {
  const { remaining, soldOut } = productAvailability(row, taken);
  return {
    id: row.id,
    editionId: row.editionId,
    kind: row.kind,
    slug: row.slug,
    name: row.name,
    summary: row.summary,
    priceCents: row.priceCents,
    features: row.features,
    benefits: row.benefits,
    attributes: row.attributes,
    capacity: row.capacity,
    markedSoldOut: row.markedSoldOut,
    status: row.status,
    sortOrder: row.sortOrder,
    taken,
    availability: { remaining, soldOut },
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function loadEdition(db: Executor, id: string): Promise<EditionRow> {
  const [row] = await db.select().from(schema.commerceEdition).where(eq(schema.commerceEdition.id, id));
  if (!row) throw new ServiceError("not_found", "No such edition.");
  return row;
}

export async function listEditions(ctx: Ctx): Promise<EditionListView> {
  requireView(ctx, "list the editions");
  const [rows, counts] = await Promise.all([
    ctx.db.select().from(schema.commerceEdition).orderBy(desc(schema.commerceEdition.isCurrent), desc(schema.commerceEdition.createdAt)),
    ctx.db
      .select({ editionId: schema.commerceProduct.editionId, n: count() })
      .from(schema.commerceProduct)
      .groupBy(schema.commerceProduct.editionId),
  ]);
  return { items: rows.map((row) => editionView(row, counts.find((c) => c.editionId === row.id)?.n ?? 0)) };
}

export async function getEdition(ctx: Ctx, id: string): Promise<EditionDetailView> {
  requireView(ctx, "see an edition");
  const edition = await loadEdition(ctx.db, id);
  const [rows, taken] = await Promise.all([
    ctx.db
      .select()
      .from(schema.commerceProduct)
      .where(eq(schema.commerceProduct.editionId, id))
      .orderBy(asc(schema.commerceProduct.kind), asc(schema.commerceProduct.sortOrder), asc(schema.commerceProduct.name)),
    takenCounts(ctx.db, id),
  ]);
  return { ...editionView(edition, rows.length), products: rows.map((row) => adminProduct(row, taken.get(row.id) ?? 0)) };
}

const asDefinition = (row: ProductRow): ProductDefinition => ({
  kind: row.kind,
  slug: row.slug,
  name: row.name,
  summary: row.summary,
  priceCents: row.priceCents,
  features: row.features,
  benefits: row.benefits,
  attributes: row.attributes,
  capacity: row.capacity,
  status: row.status,
  sortOrder: row.sortOrder,
});

/**
 * Starts an edition from the standard ADTIS catalogue, or from a copy of an earlier edition's settings and products
 * (so the next summit needs no redevelopment). The new edition is not current unless there is no current one yet.
 */
export async function createEdition(ctx: Ctx, body: z.infer<typeof EditionBody>): Promise<EditionDetailView> {
  requireEdit(ctx, "create an edition");
  const id = await ctx.db.transaction(async (tx) => {
    const [clash] = await tx.select({ id: schema.commerceEdition.id }).from(schema.commerceEdition).where(eq(schema.commerceEdition.slug, body.slug));
    if (clash) throw new ServiceError("invalid", `There is already an edition at "${body.slug}".`);

    let settings: Omit<typeof schema.commerceEdition.$inferInsert, "slug" | "name">;
    let products: ProductDefinition[];
    if (body.from === "standard") {
      const s = STANDARD_EDITION;
      settings = {
        venue: s.venue,
        datesNote: s.datesNote,
        days: s.days,
        expectedAttendance: s.expectedAttendance,
        selectedSmes: s.selectedSmes,
        etbPerUsd: String(s.etbPerUsd),
        pricesIncludeTax: s.pricesIncludeTax,
        taxNote: s.taxNote,
        paymentMethods: [...s.paymentMethods],
        complimentaryPerSme: s.complimentaryPerSme,
      };
      products = STANDARD_PRODUCTS.map((p) => ({ ...p }));
    } else {
      const source = await loadEdition(tx, body.from);
      settings = {
        venue: source.venue,
        datesNote: source.datesNote,
        days: source.days,
        expectedAttendance: source.expectedAttendance,
        selectedSmes: source.selectedSmes,
        etbPerUsd: source.etbPerUsd,
        pricesIncludeTax: source.pricesIncludeTax,
        taxNote: source.taxNote,
        paymentMethods: source.paymentMethods,
        complimentaryPerSme: source.complimentaryPerSme,
      };
      const rows = await tx
        .select()
        .from(schema.commerceProduct)
        .where(and(eq(schema.commerceProduct.editionId, source.id), ne(schema.commerceProduct.status, "archived")));
      products = rows.map(asDefinition);
    }
    const problems = products.flatMap(productProblems);
    if (problems.length) throw new ServiceError("invalid", `The catalogue to copy has problems: ${problems.join(" ")}`);

    const [anyCurrent] = await tx.select({ id: schema.commerceEdition.id }).from(schema.commerceEdition).where(eq(schema.commerceEdition.isCurrent, true));
    const [edition] = await tx
      .insert(schema.commerceEdition)
      .values({ ...settings, slug: body.slug, name: body.name, isCurrent: !anyCurrent, createdBy: ctx.principal.userId })
      .returning({ id: schema.commerceEdition.id });
    if (!edition) throw new Error("The edition was not saved.");
    if (products.length) {
      await tx.insert(schema.commerceProduct).values(products.map((p) => ({ ...p, editionId: edition.id, markedSoldOut: false })));
    }
    await recordSummitChange(tx, ctx.principal.userId, {
      action: "summit.commerce.edition.created",
      entityType: "commerce_edition",
      entityId: edition.id,
      organizationId: null,
      after: { slug: body.slug, name: body.name, from: body.from, products: products.length, current: !anyCurrent },
    });
    return edition.id;
  });
  return getEdition(ctx, id);
}

/** The fields of a patch that actually change the row, for the audit log. */
function changes<T extends object>(before: T, patch: Partial<T>): { before: Partial<T>; after: Partial<T> } {
  const b: Partial<T> = {};
  const a: Partial<T> = {};
  for (const key of Object.keys(patch) as (keyof T)[]) {
    if (patch[key] === undefined || JSON.stringify(before[key]) === JSON.stringify(patch[key])) continue;
    b[key] = before[key];
    a[key] = patch[key] as T[keyof T];
  }
  return { before: b, after: a };
}

export async function updateEdition(ctx: Ctx, id: string, patch: z.infer<typeof EditionPatch>): Promise<EditionDetailView> {
  requireEdit(ctx, "change an edition");
  await ctx.db.transaction(async (tx) => {
    const [row] = await tx.select().from(schema.commerceEdition).where(eq(schema.commerceEdition.id, id)).for("update");
    if (!row) throw new ServiceError("not_found", "No such edition.");
    const { isCurrent, etbPerUsd, ...rest } = patch;
    if (patch.applicationPeriodId) {
      const [period] = await tx.select({ id: schema.applicationPeriod.id }).from(schema.applicationPeriod).where(eq(schema.applicationPeriod.id, patch.applicationPeriodId));
      if (!period) throw new ServiceError("invalid", "That application period doesn't exist.");
    }
    const set: Partial<typeof schema.commerceEdition.$inferInsert> = { ...rest };
    if (etbPerUsd !== undefined) set.etbPerUsd = etbPerUsd === null ? null : String(etbPerUsd);
    if (isCurrent) {
      // One current edition: the website sells exactly one.
      await tx.update(schema.commerceEdition).set({ isCurrent: false }).where(and(eq(schema.commerceEdition.isCurrent, true), ne(schema.commerceEdition.id, id)));
      set.isCurrent = true;
    }
    if (Object.keys(set).length) await tx.update(schema.commerceEdition).set(set).where(eq(schema.commerceEdition.id, id));

    const diff = changes(editionView(row, 0), patch as Partial<EditionView>);
    if (Object.keys(diff.after).length) {
      await recordSummitChange(tx, ctx.principal.userId, {
        action: "summit.commerce.edition.updated",
        entityType: "commerce_edition",
        entityId: id,
        organizationId: null,
        before: diff.before,
        after: diff.after,
      });
    }
  });
  return getEdition(ctx, id);
}

export async function createProduct(ctx: Ctx, editionId: string, body: z.infer<typeof ProductBody>): Promise<AdminProductView> {
  requireEdit(ctx, "add a product");
  const definition: ProductDefinition = { ...body, benefits: body.benefits as ProductDefinition["benefits"] };
  const problems = productProblems(definition);
  if (problems.length) throw new ServiceError("invalid", problems.join(" "));
  return ctx.db.transaction(async (tx) => {
    await loadEdition(tx, editionId);
    const [clash] = await tx
      .select({ id: schema.commerceProduct.id })
      .from(schema.commerceProduct)
      .where(and(eq(schema.commerceProduct.editionId, editionId), eq(schema.commerceProduct.slug, body.slug)));
    if (clash) throw new ServiceError("invalid", `This edition already has a product at "${body.slug}".`);
    const [row] = await tx.insert(schema.commerceProduct).values({ ...definition, editionId }).returning();
    if (!row) throw new Error("The product was not saved.");
    await recordSummitChange(tx, ctx.principal.userId, {
      action: "summit.commerce.product.created",
      entityType: "commerce_product",
      entityId: row.id,
      organizationId: null,
      after: { editionId, kind: row.kind, slug: row.slug, name: row.name, priceCents: row.priceCents, status: row.status },
    });
    return adminProduct(row, 0);
  });
}

/**
 * Changes a product. A price or benefit change applies to what is shown from now on; bookings already made keep the
 * price they were made at.
 */
export async function updateProduct(ctx: Ctx, id: string, patch: z.infer<typeof ProductPatch>): Promise<AdminProductView> {
  requireEdit(ctx, "change a product");
  return ctx.db.transaction(async (tx) => {
    const [row] = await tx.select().from(schema.commerceProduct).where(eq(schema.commerceProduct.id, id)).for("update");
    if (!row) throw new ServiceError("not_found", "No such product.");
    const set = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)) as Partial<typeof schema.commerceProduct.$inferInsert>;
    const merged = { ...asDefinition(row), ...set } as ProductDefinition;
    const problems = productProblems(merged);
    if (problems.length) throw new ServiceError("invalid", problems.join(" "));
    const diff = changes({ ...asDefinition(row), markedSoldOut: row.markedSoldOut }, set as never);
    if (Object.keys(diff.after).length === 0) return adminProduct(row, (await takenCounts(tx, row.editionId)).get(row.id) ?? 0);
    const [updated] = await tx.update(schema.commerceProduct).set(set).where(eq(schema.commerceProduct.id, id)).returning();
    if (!updated) throw new Error("The product was not saved.");
    await recordSummitChange(tx, ctx.principal.userId, {
      action: "summit.commerce.product.updated",
      entityType: "commerce_product",
      entityId: id,
      organizationId: null,
      before: diff.before,
      after: diff.after,
    });
    return adminProduct(updated, (await takenCounts(tx, updated.editionId)).get(updated.id) ?? 0);
  });
}
