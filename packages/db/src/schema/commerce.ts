import { sql } from "drizzle-orm";
import { boolean, check, index, integer, jsonb, numeric, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import {
  BOOKING_STATUSES,
  ENQUIRY_STATUSES,
  PAYMENT_STATUSES,
  PAYMENT_SUBJECTS,
  PRODUCT_KINDS,
  PRODUCT_STATUSES,
  type Benefits,
  type PaymentMethod,
  type ProductAttributes,
} from "@entrust/summit-engine";
import { user } from "./auth";
import { file } from "./core";
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
    // The exhibition zones an exhibitor can ask for (and an administrator assigns), such as "Hall A". Empty: free text.
    exhibitionZones: jsonb("exhibition_zones").$type<string[]>().notNull().default([]),
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

// Exhibitor bookings take their reference from here: EXH-0001, in the order applications came in.
export const exhibitorBookingNumberSeq = summit.sequence("exhibitor_booking_number_seq");

// An application for exhibition space, from the public form (no sign-in). It moves from submitted to approved (the booth
// is held and payment is asked for) to confirmed (payment verified and a booth number given); an administrator makes each
// move. Only approved and confirmed bookings count against the package's capacity.
export const exhibitorBooking = summit.table(
  "exhibitor_booking",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    number: text("number")
      .notNull()
      .unique()
      .default(sql`'EXH-' || lpad(nextval('summit.exhibitor_booking_number_seq')::text, 4, '0')`),
    editionId: uuid("edition_id")
      .notNull()
      .references(() => commerceEdition.id),
    productId: uuid("product_id")
      .notNull()
      .references(() => commerceProduct.id),
    status: text("status", { enum: BOOKING_STATUSES }).notNull().default("submitted"),
    companyName: text("company_name").notNull(),
    // ISO 3166-1 alpha-2 code.
    country: text("country").notNull(),
    registrationDetails: text("registration_details").notNull(),
    contactName: text("contact_name").notNull(),
    position: text("position").notNull(),
    // Lower case.
    email: text("email").notNull(),
    phone: text("phone").notNull(),
    sector: text("sector").notNull(),
    productsServices: text("products_services").notNull(),
    website: text("website"),
    preferredZone: text("preferred_zone"),
    boothRequirements: text("booth_requirements"),
    comments: text("comments"),
    // The price when the application was made. A later price change doesn't change what this exhibitor owes.
    amountCents: integer("amount_cents").notNull(),
    // What the administrator assigns: a booth number, unique among the edition's held bookings, and a zone.
    boothNumber: text("booth_number"),
    zone: text("zone"),
    decidedBy: text("decided_by").references(() => user.id, { onDelete: "set null" }),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    // What the administrator told the applicant when approving or rejecting.
    decisionNote: text("decision_note"),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    // When the "we have your application" email was last queued, so a repeat submission can't flood an inbox.
    receiptSentAt: timestamp("receipt_sent_at", { withTimezone: true }),
    consentedAt: timestamp("consented_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    index("exhibitor_booking_edition_idx").on(t.editionId, t.status),
    index("exhibitor_booking_product_idx").on(t.productId, t.status),
    index("exhibitor_booking_email_idx").on(t.email),
    // A booth number belongs to one held booking of an edition.
    uniqueIndex("exhibitor_booking_booth_uidx")
      .on(t.editionId, t.boothNumber)
      .where(sql`${t.boothNumber} is not null and ${t.status} in ('approved', 'confirmed')`),
  ],
);

// What is owed for a booking, a sponsorship or a delegate registration, and whether it has been paid. One per subject.
// A payment is never confirmed by the platform on its own: an administrator checks the evidence and confirms it.
export const commercePayment = summit.table(
  "commerce_payment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    editionId: uuid("edition_id")
      .notNull()
      .references(() => commerceEdition.id),
    subjectType: text("subject_type", { enum: PAYMENT_SUBJECTS }).notNull(),
    // The booking, sponsorship or delegate registration. Not a foreign key: it points at one of three tables.
    subjectId: uuid("subject_id").notNull(),
    status: text("status", { enum: PAYMENT_STATUSES }).notNull().default("pending"),
    amountDueCents: integer("amount_due_cents").notNull(),
    // What the administrator found had arrived, when it is recorded.
    amountReceivedCents: integer("amount_received_cents"),
    // One of the edition's payment methods, by id.
    method: text("method"),
    // The payer's own reference for the transfer (a bank reference, a transaction number).
    reference: text("reference"),
    // A file in the files store: the proof of payment, owned by Entrust's organisation.
    evidenceFileId: uuid("evidence_file_id").references(() => file.id, { onDelete: "set null" }),
    note: text("note"),
    verifiedBy: text("verified_by").references(() => user.id, { onDelete: "set null" }),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    uniqueIndex("commerce_payment_subject_uidx").on(t.subjectType, t.subjectId),
    index("commerce_payment_edition_idx").on(t.editionId, t.status),
    check("commerce_payment_amounts_check", sql`${t.amountDueCents} >= 0 and (${t.amountReceivedCents} is null or ${t.amountReceivedCents} >= 0)`),
  ],
);

// Sponsorship enquiries take their reference from here: SPN-0001, in the order they came in.
export const sponsorEnquiryNumberSeq = summit.sequence("sponsor_enquiry_number_seq");

// An organisation's interest in a sponsorship level or another opportunity, from the public form (no sign-in). The
// organisers take it through the pipeline; confirming it makes the organisation a sponsor and opens a payment for the value.
export const sponsorEnquiry = summit.table(
  "sponsor_enquiry",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    number: text("number")
      .notNull()
      .unique()
      .default(sql`'SPN-' || lpad(nextval('summit.sponsor_enquiry_number_seq')::text, 4, '0')`),
    editionId: uuid("edition_id")
      .notNull()
      .references(() => commerceEdition.id),
    // A sponsorship level or an additional opportunity.
    productId: uuid("product_id")
      .notNull()
      .references(() => commerceProduct.id),
    status: text("status", { enum: ENQUIRY_STATUSES }).notNull().default("new"),
    organisationName: text("organisation_name").notNull(),
    // ISO 3166-1 alpha-2 code.
    country: text("country").notNull(),
    contactName: text("contact_name").notNull(),
    position: text("position").notNull(),
    // Lower case.
    email: text("email").notNull(),
    phone: text("phone").notNull(),
    sector: text("sector").notNull(),
    objectives: text("objectives").notNull(),
    requirements: text("requirements"),
    // What the sponsorship is worth: the product's price when the enquiry came in, changed if the deal is negotiated.
    valueCents: integer("value_cents").notNull(),
    // For the organisers only.
    notes: text("notes"),
    statusChangedAt: timestamp("status_changed_at", { withTimezone: true }).defaultNow().notNull(),
    receiptSentAt: timestamp("receipt_sent_at", { withTimezone: true }),
    consentedAt: timestamp("consented_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    index("sponsor_enquiry_edition_idx").on(t.editionId, t.status),
    index("sponsor_enquiry_product_idx").on(t.productId, t.status),
    index("sponsor_enquiry_email_idx").on(t.email),
    check("sponsor_enquiry_value_check", sql`${t.valueCents} >= 0`),
  ],
);
