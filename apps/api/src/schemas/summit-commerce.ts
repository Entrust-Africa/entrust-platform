import { z } from "@hono/zod-openapi";
import {
  BENEFIT_AREA_IDS,
  BOOKING_STATUSES,
  DELEGATE_STATUSES,
  ENQUIRY_STATUSES,
  MAX_FEATURES,
  MAX_PRICE_CENTS,
  PAYMENT_STATUSES,
  PAYMENT_SUBJECTS,
  PRODUCT_KINDS,
  PRODUCT_STATUSES,
  SLUG_PATTERN,
} from "@entrust/summit-engine";

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
    exhibitionZones: z.array(z.string()).openapi({ description: "The zones an exhibitor can ask for. Empty: the form takes free text." }),
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
    exhibitionZones: z.array(z.string()),
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
    exhibitionZones: z.array(z.string().trim().min(1).max(80)).max(40),
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


// ---- Exhibitor bookings ----

const CountryCode = z.string().trim().toUpperCase().pipe(z.string().regex(/^[A-Z]{2}$/, "Use a two-letter country code.")).openapi({ example: "ET" });
const Email = z.string().trim().max(254).pipe(z.email());
const BookingStatusEnum = z.enum(BOOKING_STATUSES);
const PaymentStatusEnum = z.enum(PAYMENT_STATUSES);
const optionalText = (max: number) => z.string().trim().max(max).optional();

export const ExhibitorApplicationBody = z
  .object({
    packageSlug: z.string().trim().min(1).max(60).openapi({ example: "standard-sme-booth", description: "The exhibition package, by its address in the catalogue." }),
    companyName: z.string().trim().min(1).max(160),
    country: CountryCode,
    registrationDetails: z.string().trim().min(2).max(500).openapi({ description: "The business registration number and registering authority." }),
    contactName: z.string().trim().min(2).max(120),
    position: z.string().trim().min(1).max(120),
    email: Email,
    phone: z.string().trim().min(5).max(40).openapi({ description: "Telephone or WhatsApp." }),
    sector: z.string().trim().min(1).max(120),
    productsServices: z.string().trim().min(2).max(1000),
    website: optionalText(200),
    preferredZone: optionalText(80),
    boothRequirements: optionalText(1000),
    comments: optionalText(1000),
    consent: z.literal(true).openapi({ description: "The applicant agreed to be contacted about the application. Must be true." }),
    nickname: z.string().optional().openapi({ description: "A trap for bots: people leave it empty. Anything in it is discarded without a trace." }),
  })
  .openapi("SummitExhibitorApplicationBody");

export const ExhibitorApplicationReceipt = z
  .object({
    number: z.string().openapi({ example: "EXH-0007" }),
    packageName: z.string(),
    amountCents: z.number().int(),
    price: z.string().openapi({ example: "$500" }),
  })
  .openapi("SummitExhibitorApplicationReceipt");

export const Payment = z
  .object({
    id: z.uuid(),
    subjectType: z.enum(PAYMENT_SUBJECTS),
    subjectId: z.uuid(),
    status: PaymentStatusEnum,
    amountDueCents: z.number().int(),
    amountReceivedCents: z.number().int().nullable(),
    method: z.string().nullable(),
    reference: z.string().nullable(),
    evidence: z.object({ id: z.uuid(), name: z.string() }).nullable(),
    note: z.string().nullable(),
    verifiedBy: z.object({ id: z.string(), name: z.string() }).nullable(),
    verifiedAt: Timestamp.nullable(),
    updatedAt: Timestamp,
  })
  .openapi("SummitPayment");

export const BookingItem = z
  .object({
    id: z.uuid(),
    number: z.string().openapi({ example: "EXH-0007" }),
    status: BookingStatusEnum,
    productId: z.uuid(),
    packageName: z.string(),
    packageSlug: z.string(),
    companyName: z.string(),
    country: z.string(),
    sector: z.string(),
    contactName: z.string(),
    email: z.string(),
    phone: z.string(),
    amountCents: z.number().int(),
    boothNumber: z.string().nullable(),
    zone: z.string().nullable(),
    paymentStatus: PaymentStatusEnum.nullable().openapi({ description: "Null until the application is approved and a payment is opened." }),
    createdAt: Timestamp,
    decidedAt: Timestamp.nullable(),
  })
  .openapi("SummitBookingItem");

export const BookingDetail = BookingItem.extend({
  registrationDetails: z.string(),
  position: z.string(),
  productsServices: z.string(),
  website: z.string().nullable(),
  preferredZone: z.string().nullable(),
  boothRequirements: z.string().nullable(),
  comments: z.string().nullable(),
  decisionNote: z.string().nullable(),
  decidedBy: z.object({ id: z.string(), name: z.string() }).nullable(),
  confirmedAt: Timestamp.nullable(),
  payment: Payment.nullable(),
  blockers: z.array(z.string()).openapi({ description: "Why this booking can't be confirmed yet. Empty when it can." }),
  packageAvailability: ProductAvailability,
}).openapi("SummitBookingDetail");

export const BookingQuery = z.object({
  editionId: z.uuid().optional().openapi({ description: "Default: the current edition." }),
  status: BookingStatusEnum.optional(),
  productId: z.uuid().optional(),
  q: z.string().trim().max(100).optional().openapi({ description: "Part of the company name, contact, email or reference." }),
  limit: z.coerce.number().int().min(1).max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

export const BookingList = z
  .object({
    items: z.array(BookingItem),
    total: z.number().int(),
    byStatus: z.record(z.string(), z.number().int()).openapi({ description: "How many bookings of the edition are in each status, across all of them." }),
  })
  .openapi("SummitBookingList");

export const BookingParam = z.object({ id: z.uuid() });

export const ApproveBody = z
  .object({
    note: optionalText(1000).openapi({ description: "Sent to the applicant with the approval." }),
    boothNumber: optionalText(20),
    zone: optionalText(80),
  })
  .openapi("SummitBookingApproveBody");

export const ReasonBody = z.object({ reason: z.string().trim().min(2).max(1000) }).openapi("SummitBookingReasonBody");

export const AllocationBody = z
  .object({
    boothNumber: z.string().trim().min(1).max(20).nullable(),
    zone: z.string().trim().min(1).max(80).nullable(),
  })
  .openapi("SummitBookingAllocationBody");

export const PaymentParam = z.object({ id: z.uuid() });

export const PaymentPatch = z
  .object({
    status: PaymentStatusEnum,
    amountDueCents: z.number().int().min(0).max(MAX_PRICE_CENTS).openapi({ description: "Administrators only: what is owed, if it was negotiated." }),
    amountReceivedCents: z.number().int().min(0).max(MAX_PRICE_CENTS).nullable(),
    method: z.string().trim().min(1).max(40).nullable().openapi({ description: "The id of one of the edition's payment methods." }),
    reference: z.string().trim().min(1).max(200).nullable(),
    note: z.string().trim().min(1).max(1000).nullable(),
    evidenceFileId: z.uuid().nullable().openapi({ description: "A file uploaded to Entrust's organisation through the files API: the proof of payment." }),
  })
  .partial()
  .openapi("SummitPaymentPatch");

export const EvidenceUrl = z
  .object({ downloadUrl: z.string(), expiresInSeconds: z.number().int(), fileName: z.string(), contentType: z.string() })
  .openapi("SummitPaymentEvidenceUrl");


// ---- Sponsorship and opportunity enquiries ----

const EnquiryStatusEnum = z.enum(ENQUIRY_STATUSES);

export const SponsorEnquiryBody = z
  .object({
    productSlug: z.string().trim().min(1).max(60).openapi({ example: "gold-partner", description: "A sponsorship level or additional opportunity, by its address in the catalogue." }),
    organisationName: z.string().trim().min(1).max(160),
    country: CountryCode,
    contactName: z.string().trim().min(2).max(120),
    position: z.string().trim().min(1).max(120),
    email: Email,
    phone: z.string().trim().min(5).max(40),
    sector: z.string().trim().min(1).max(120),
    objectives: z.string().trim().min(5).max(2000).openapi({ description: "What the organisation wants from sponsoring." }),
    requirements: optionalText(2000),
    consent: z.literal(true).openapi({ description: "The organisation agreed to be contacted about the enquiry. Must be true." }),
    nickname: z.string().optional().openapi({ description: "A trap for bots: people leave it empty. Anything in it is discarded without a trace." }),
  })
  .openapi("SummitSponsorEnquiryBody");

export const SponsorEnquiryReceipt = z
  .object({
    number: z.string().openapi({ example: "SPN-0004" }),
    productName: z.string(),
    price: z.string().openapi({ example: "$6,250" }),
  })
  .openapi("SummitSponsorEnquiryReceipt");

export const EnquiryItem = z
  .object({
    id: z.uuid(),
    number: z.string(),
    status: EnquiryStatusEnum,
    productId: z.uuid(),
    productName: z.string(),
    productKind: Kind,
    organisationName: z.string(),
    country: z.string(),
    contactName: z.string(),
    email: z.string(),
    sector: z.string(),
    valueCents: z.number().int(),
    paymentStatus: PaymentStatusEnum.nullable().openapi({ description: "Null until the sponsorship is confirmed and a payment is opened." }),
    createdAt: Timestamp,
    statusChangedAt: Timestamp,
  })
  .openapi("SummitEnquiryItem");

export const EnquiryDetail = EnquiryItem.extend({
  position: z.string(),
  phone: z.string(),
  objectives: z.string(),
  requirements: z.string().nullable(),
  notes: z.string().nullable(),
  payment: Payment.nullable(),
  history: z.array(z.object({ at: Timestamp, by: z.string().nullable(), from: EnquiryStatusEnum.nullable(), to: EnquiryStatusEnum, note: z.string().nullable() })),
}).openapi("SummitEnquiryDetail");

export const EnquiryQuery = z.object({
  editionId: z.uuid().optional().openapi({ description: "Default: the current edition." }),
  status: EnquiryStatusEnum.optional(),
  productId: z.uuid().optional(),
  kind: z.enum(["sponsorship_level", "opportunity"]).optional(),
  q: z.string().trim().max(100).optional().openapi({ description: "Part of the organisation, contact, email or reference." }),
  limit: z.coerce.number().int().min(1).max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

export const EnquiryList = z
  .object({
    items: z.array(EnquiryItem),
    total: z.number().int(),
    byStatus: z.record(z.string(), z.number().int()).openapi({ description: "How many enquiries of the edition are in each status, across all of them." }),
    pipeline: z.object({
      openCount: z.number().int(),
      openValueCents: z.number().int().openapi({ description: "What the enquiries still being worked would bring in if all were confirmed." }),
      confirmedCount: z.number().int(),
      confirmedValueCents: z.number().int(),
    }),
  })
  .openapi("SummitEnquiryList");

export const EnquiryParam = z.object({ id: z.uuid() });

export const EnquiryPatch = z
  .object({
    valueCents: z.number().int().min(0).max(MAX_PRICE_CENTS).openapi({ description: "What the sponsorship is worth, if negotiated. Not changeable once confirmed: change the payment's amount owed instead." }),
    notes: z.string().trim().min(1).max(4000).nullable().openapi({ description: "For the organisers only." }),
  })
  .partial()
  .openapi("SummitEnquiryPatch");

export const EnquiryStatusBody = z
  .object({ status: EnquiryStatusEnum, note: z.string().trim().min(1).max(1000).optional() })
  .openapi("SummitEnquiryStatusBody");


// ---- Delegates ----

const DelegateStatusEnum = z.enum(DELEGATE_STATUSES);
const BadgeStateEnum = z.enum(["valid", "already_checked_in", "not_valid"]);

export const DelegateRegistrationBody = z
  .object({
    categorySlug: z.string().trim().min(1).max(60).openapi({ example: "general-business", description: "The delegate category, by its address in the catalogue." }),
    fullName: z.string().trim().min(2).max(120),
    email: Email,
    phone: optionalText(40),
    organisation: optionalText(160).openapi({ description: "Required, except for a selected SME, whose business is taken from its application." }),
    jobTitle: z.string().trim().min(1).max(120),
    country: CountryCode.optional().openapi({ description: "Required, except for a selected SME, whose country is taken from its application." }),
    sector: optionalText(120),
    needs: optionalText(500).openapi({ description: "Dietary or accessibility needs." }),
    applicationNumber: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^SUM-\d{4,}$/, "Use the application number from your ADTIS application, like SUM-000123.")
      .optional()
      .openapi({ example: "SUM-000123", description: "A selected SME's application number: it registers free, with no second application." }),
    consent: z.literal(true).openapi({ description: "The delegate agreed to be contacted about the summit. Must be true." }),
    nickname: z.string().optional().openapi({ description: "A trap for bots: people leave it empty. Anything in it is discarded without a trace." }),
  })
  .openapi("SummitDelegateRegistrationBody");

export const DelegateReceipt = z
  .object({
    number: z.string().openapi({ example: "DEL-00042" }),
    categoryName: z.string(),
    price: z.string().openapi({ example: "$65" }),
    paymentRequired: z.boolean().openapi({ description: "False for a complimentary registration." }),
    alreadyRegistered: z.boolean().openapi({ description: "This address was registered and paid already, so nothing was changed." }),
  })
  .openapi("SummitDelegateReceipt");

export const PublicBadge = z
  .object({
    number: z.string(),
    fullName: z.string(),
    organisation: z.string(),
    country: z.string(),
    category: z.string(),
    edition: z.object({ name: z.string(), venue: z.string(), datesNote: z.string() }),
    valid: z.boolean().openapi({ description: "False while the payment is unverified, or if the registration was cancelled." }),
    reason: z.string().nullable().openapi({ description: "Why the badge is not valid yet." }),
    url: z.string().nullable().openapi({ description: "The badge's address: what the QR code holds." }),
  })
  .openapi("SummitPublicBadge");

export const BadgeParam = z.object({ token: z.string().min(16).max(64).regex(/^[A-Za-z0-9_-]+$/) });

export const DelegateItem = z
  .object({
    id: z.uuid(),
    number: z.string(),
    status: DelegateStatusEnum,
    productId: z.uuid(),
    categoryName: z.string(),
    fullName: z.string(),
    email: z.string(),
    organisation: z.string(),
    country: z.string(),
    sector: z.string().nullable(),
    amountCents: z.number().int(),
    paymentStatus: PaymentStatusEnum.nullable(),
    selectedSme: z.boolean(),
    checkedInAt: Timestamp.nullable(),
    createdAt: Timestamp,
  })
  .openapi("SummitDelegateItem");

export const DelegateDetail = DelegateItem.extend({
  phone: z.string().nullable(),
  jobTitle: z.string(),
  needs: z.string().nullable(),
  application: z.object({ id: z.uuid(), number: z.string() }).nullable(),
  payment: Payment.nullable(),
  badge: z.object({ state: BadgeStateEnum, problems: z.array(z.string()), url: z.string().nullable() }),
  checkedInBy: z.object({ id: z.string(), name: z.string() }).nullable(),
}).openapi("SummitDelegateDetail");

export const DelegateQuery = z.object({
  editionId: z.uuid().optional().openapi({ description: "Default: the current edition." }),
  status: DelegateStatusEnum.optional(),
  productId: z.uuid().optional(),
  paymentStatus: PaymentStatusEnum.optional(),
  checkedIn: z.enum(["true", "false"]).optional(),
  country: CountryCode.optional(),
  q: z.string().trim().max(100).optional().openapi({ description: "Part of the name, organisation, email or reference." }),
  limit: z.coerce.number().int().min(1).max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

export const DelegateList = z
  .object({
    items: z.array(DelegateItem),
    total: z.number().int(),
    totals: z
      .object({
        registered: z.number().int(),
        cancelled: z.number().int(),
        paymentConfirmed: z.number().int().openapi({ description: "Registered delegates whose payment is verified (or who owe nothing)." }),
        paymentPending: z.number().int().openapi({ description: "Registered delegates whose payment is pending or awaiting verification." }),
        checkedIn: z.number().int(),
      })
      .openapi({ description: "For the whole edition, whatever the filters." }),
  })
  .openapi("SummitDelegateList");

export const DelegateParam = z.object({ id: z.uuid() });

export const DelegatePatch = z
  .object({
    fullName: z.string().trim().min(2).max(120),
    phone: z.string().trim().min(5).max(40).nullable(),
    organisation: z.string().trim().min(1).max(160),
    jobTitle: z.string().trim().min(1).max(120),
    country: CountryCode,
    sector: z.string().trim().min(1).max(120).nullable(),
    needs: z.string().trim().min(1).max(500).nullable(),
  })
  .partial()
  .openapi("SummitDelegatePatch");

export const CheckInQuery = z.object({
  code: z.string().trim().min(1).max(300).openapi({ description: "What the QR code holds (the badge's address), the token in it, or the registration reference." }),
});
