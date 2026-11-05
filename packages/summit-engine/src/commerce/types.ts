// The commercial side of the Summit (ADTIS): what is for sale, and the words the platform uses for it. Nothing here
// reads a database. The source is the "ADTIS 2027 Website Development Instructions" (commercial packages, exhibition,
// sponsorship and delegate registration); its numbers are the standard catalogue in ./catalogue.ts.

/** What a product is. One catalogue holds all four, so prices, benefits and inventory are edited the same way. */
export const PRODUCT_KINDS = ["exhibition_package", "sponsorship_level", "delegate_category", "opportunity"] as const;
export type ProductKind = (typeof PRODUCT_KINDS)[number];

export const PRODUCT_KIND_LABELS: Readonly<Record<ProductKind, string>> = {
  exhibition_package: "Exhibition package",
  sponsorship_level: "Sponsorship level",
  delegate_category: "Delegate category",
  opportunity: "Additional opportunity",
};

/** Only a published product is shown on the website and can be applied for. An archived one stays for the records that name it. */
export const PRODUCT_STATUSES = ["draft", "published", "archived"] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

/**
 * The areas in which a sponsorship level's benefits are set, in the order the site lists them (section 3). Each level
 * has its own text for each area, and an area left empty is a benefit the level doesn't include.
 */
export const BENEFIT_AREAS = [
  { id: "logo", label: "Logo placement and brand visibility" },
  { id: "speaking", label: "Speaking opportunities" },
  { id: "exhibition", label: "Exhibition space" },
  { id: "delegates", label: "Delegate passes" },
  { id: "digital", label: "Website and digital marketing" },
  { id: "social", label: "Social media visibility" },
  { id: "b2b", label: "B2B matchmaking" },
  { id: "networking", label: "Networking events" },
  { id: "exclusivity", label: "Category exclusivity" },
] as const;
export type BenefitAreaId = (typeof BENEFIT_AREAS)[number]["id"];
export const BENEFIT_AREA_IDS = BENEFIT_AREAS.map((a) => a.id) as [BenefitAreaId, ...BenefitAreaId[]];

/** The benefits of one sponsorship level: text by area. */
export type Benefits = Partial<Record<BenefitAreaId, string>>;

/**
 * The rows of the exhibition packages' side-by-side comparison. A package's `attributes` hold one value for each row
 * (empty where the specification gives none, which the comparison shows as a dash).
 */
export const EXHIBITION_COMPARISON = [
  { id: "boothSize", label: "Booth size" },
  { id: "exhibitorPasses", label: "Exhibitor passes" },
  { id: "furniture", label: "Furniture" },
  { id: "placement", label: "Location" },
  { id: "directory", label: "Digital directory" },
  { id: "networking", label: "B2B and networking" },
] as const;
export type ComparisonRowId = (typeof EXHIBITION_COMPARISON)[number]["id"];

/** Free-form facts about a product, such as the comparison rows of an exhibition package. */
export type ProductAttributes = Record<string, string>;

/** What an administrator sets on a product. The database adds the id, the edition and the timestamps. */
export interface ProductDefinition {
  kind: ProductKind;
  /** The product's address on the site and in the API. Unique inside an edition. */
  slug: string;
  name: string;
  /** One or two sentences under the name. */
  summary: string;
  /** In US dollars' minor units (cents). Zero is complimentary. */
  priceCents: number;
  /** The benefits as a list, shown on the product's card. */
  features: string[];
  /** Sponsorship levels only. */
  benefits: Benefits;
  attributes: ProductAttributes;
  /** How many can be taken (booths, passes). Null means no limit has been set. */
  capacity: number | null;
  status: ProductStatus;
  sortOrder: number;
}

/** A payment's status (section 12). Only a person verifying evidence moves a payment to confirmed. */
export const PAYMENT_STATUSES = ["pending", "awaiting_verification", "confirmed", "cancelled", "refunded"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_STATUS_LABELS: Readonly<Record<PaymentStatus, string>> = {
  pending: "Pending",
  awaiting_verification: "Awaiting verification",
  confirmed: "Confirmed",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

/** One way to pay, as the organisers describe it to applicants (bank transfer details, a payment link, and so on). */
export interface PaymentMethod {
  id: string;
  label: string;
  /** Shown to the applicant in the approval email and on their booking page. */
  instructions: string;
}
