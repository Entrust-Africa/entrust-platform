/** Copy and images for the /entrust page, taken from the Sketch page "Entrust". */

/** Andinet's indigo, used on this page only. */
export const ANDINET_COLOR = "#4f46a5";

export const ENTRUST_IMG = {
  advisory: "/images/6fc713c8570026df.png",
  umoja: "/images/3b87f2aecf3d87a7.png",
} as const;

/** Hero panel figures. `short` is the label used on phones. */
export const TRACK_RECORD = [
  { value: "120+", label: "SMEs trained" },
  { value: "30+", label: "Companies supported through consulting and advisory", short: "Companies supported" },
  { value: "5+", label: "Countries engaged" },
  { value: "4", label: "Cross-border engagements" },
];

export const INSIDE_ENTRUST = [
  { name: "Advisory", text: "Strategy, finance and operations for growing businesses.", href: "#services", color: "#19954f" },
  { name: "Andinet", text: "Trade forums, deal structuring and delivery across borders.", href: "#andinet", color: ANDINET_COLOR },
];

export const SERVICES = [
  {
    name: "Market entry strategy",
    text: "Market research, competitive analysis and go-to-market roadmaps tailored for African economies.",
    tags: "Opportunity mapping · Competitive landscape · Go-to-market roadmap · Regulatory navigation",
  },
  {
    name: "Financial structuring",
    text: "From fundraising readiness to investor matching and deal structuring, so you can attract and close the right capital.",
    tags: "Investor-ready models · Pitch decks · Due diligence preparation · Deal negotiation support",
  },
  {
    name: "Operational readiness",
    text: "The systems, processes and teams that let a business scale across borders and sectors.",
    tags: "Process design · Team structuring · Technology advisory · KPI frameworks",
  },
  {
    name: "Cross-border expansion",
    text: "Expand across African markets with regional knowledge and on-the-ground networks.",
    tags: "Multi-market planning · Regulatory compliance · Local partnerships · Cultural intelligence",
  },
  {
    name: "Strategic advisory",
    text: "Hands-on guidance from senior advisors, from concept to execution.",
    tags: "We don’t just advise. We do.",
  },
  {
    name: "Stakeholder engagement",
    text: "Build and maintain relationships with the investors, regulators and partners critical to your success.",
    tags: "Investors · Regulators · Partners",
  },
];

export const STEPS = [
  { name: "Discover", text: "Your business, market position and growth ambitions." },
  { name: "Design", text: "A tailored strategy with clear milestones and deliverables." },
  { name: "Execute", text: "We work alongside your team to implement and iterate." },
  { name: "Scale", text: "Refine systems and strategies to sustain long-term growth." },
];

export const ENGAGEMENTS = [
  {
    region: "Botswana and Southern Africa",
    name: "SME Investment Readiness Programme",
    text: "Prepared 25+ SMEs for investor engagement through financial restructuring, business model refinement and pitch preparation. Multiple clients secured funding within 12 months.",
  },
  {
    region: "East and West Africa",
    name: "Cross-border market entry",
    text: "Guided financial institutions and corporates through multi-market expansion, regulatory navigation and local partnerships.",
  },
  {
    region: "Southern Africa",
    name: "Agricultural value chains",
    text: "Connected smallholder farmers to regional and international markets.",
  },
];

export const SECTORS = [
  "Financial services",
  "Agriculture and agribusiness",
  "SME development",
  "Trade and logistics",
  "Energy and infrastructure",
  "Technology",
];

export const CHALLENGES = [
  "Unclear export pricing",
  "Compliance and documentation gaps",
  "Limited access to trade finance",
  "Logistics and delivery constraints",
];

export const ANDINET_STAGES = [
  {
    name: "Embassy Business Forums",
    text: "Country-specific forums that introduce SMEs to new markets and identify real demand.",
    outcome: "Qualified SMEs and buyers",
  },
  {
    name: "TRADE Program",
    text: "A structured training program preparing SMEs for cross-border trade.",
    outcome: "Clear pricing, compliance and positioning",
  },
  {
    name: "Trade Corridor",
    text: "Sector-focused sessions where buyers and SMEs engage in structured sourcing.",
    outcome: "LOIs, sample orders and deal pipelines",
  },
  {
    name: "Credit and Compliance Support",
    text: "Support for financing, documentation and logistics alignment.",
    outcome: "Executable, bankable opportunities",
  },
  {
    name: "Trade Lab",
    text: "Post-deal support to ensure transactions are completed.",
    outcome: "Shipments delivered, repeat trade",
  },
];
