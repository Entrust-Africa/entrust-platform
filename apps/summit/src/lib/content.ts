// The landing page's copy, as set in the design. Dates, prices and pass contents are Entrust's to confirm:
// change them here and nowhere else.

export const SUPPORT_EMAIL = "support@entrust-africa.com";

/** The organisation hosting the event. Its logo is public/images/pacci-logo.png, from the landscape logo on pacci.org. */
export const HOST = {
  name: "Pan African Chamber of Commerce and Industry",
  url: "https://www.pacci.org",
} as const;

/** The line above the headline. The design gives exact days, too small to read in the screenshot we were sent. */
export const EVENT_LINE = "Addis Ababa · Ethiopia · January";

export const HIGHLIGHTS = [
  {
    title: "Buyer-seller matchmaking",
    text: "Vetted buyers meet verified Black-owned sellers in scheduled 1:1 deal meetings.",
  },
  {
    title: "Market briefings",
    text: "On-the-ground intelligence across Africa, the Americas, Europe and Asia.",
  },
  {
    title: "Trade finance & logistics",
    text: "Lenders, export agencies and logistics partners ready to move your goods.",
  },
] as const;

export const PASSES = [
  {
    id: "diaspora",
    name: "Diaspora Pass",
    price: "$450",
    audience: "For founders, professionals and returning talent.",
    features: ["All 3 days of sessions", "Market briefings & clinics", "Networking events"],
    featured: false,
  },
  {
    id: "investor",
    name: "Investor Pass",
    price: "$950",
    audience: "For funds, buyers and deal-makers.",
    features: ["Everything in Diaspora Pass", "Curated 1:1 matchmaking", "Deal room & investors' dinner"],
    featured: true,
  },
  {
    id: "delegation",
    name: "Delegation Pass",
    price: "$2,400",
    audience: "For companies and government teams.",
    features: ["Everything in Investor Pass", "Private briefing room", "5 seats & branded table"],
    featured: false,
  },
] as const;

export type PassId = (typeof PASSES)[number]["id"];
