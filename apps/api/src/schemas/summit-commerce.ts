import { z } from "@hono/zod-openapi";
import { BENEFIT_AREA_IDS, MAX_FEATURES, MAX_PRICE_CENTS, PRODUCT_KINDS, PRODUCT_STATUSES, SLUG_PATTERN } from "@entrust/summit-engine";

// What the commercial endpoints take and give: the catalogue the website shows, and the administrators' editing of
// editions and products. The services build these shapes.

const Timestamp = z.string().openapi({ description: "ISO 8601 timestamp", example: "2026-12-01T09:00:00.000Z" });
const Kind = z.enum(PRODUCT_KINDS);
const Status = z.enum(PRODUCT_STATUSES);

// ---- What the website shows ----

export const ProductAvailability = z
  .object({
    remaining: z.number().int().nullable().openapi({ description: "How many are left. Null when no limit has been set." }),
    soldOut: z.boolean().openapi({ description: "Marked sold out, or everything approved fills the capacity." }),
  })
  .openapi("SummitProductAvailability");

export const PublicProduct = z
  .object({
    id: z.uuid(),
    slug: z.string(),
    kind: Kind,
    name: z.string(),
    summary: z.string(),
    priceCents: z.number().int(),
    price: z.string().openapi({ example: "$1,560", description: "As the website shows it: \"Complimentary\" for zero." }),
    complimentary: z.boolean(),
    features: z.array(z.string()),
    benefits: z
      .array(z.object({ area: z.enum(BENEFIT_AREA_IDS), label: z.string(), text: z.string() }))
      .openapi({ description: "Sponsorship levels: the areas this level includes, in the order of the site. An area it leaves out is not listed." }),
    attributes: z.record(z.string(), z.string()),
    availability: ProductAvailability,
  })
  .openapi("SummitPublicProduct");

export const PublicEdition = z
  .object({
    slug: z.string().openapi({ example: "adtis-2027" }),
    name: z.string(),
    venue: z.string(),
    datesNote: z.string().openapi({ example: "January 2027 (exact dates to be announced)" }),
    days: z.number().int(),
    expectedAttendance: z.number().int().nullable(),
    selectedSmes: z.number().int().nullable(),
    currency: z.string().openapi({ example: "USD" }),
    pricesIncludeTax: z.boolean().nullable().openapi({ description: "Null until the organisers confirm whether prices include taxes." }),
    taxNote: z.string(),
  })
  .openapi("SummitPublicEdition");

export const Catalogue = z
  .object({
    edition: PublicEdition.nullable().openapi({ description: "The current edition, or null before one is set up." }),
    benefitAreas: z.array(z.object({ id: z.enum(BENEFIT_AREA_IDS), label: z.string() })),
    comparisonRows: z.array(z.object({ id: z.string(), label: z.string() })).openapi({ description: "The rows of the exhibition packages' comparison." }),
    exhibition: z.array(PublicProduct),
    sponsorship: z.array(PublicProduct),
    delegates: z.array(PublicProduct),
    opportunities: z.array(PublicProduct),
  })
  .openapi("SummitCatalogue");

// ---- Administrators ----

export const PaymentMethodBody = z.object({
  id: z.string().trim().min(1).max(40).regex(SLUG_PATTERN, "Use lower-case letters, numbers and hyphens."),
  label: z.string().trim().min(1).max(80),
  instructions: z.string().trim().min(1).max(2000),
});

export const Edition = z
  .object({
    id: z.uuid(),
    slug: z.string(),
    name: z.string(),
    venue: z.string(),
    datesNote: z.string(),
    days: z.number().int(),
    expectedAttendance: z.number().int().nullable(),
    selectedSmes: z.number().int().nullable(),
    currency: z.string(),
    etbPerUsd: z.number().nullable(),
    pricesIncludeTax: z.boolean().nullable(),
    taxNote: z.string(),
    paymentMethods: z.array(PaymentMethodBody),
    applicationPeriodId: z.uuid().nullable(),
    complimentaryPerSme: z.number().int(),
    isCurrent: z.boolean(),
    productCount: z.number().int(),
    createdAt: Timestamp,
    updatedAt: Timestamp,
  })
  .openapi("SummitEdition");

export const AdminProduct = z
  .object({
    id: z.uuid(),
    editionId: z.uuid(),
    kind: Kind,
    slug: z.string(),
    name: z.string(),
    summary: z.string(),
    priceCents: z.number().int(),
    features: z.array(z.string()),
    benefits: z.record(z.string(), z.string()),
    attributes: z.record(z.string(), z.string()),
    capacity: z.number().int().nullable(),
    markedSoldOut: z.boolean(),
    status: Status,
    sortOrder: z.number().int(),
    taken: z.number().int().openapi({ description: "How many are approved or confirmed against the capacity." }),
    availability: ProductAvailability,
    updatedAt: Timestamp,
  })
  .openapi("SummitAdminProduct");

export const EditionDetail = Edition.extend({ products: z.array(AdminProduct) }).openapi("SummitEditionDetail");
export const EditionList = z.object({ items: z.array(Edition) }).openapi("SummitEditionList");

export const EditionParam = z.object({ id: z.uuid() });
export const ProductParam = z.object({ id: z.uuid() });

const Slug = z.string().trim().max(60).regex(SLUG_PATTERN, "Use lower-case letters, numbers and hyphens.");

export const EditionBody = z
  .object({
    name: z.string().trim().min(1).max(160),
    slug: Slug,
    from: z
      .union([z.literal("standard"), z.uuid()])
      .default("standard")
      .openapi({ description: "\"standard\" starts from the standard ADTIS catalogue; an edition's id copies that edition's settings and products." }),
  })
  .openapi("SummitEditionBody");

export const EditionPatch = z
  .object({
    name: z.string().trim().min(1).max(160),
    venue: z.string().trim().min(1).max(160),
    datesNote: z.string().trim().min(1).max(200),
    days: z.number().int().min(1).max(14),
    expectedAttendance: z.number().int().min(0).max(100000).nullable(),
    selectedSmes: z.number().int().min(0).max(100000).nullable(),
    etbPerUsd: z.number().positive().max(100000).nullable(),
    pricesIncludeTax: z.boolean().nullable(),
    taxNote: z.string().trim().min(1).max(600),
    paymentMethods: z.array(PaymentMethodBody).max(10),
    applicationPeriodId: z.uuid().nullable(),
    complimentaryPerSme: z.number().int().min(0).max(20),
    isCurrent: z.literal(true).openapi({ description: "Makes this the edition the website sells. The previous current edition stops being it." }),
  })
  .partial()
  .openapi("SummitEditionPatch");

// The fields of a product with no defaults, so a patch that leaves a field out leaves it alone (a default inside a
// partial schema would be applied, and would overwrite what the product has).
const productFields = z.object({
  kind: Kind,
  slug: Slug,
  name: z.string().trim().min(1).max(120),
  summary: z.string().trim().max(400),
  priceCents: z.number().int().min(0).max(MAX_PRICE_CENTS).openapi({ description: "US dollars' minor units: 156000 is $1,560." }),
  features: z.array(z.string().trim().min(1).max(200)).max(MAX_FEATURES),
  benefits: z.partialRecord(z.enum(BENEFIT_AREA_IDS), z.string().trim().max(400)),
  attributes: z.record(z.string().max(40), z.string().trim().max(200)),
  capacity: z.number().int().min(0).nullable(),
  status: Status,
  sortOrder: z.number().int().min(0).max(10000),
});

export const ProductBody = productFields
  .extend({
    summary: productFields.shape.summary.default(""),
    features: productFields.shape.features.default([]),
    benefits: productFields.shape.benefits.default({}),
    attributes: productFields.shape.attributes.default({}),
    capacity: productFields.shape.capacity.default(null),
    status: Status.default("draft"),
    sortOrder: productFields.shape.sortOrder.default(0),
  })
  .openapi("SummitProductBody");

export const ProductPatch = productFields
  .omit({ kind: true, slug: true })
  .partial()
  .extend({ markedSoldOut: z.boolean().optional() })
  .openapi("SummitProductPatch");
