import { toCents } from "./money";
import type { Benefits, PaymentMethod, ProductDefinition } from "./types";

// The standard catalogue for an edition of ADTIS: the packages, levels, categories and opportunities of the website
// instructions, with their prices. An administrator creates an edition from it (or copies the last edition) and then
// edits everything in the admin screens, so this file is a starting point and never the live data.
//
// Prices, booth sizes and the lists of what each delegate category and exhibition package includes are the
// instructions' own. These were not given there and are a proposal for the organisers to confirm or change:
// the sponsorship levels' benefit text, the descriptions of the additional opportunities, and every capacity (left
// unset, so nothing sells out until the organisers say how many there are).

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

const level = (
  slug: string,
  name: string,
  price: number,
  sortOrder: number,
  summary: string,
  benefits: Benefits,
): ProductDefinition =>
  product({
    kind: "sponsorship_level",
    slug,
    name,
    summary,
    priceCents: dollars(price),
    sortOrder,
    features: [],
    benefits,
  });

// Each level has its own text, and an area a level leaves out stays empty. Confirmed in a signed sponsorship agreement.
const sponsorship: ProductDefinition[] = [
  level("title-partner", "Title Partner", 31250, 10, "The summit's headline partner, with the most visibility and category exclusivity.", {
    logo: "Headline billing as Title Partner. Logo first and largest on the main stage, website, programme, badges and signage.",
    speaking: "Opening-ceremony keynote and a sponsored conference session.",
    exhibition: "Two Corporate / Institutional booths in premium positions.",
    delegates: "20 delegate passes.",
    digital: "Featured partner page, homepage banner and a place in the pre-summit email campaign.",
    social: "Pinned announcement and dedicated posts on the summit's channels.",
    b2b: "Priority access to buyer and investor matchmaking, with a dedicated matchmaking session.",
    networking: "All networking events, with hosted VIP access.",
    exclusivity: "Category exclusivity, subject to a signed sponsorship agreement.",
  }),
  level("diamond-partner", "Diamond Partner", 18750, 20, "A leading partner with prominent visibility and a speaking slot.", {
    logo: "Logo on the main stage, website, programme and signage, in the second tier.",
    speaking: "A keynote or panel slot.",
    exhibition: "One Corporate / Institutional booth in a premium position.",
    delegates: "12 delegate passes.",
    digital: "Featured partner page and logo on the homepage.",
    social: "Dedicated posts on the summit's channels.",
    b2b: "Priority B2B introductions.",
    networking: "All networking events.",
  }),
  level("platinum-partner", "Platinum Partner", 12500, 30, "A major partner with stage and programme visibility.", {
    logo: "Logo on the stage screens, website and programme.",
    speaking: "One panel seat.",
    exhibition: "One Corporate / Institutional booth.",
    delegates: "8 delegate passes.",
    digital: "Partner page on the website.",
    social: "Two mentions on the summit's channels.",
    b2b: "Priority B2B introductions.",
    networking: "All networking events.",
  }),
  level("gold-partner", "Gold Partner", 6250, 40, "A partner with a booth and a place in the programme.", {
    logo: "Logo on the website and programme.",
    speaking: "Welcome remarks at a networking session.",
    exhibition: "One Premium SME booth.",
    delegates: "5 delegate passes.",
    digital: "Partner listing with a link to its website.",
    social: "One mention on the summit's channels.",
    b2b: "Access to B2B matchmaking.",
    networking: "General networking sessions.",
  }),
  level("silver-partner", "Silver Partner", 3125, 50, "A partner with a booth and delegate passes.", {
    logo: "Logo on the website.",
    exhibition: "One Standard SME booth.",
    delegates: "3 delegate passes.",
    digital: "Partner listing on the website.",
    social: "Included in a thank-you post to all partners.",
    b2b: "Access to B2B matchmaking.",
    networking: "General networking sessions.",
  }),
  level("supporting-partner", "Supporting Partner", 1560, 60, "Show support for the summit with a table-top display and a pass.", {
    logo: "Name in the partners list on the website.",
    exhibition: "A table-top display.",
    delegates: "1 delegate pass.",
    social: "Included in a thank-you post to all partners.",
    networking: "General networking sessions.",
  }),
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
