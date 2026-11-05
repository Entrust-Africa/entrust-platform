// The site's copy. Dates, prices and what each package includes come from the API's catalogue (the organisers edit them in the
// admin screens), so the only prices on the pages are the ones it sends. Change the words here and nowhere else.

export const SUPPORT_EMAIL = "info@entrustafrica.com";

/** The organisation hosting the event. Its logo is public/images/pan-african-chamber-logo.png, from panafricanchamber.com. */
export const HOST = {
  name: "Pan African Chamber of Commerce",
  url: "https://panafricanchamber.com",
} as const;

/**
 * The line above the headline. January 2027 is the planning period and the exact days are not announced: do not publish any
 * other date.
 */
export const EVENT_LINE = "Addis Ababa · Ethiopia · January 2027 · Dates to be announced";

export const HEADLINE = "Connecting Africa and its global diaspora through trade, investment and business partnerships";

export const INTRO =
  "The Africa Diaspora Trade & Investment Summit brings together African businesses, diaspora investors, international buyers, business leaders and institutions to build meaningful commercial relationships, unlock investment opportunities and strengthen economic cooperation.";

/** Why it matters: the gap the summit closes (concept note, section 1). */
export const WHY = [
  "Africa and its diaspora hold significant commercial, professional and investment resources. Too often they never reach the African SMEs that need international buyers, capital, distribution networks and technology.",
  "ADTIS is a structured platform where assessed, investment-ready African businesses meet buyers, investors, distributors, financial institutions and technical experts, over three days in Addis Ababa.",
] as const;

export const OBJECTIVES = [
  { title: "Facilitate trade", text: "Connect African SMEs with international buyers, importers, distributors and regional trade partners." },
  { title: "Mobilise diaspora investment", text: "Create ways for diaspora investors, investment groups and institutions to find viable African businesses." },
  { title: "Build SME investment readiness", text: "Assess businesses on commercial potential, operations, finances and readiness to work with international partners." },
  { title: "Advance Brain Gain", text: "Bring diaspora professionals' knowledge, technology and management experience to African enterprises." },
] as const;

/** Who should take part (concept note, section 5). */
export const WHO = [
  "African SME owners, entrepreneurs and business leaders",
  "Diaspora entrepreneurs and business associations",
  "Diaspora investors and investment networks",
  "Family offices and private investment groups",
  "International buyers, importers and distributors",
  "Banks and financial institutions",
  "Venture capital and private equity firms",
  "Development finance institutions",
  "Trade promotion organisations and chambers of commerce",
  "Government representatives and policymakers",
  "Technology companies and digital trade service providers",
  "Professional experts, consultants and diaspora specialists",
  "Development partners and international organisations",
] as const;
