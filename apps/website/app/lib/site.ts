/** Site-wide links and contact details, shared by the header menu, footer and pages. */

export const PLATFORM_URLS = {
  trade: "https://trade.entrust-africa.com",
  clear: "https://clear.entrust-africa.com",
  mizan: "https://mizan.entrust-africa.com",
  afriConnect: "https://africonnect.africa.com",
} as const;

export const CONTACT = {
  city: "Addis Ababa, Ethiopia",
  phone: "+251 909 039 999",
  phoneHref: "tel:+251909039999",
  email: "info@entrustafrica.com",
  linkedIn: "https://www.linkedin.com/company/entrust-plc/",
} as const;

/** The founder's direct email and LinkedIn, listed on the Contact and Community pages. */
export const FOUNDER = {
  name: "Thomas Lorato",
  email: "thomas@entrustafrica.com",
  linkedIn: "https://www.linkedin.com/in/thomas-lorato",
} as const;

export const LINKEDIN_PROFILES = [
  { label: "Entrust", href: CONTACT.linkedIn },
  { label: FOUNDER.name, href: FOUNDER.linkedIn },
] as const;

/** Platform colours: each platform has a slanted colour marker. */
export const PLATFORM_COLOR = {
  trade: "#d9a033",
  clear: "#2b9d8f",
  entrust: "#19954f",
  mizan: "#a8741a",
} as const;

export type MenuPlatform = {
  key: keyof typeof PLATFORM_COLOR;
  name: string;
  tagline: string;
  href: string;
  links: { label: string; href: string; external?: boolean }[];
};

export const MENU_PLATFORMS: MenuPlatform[] = [
  {
    key: "trade",
    name: "TRADE",
    tagline: "Get ready to export",
    href: "/trade",
    links: [
      { label: "The 7 pillars", href: "/trade#pillars" },
      { label: "How it works", href: "/trade#how-it-works" },
      { label: "Apply", href: PLATFORM_URLS.trade, external: true },
    ],
  },
  {
    key: "clear",
    name: "CLEAR Export",
    tagline: "Run an export case",
    href: "/clear-export",
    links: [
      { label: "The 7 phases", href: "/clear-export#phases" },
      { label: "Trade routes", href: "/clear-export#routes" },
      { label: "Sign in", href: PLATFORM_URLS.clear, external: true },
    ],
  },
  {
    key: "mizan",
    name: "MIZAN",
    tagline: "Check financial readiness",
    href: "/mizan",
    links: [
      { label: "How it works", href: "/mizan#how-it-works" },
      { label: "Sign in", href: PLATFORM_URLS.mizan, external: true },
    ],
  },
  {
    key: "entrust",
    name: "Entrust",
    tagline: "Advisory, trade execution and access",
    href: "/entrust",
    links: [
      { label: "Services", href: "/entrust#services" },
      { label: "Track record", href: "/entrust#track-record" },
      { label: "Andinet", href: "/entrust#andinet" },
    ],
  },
];

export const COMPANY_LINKS = [
  { label: "About and leadership", href: "/about" },
  { label: "Events", href: "/events" },
  { label: "Partners", href: "/partners" },
  { label: "Community", href: "/community" },
  { label: "Contact", href: "/contact" },
];

export const FOOTER_LINKS = [
  { label: "TRADE", href: "/trade" },
  { label: "CLEAR Export", href: "/clear-export" },
  { label: "MIZAN", href: "/mizan" },
  { label: "Entrust", href: "/entrust" },
  { label: "AfriConnect", href: PLATFORM_URLS.afriConnect, external: true },
  { label: "Events", href: "/events" },
  { label: "Partners", href: "/partners" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
];

/** App logos from the "Platform logos" artboard, shown in the header lockup on each platform page. */
export const PLATFORM_LOGOS = {
  trade: { name: "TRADE", src: "/images/412b555e0913736c.png", path: "/trade" },
  clear: { name: "CLEAR Export", src: "/images/5c3d46aa5275b7c0.jpg", path: "/clear-export" },
  mizan: { name: "MIZAN", src: "/images/ea5c1723230fff4b.png", path: "/mizan" },
} as const;

/** Images exported from the Sketch file into public/images. */
export const IMG = {
  logo: "/images/707e75bef00b8064.png",
  logoLight: "/images/8deb8519659c2978.png",
  afriConnectMark: "/images/5b029d0920f467dd.png",
  thomas: "/images/df59960924007225.jpg",
  mikias: "/images/6c340dc86f182d5e.jpg",
  remmogoSpeaker: "/images/d17f93e36799b59d.jpg",
  remmogoPanel: "/images/421c979b4a60ca4e.jpg",
  forumAudience: "/images/245f90ed6f022aa1.jpg",
} as const;

export const PARTNER_LOGOS = [
  { name: "Zemen Bank", src: "/images/1ce7c0fe9b9a6efb.jpg" },
  { name: "Embassy of Botswana", src: "/images/d5319252336ac23e.jpg" },
  { name: "Equatorial Business Group", src: "/images/030f19625e62bde4.jpg" },
  { name: "Eco Green", src: "/images/33c082fa85e8499d.jpg" },
  { name: "Wegeret Construction", src: "/images/292b2f0475fabbe6.jpg" },
  { name: "Partner", src: "/images/c241ac1ff7c30275.jpg" },
  { name: "Ale Hig", src: "/images/12419dbe45ecd987.jpg" },
] as const;
