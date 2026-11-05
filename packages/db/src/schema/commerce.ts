import { sql } from "drizzle-orm";
import { boolean, check, index, integer, jsonb, numeric, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import {
  PRODUCT_KINDS,
  PRODUCT_STATUSES,
  type Benefits,
  type PaymentMethod,
  type ProductAttributes,
} from "@entrust/summit-engine";
import { user } from "./auth";
import { applicationPeriod, summit } from "./summit";

// The commercial side of ADTIS (exhibition, sponsorship, delegates), in the summit schema. Everything an edition
// sells is rows here, so the organisers change prices, benefits and inventory without a developer, and the next
// edition is a copy of this one.

// One edition of the summit. Exactly one is "current": the one the website sells.
export const commerceEdition = summit.table(
  "commerce_edition",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // The edition's address in the API and the site, like "adtis-2027".
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    venue: text("venue").notNull(),
    // Shown as written. The exact days are not announced, so this is words, not dates.
    datesNote: text("dates_note").notNull(),
    days: integer("days").notNull().default(3),
    expectedAttendance: integer("expected_attendance"),
    selectedSmes: integer("selected_smes"),
    currency: text("currency").notNull().default("USD"),
    // A reference figure from the instructions (USD 1 = ETB 160). Prices are in USD and this isn't used to show any.
    etbPerUsd: numeric("etb_per_usd", { precision: 10, scale: 2 }),
    // Whether the displayed prices include applicable taxes. Null until the organisers confirm.
    pricesIncludeTax: boolean("prices_include_tax"),
    taxNote: text("tax_note").notNull(),
    // How applicants pay, in the organisers' words.
    paymentMethods: jsonb("payment_methods").$type<PaymentMethod[]>().notNull().default([]),
    // The assessment period whose selected SMEs register free.
    applicationPeriodId: uuid("application_period_id").references(() => applicationPeriod.id, { onDelete: "set null" }),
    // Complimentary delegate registrations each selected SME has.
    complimentaryPerSme: integer("complimentary_per_sme").notNull().default(1),
    isCurrent: boolean("is_current").notNull().default(false),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    // At most one current edition.
    uniqueIndex("commerce_edition_current_uidx").on(t.isCurrent).where(sql`${t.isCurrent}`),
    check("commerce_edition_complimentary_check", sql`${t.complimentaryPerSme} >= 0`),
  ],
);

// Something an edition sells: an exhibition package, a sponsorship level, a delegate category or another opportunity.
export const commerceProduct = summit.table(
  "commerce_product",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    editionId: uuid("edition_id")
      .notNull()
      .references(() => commerceEdition.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: PRODUCT_KINDS }).notNull(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    summary: text("summary").notNull().default(""),
    // US dollars' minor units. Zero is complimentary.
    priceCents: integer("price_cents").notNull(),
    features: jsonb("features").$type<string[]>().notNull().default([]),
    // Sponsorship levels: text for each benefit area.
    benefits: jsonb("benefits").$type<Benefits>().notNull().default({}),
    attributes: jsonb("attributes").$type<ProductAttributes>().notNull().default({}),
    // How many can be taken. Null: no limit set.
    capacity: integer("capacity"),
    // An administrator marking it sold out, whatever the capacity says.
    markedSoldOut: boolean("marked_sold_out").notNull().default(false),
    status: text("status", { enum: PRODUCT_STATUSES }).notNull().default("published"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    uniqueIndex("commerce_product_slug_uidx").on(t.editionId, t.slug),
    index("commerce_product_edition_idx").on(t.editionId, t.kind, t.sortOrder),
    check("commerce_product_price_check", sql`${t.priceCents} >= 0`),
    check("commerce_product_capacity_check", sql`${t.capacity} is null or ${t.capacity} >= 0`),
  ],
);
