// The information pages' content: the concept note for ADTIS 2027, section by section. Speakers, partners and news are lists the
// organisers add to as things are confirmed; nothing is invented, so each starts empty and its page says so. A name, a logo or a
// session goes on a page only once the organising team has confirmed it.

export const VISION =
  "To establish a globally connected Africa–Diaspora business and investment platform that facilitates trade, mobilises investment, strengthens enterprise capacity and builds sustainable commercial partnerships.";

export const MISSION =
  "To connect credible African businesses with diaspora and international markets, investment opportunities, business expertise and strategic partnerships through structured engagement, market intelligence, SME assessment and commercial matchmaking.";

export const BACKGROUND = [
  "Africa and its global diaspora have significant economic, commercial, professional and investment resources. However, the connections between these resources and African businesses remain fragmented. Many African SMEs struggle to access international buyers, investment capital, distribution networks, technology and strategic business partnerships.",
  "At the same time, members of the African diaspora possess capital, international business experience, technical expertise, market knowledge and access to global commercial networks that could contribute directly to Africa's economic development. The challenge is creating practical mechanisms that connect these resources to credible business opportunities.",
  "The Africa Diaspora Trade & Investment Summit is designed to address this gap through a structured platform where African businesses, diaspora investors, international buyers, financial institutions, development organisations and business leaders can identify opportunities and develop commercial relationships.",
] as const;

export const OBJECTIVES = [
  ["Facilitate international trade", "Connect African SMEs with international buyers, importers, distributors and regional trade partners."],
  ["Mobilise diaspora investment", "Create opportunities for diaspora investors, investment groups, family offices and institutional investors to identify and engage with viable African businesses."],
  ["Improve SME investment readiness", "Identify and assess businesses on their commercial potential, operational capacity, financial readiness and ability to engage with international partners."],
  ["Strengthen business partnerships", "Facilitate relationships between African enterprises, diaspora entrepreneurs, international companies and strategic institutions."],
  ["Advance Brain Gain", "Create opportunities for diaspora professionals to transfer knowledge, technical expertise, management experience and market connections to African enterprises."],
  ["Promote digital trade", "Explore how digital technologies, market intelligence and digital business infrastructure can improve SME competitiveness and cross-border trade."],
  ["Build a sustainable commercial network", "Establish relationships and mechanisms that continue beyond the summit through partnerships, business introductions and investment facilitation."],
] as const;

export const THEMES = [
  ["A", "Africa–Diaspora trade and market access", "Connecting African producers and exporters to international buyers, distributors and new commercial markets."],
  ["B", "Diaspora investment and capital mobilisation", "Exploring investment opportunities, financing structures and mechanisms through which diaspora capital can support African enterprises."],
  ["C", "SME investment readiness and enterprise development", "Addressing financial records, business governance, operational capacity, market positioning and the requirements for accessing investment."],
  ["D", "Digital trade and market intelligence", "Examining how technology, digital platforms, data and market intelligence can support cross-border commerce and improve competitiveness."],
  ["E", "Brain Gain and knowledge transfer", "Mobilising diaspora professionals, executives and entrepreneurs to contribute expertise, technology, management capabilities and international business networks."],
  ["F", "Regional and global business partnerships", "Strengthening commercial connections across African markets and between Africa and the global diaspora."],
] as const;

export const DAYS = [
  {
    day: "Day one",
    title: "Opening, policy dialogue and strategic partnerships",
    focus: "Connecting Africa and its diaspora through trade, investment and enterprise development.",
    activities: [
      "Official opening ceremony",
      "Welcome addresses and keynote speeches",
      "High-level dialogue on Africa–Diaspora economic cooperation",
      "Policy discussion on trade, investment and regional integration",
      "Diaspora investment and capital mobilisation sessions",
      "Brain Gain: diaspora expertise, technology and knowledge transfer",
      "Institutional and strategic partnership discussions",
      "Networking reception",
    ],
  },
  {
    day: "Day two",
    title: "SME showcase, investment and buyer engagement",
    focus: "Connecting selected African businesses with commercial and investment opportunities.",
    activities: [
      "Presentation of the 100 selected African SMEs",
      "Sector-based business showcases",
      "Product and service exhibitions",
      "Buyer and distributor engagement sessions",
      "Investor presentations and investment opportunity discussions",
      "SME investment-readiness presentations",
      "Structured business-to-business (B2B) meetings",
      "Business networking and partnership discussions",
    ],
  },
  {
    day: "Day three",
    title: "Deal facilitation, partnerships and the way forward",
    focus: "Moving from introductions to practical commercial engagement.",
    activities: [
      "Investment and business opportunity presentations",
      "Targeted investor–SME meetings",
      "Trade and distribution partnership discussions",
      "Diaspora business partnership sessions",
      "Memorandum of Understanding (MoU) and partnership announcements, where agreed",
      "Institutional commitments and collaboration frameworks",
      "Summit outcomes and declarations",
      "Closing ceremony",
    ],
  },
] as const;

export const ASSESSMENT_AREAS = [
  "Business legitimacy and institutional credibility",
  "Commercial offering and market potential",
  "Trade readiness and export capability",
  "Investment and financial readiness",
  "Financial and operational capacity",
  "Diaspora partnership potential",
  "Summit and engagement readiness",
] as const;

export const ASSESSMENT_OUTCOMES = [
  "An eligibility determination",
  "A structured SME readiness assessment",
  "A commercial opportunity profile",
  "Identification of potential trade and investment opportunities",
  "A classification of the SME's readiness for buyer, investor, distributor or strategic partner engagement",
  "A shortlist of 100 selected enterprises",
] as const;

export const SECTORS = [
  "Agriculture and agro-processing",
  "Manufacturing and industrial production",
  "Textiles and garments",
  "Leather and leather products",
  "Gemstones, jewellery and related industries",
  "Technology and digital services",
  "Healthcare and pharmaceuticals",
  "Logistics and supply chain services",
  "Tourism and hospitality",
  "Renewable energy and related services",
  "Professional and business services",
] as const;

export const BRAIN_GAIN = [
  "Share management experience, technical expertise and market connections with African enterprises",
  "Bring technology, digital trade tools and market intelligence to African SMEs",
  "Invest, co-invest or become a distribution or strategic partner",
  "Mentor and advise selected businesses through the investment-readiness sessions",
] as const;

export interface Speaker {
  name: string;
  title: string;
  organisation: string;
  photo?: string;
}

export interface Partner {
  name: string;
  role: string;
  url?: string;
  logo?: string;
}

export interface NewsItem {
  date: string;
  title: string;
  summary: string;
  url?: string;
}

/** Confirmed speakers. Add one here when the organisers have confirmed them; do not list anyone before. */
export const SPEAKERS: readonly Speaker[] = [];

/** Confirmed organisers, sponsors and supporting institutions, published after formal confirmation. */
export const PARTNERS: readonly Partner[] = [];

/** Announcements and summit updates, newest first. */
export const NEWS: readonly NewsItem[] = [];
