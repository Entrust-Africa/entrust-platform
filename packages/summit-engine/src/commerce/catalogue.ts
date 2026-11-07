import { toCents } from "./money";
import type { Benefits, PaymentMethod, ProductDefinition } from "./types";

// The standard catalogue for an edition of ADTIS: the packages, levels, categories and opportunities of the website
// instructions, with their prices. An administrator creates an edition from it (or copies the last edition) and then
// edits everything in the admin screens, so this file is a starting point and never the live data.
//
// Prices, booth sizes and the lists of what each delegate category and exhibition package includes are the
// instructions' own, except the sponsorship levels, which are the Pan African Chamber of Commerce's (see below). These
// were not given and are a proposal for the organisers to confirm or change: the descriptions of the additional
// opportunities, and every capacity (left unset, so nothing sells out until the organisers say how many there are).

export const STANDARD_EDITION = {
  slug: "adtis-2027",
  name: "Africa Diaspora Trade & Investment Summit 2027",
  venue: "Addis Ababa, Ethiopia",
  // January 2027 is the planning period; the exact days are not announced (do not publish any other date).
  datesNote: "January 2027 (exact dates to be announced)",
  days: 3,
  expectedAttendance: 300,
  selectedSmes: 100,
  /** Reference only: the instructions fix prices in USD and note USD 1 = ETB 160. */
  etbPerUsd: 160,
  // The organisers have not confirmed VAT or any other tax, so the site says prices exclude nothing and include nothing
  // until they do (section 12: "clearly indicate whether displayed prices include or exclude applicable taxes").
  pricesIncludeTax: null as boolean | null,
  taxNote: "All prices are in US dollars. VAT and other applicable taxes have not been confirmed; if they apply they will be added separately to the amount shown.",
  /** No bank details or links are invented: the organisers add their payment methods in the admin screen. */
  paymentMethods: [] as PaymentMethod[],
  /** How many complimentary delegate registrations each selected SME has. */
  complimentaryPerSme: 1,
} as const;

const product = (p: Omit<ProductDefinition, "benefits" | "attributes" | "capacity" | "status"> & Partial<Pick<ProductDefinition, "benefits" | "attributes">>): ProductDefinition => ({
  benefits: {},
  attributes: {},
  capacity: null,
  status: "published",
  ...p,
});

const dollars = toCents;

const exhibition: ProductDefinition[] = [
  product({
    kind: "exhibition_package",
    slug: "standard-sme-booth",
    name: "Standard SME Booth",
    summary: "A 3m × 2m booth for SMEs showing their products to buyers and investors.",
    priceCents: dollars(500),
    sortOrder: 10,
    features: [
      "Three-day exhibition space",
      "Branded booth fascia",
      "One table and two chairs",
      "Electricity and lighting",
      "Company listing in the ADTIS digital exhibitor directory",
      "Two exhibitor passes",
      "Access to networking and B2B sessions",
    ],
    attributes: {
      boothSize: "3m × 2m (6m²)",
      exhibitorPasses: "2",
      furniture: "One table, two chairs",
      placement: "Standard",
      directory: "Company listing",
      networking: "Networking and B2B sessions",
    },
  }),
  product({
    kind: "exhibition_package",
    slug: "premium-sme-booth",
    name: "Premium SME Booth",
    summary: "A larger 3m × 3m booth with priority placement and an enhanced directory profile.",
    priceCents: dollars(900),
    sortOrder: 20,
    features: [
      "Larger exhibition space",
      "Enhanced booth branding",
      "One table and four chairs",
      "Electricity and lighting",
      "Three exhibitor passes",
      "Priority booth placement",
      "Enhanced company profile in the ADTIS directory",
      "Access to networking and B2B sessions",
    ],
    attributes: {
      boothSize: "3m × 3m (9m²)",
      exhibitorPasses: "3",
      furniture: "One table, four chairs",
      placement: "Priority placement",
      directory: "Enhanced company profile",
      networking: "Networking and B2B sessions",
    },
  }),
  product({
    kind: "exhibition_package",
    slug: "corporate-institutional-booth",
    name: "Corporate / Institutional Booth",
    summary: "A premium-location booth for companies and institutions, with priority B2B introductions.",
    priceCents: dollars(1600),
    sortOrder: 30,
    features: [
      "Premium exhibition location",
      "Corporate branding",
      "Four exhibitor passes",
      "Full company profile in the digital directory",
      "Business networking opportunities",
      "Priority B2B introductions",
      "Access to investor and buyer networking sessions",
    ],
    attributes: {
      boothSize: "3m × 3m (9m²)",
      exhibitorPasses: "4",
      furniture: "",
      placement: "Premium location",
      directory: "Full company profile",
      networking: "Priority B2B introductions; investor and buyer networking sessions",
    },
  }),
  product({
    kind: "exhibition_package",
    slug: "international-exhibitor-booth",
    name: "International Exhibitor Booth",
    summary: "A 3m × 3m booth for exhibitors from outside Africa, with B2B matchmaking access.",
    priceCents: dollars(1500),
    sortOrder: 40,
    features: [
      "Three-day exhibition space",
      "Standard exhibition setup",
      "Company branding and directory listing",
      "Two exhibitor passes",
      "B2B matchmaking access",
      "Investor and buyer networking opportunities",
    ],
    attributes: {
      boothSize: "3m × 3m (9m²)",
      exhibitorPasses: "2",
      furniture: "Standard exhibition setup",
      placement: "Standard",
      directory: "Company branding and listing",
      networking: "B2B matchmaking; investor and buyer networking",
    },
  }),
  product({
    kind: "exhibition_package",
    slug: "sme-table-top",
    name: "SME Table-top Exhibition",
    summary: "Table-top display space for smaller businesses that want exhibition visibility at a lower cost.",
    priceCents: dollars(250),
    sortOrder: 50,
    features: [
      "Dedicated table-top display space",
      "Company identification",
      "One table and two chairs",
      "One exhibitor pass",
      "Company listing in the ADTIS directory",
      "Access to general networking sessions",
    ],
    attributes: {
      boothSize: "Table-top display",
      exhibitorPasses: "1",
      furniture: "One table, two chairs",
      placement: "Standard",
      directory: "Company listing",
      networking: "General networking sessions",
    },
  }),
];

// The sponsorship levels are the Pan African Chamber of Commerce's "Trade Missions & Commercial Delegations" tiers, which
// its Diaspora Summit sponsorship plan makes the summit's governing structure. They are bought by partner type, and the
// approved figure is a range: the price is the lowest figure (what an enquiry is valued at until it is negotiated) and
// `priceRange` is what the website shows. The wording of what each level offers is the plan's own; no passes, booths or
// speaking slots are promised in it, so a level lists none. Custom benefits, ticket allocations and any in-kind value are
// agreed in a signed sponsorship agreement.
const level = (slug: string, name: string, fromDollars: number, priceRange: string, sortOrder: number, summary: string): ProductDefinition =>
  product({
    kind: "sponsorship_level",
    slug,
    name,
    summary,
    priceCents: dollars(fromDollars),
    sortOrder,
    features: [],
    benefits: {},
    attributes: { priceRange },
  });

const sponsorship: ProductDefinition[] = [
  level(
    "mission-presenting-partner",
    "Mission Presenting Partner",
    50000,
    "$50,000 and above",
    10,
    "Top branding across the delegation and the summit platform, with executive visibility and premium association.",
  ),
  level(
    "banking-finance-partner",
    "Banking & Finance Partner",
    25000,
    "$25,000 to $40,000",
    20,
    "Trade finance, financial readiness, investment education, capital access and investor engagement.",
  ),
  level(
    "logistics-supply-chain-partner",
    "Logistics & Supply Chain Partner",
    20000,
    "$20,000 to $30,000",
    30,
    "Freight, logistics, customs and supply-chain expertise, and support for cross-border movement.",
  ),
  level(
    "market-entry-partner",
    "Market Entry Partner",
    15000,
    "$15,000 to $25,000",
    40,
    "Legal, tax, compliance, consulting, market intelligence and business-entry support.",
  ),
  level(
    "travel-hospitality-partner",
    "Travel & Hospitality Partner",
    10000,
    "$10,000 to $25,000, or in-kind",
    50,
    "Airlines, hotels, ground logistics, guest movement and hospitality support. An in-kind contribution is recorded at an agreed value.",
  ),
  level(
    "delegation-supporting-partner",
    "Delegation Supporting Partner",
    5000,
    "$5,000 to $10,000",
    60,
    "Visibility, access, digital recognition and participation support.",
  ),
];

const opportunity = (slug: string, name: string, price: number, sortOrder: number, summary: string): ProductDefinition =>
  product({ kind: "opportunity", slug, name, summary, priceCents: dollars(price), sortOrder, features: [] });

const opportunities: ProductDefinition[] = [
  opportunity(
    "country-pavilion",
    "Country Pavilion",
    4700,
    10,
    "A pavilion for a country, ministry or trade promotion organisation to showcase its businesses and investment opportunities.",
  ),
  opportunity(
    "industry-pavilion",
    "Industry Pavilion",
    3125,
    20,
    "A pavilion for an industry association or sector group to bring its members' businesses and opportunities together.",
  ),
  opportunity(
    "sponsored-b2b-session",
    "Sponsored B2B Matchmaking Session",
    1875,
    30,
    "Put your name on a structured business-to-business matchmaking session between buyers, investors and SMEs.",
  ),
  opportunity(
    "sponsored-conference-session",
    "Sponsored Conference Session",
    1560,
    40,
    "Sponsor a conference session in the programme and be credited as its partner.",
  ),
  opportunity(
    "directory-advertisement",
    "Digital Directory Advertisement",
    313,
    50,
    "An advertisement in the ADTIS digital directory that buyers and investors browse before and after the summit.",
  ),
  opportunity(
    "sme-profile-sponsorship",
    "SME Opportunity Profile Sponsorship",
    625,
    60,
    "Sponsor the digital opportunity profiles of the selected SMEs, with your name on the profiles.",
  ),
  opportunity(
    "investor-reception",
    "Investor Networking Reception Sponsorship",
    3125,
    70,
    "Host the reception where investors, buyers and diaspora partners meet the selected businesses.",
  ),
];

const delegate = (slug: string, name: string, price: number, sortOrder: number, summary: string, features: string[], attributes: Record<string, string> = {}): ProductDefinition =>
  product({ kind: "delegate_category", slug, name, summary, priceCents: dollars(price), sortOrder, features, attributes });

const delegates: ProductDefinition[] = [
  delegate(
    "selected-sme",
    "Selected SME Delegate",
    0,
    10,
    "Complimentary basic participation for the 100 SMEs selected through the ADTIS assessment.",
    [
      "Three-day summit access",
      "Access to general conference sessions",
      "Access to networking sessions",
      "Digital SME business profile",
      "Access to general B2B matchmaking activities",
    ],
    // Registration is checked against the selection list, not open to anyone who picks it.
    { eligibility: "selected_sme", note: "Physical exhibition space is optional and bought separately." },
  ),
  delegate("general-business", "General Business Delegate", 65, 20, "Conference sessions, networking and the exhibition.", [
    "Three-day summit access",
    "Conference sessions",
    "General networking",
    "Access to the exhibition",
  ]),
  delegate("premium", "Premium Delegate", 160, 30, "Priority seating and premium networking, with access to designated B2B sessions.", [
    "Three-day summit access",
    "Priority seating",
    "Premium networking access",
    "Access to designated B2B sessions",
    "Enhanced delegate identification",
  ]),
  delegate("diaspora-business", "Diaspora Business Delegate", 150, 40, "For diaspora entrepreneurs and professionals looking for African SME opportunities.", [
    "Three-day summit access",
    "Business networking",
    "Access to African SME opportunities",
    "B2B matchmaking participation",
    "Access to investor and business networking sessions",
  ]),
  delegate("investor-buyer", "Investor / International Buyer", 250, 50, "Priority matchmaking with the selected SMEs for investors and international buyers.", [
    "Three-day summit access",
    "Priority B2B matchmaking",
    "Access to selected SME opportunity profiles",
    "Investor and buyer networking sessions",
    "Facilitated business introductions, subject to availability",
  ]),
];

export const STANDARD_PRODUCTS: readonly ProductDefinition[] = [...exhibition, ...sponsorship, ...delegates, ...opportunities];
