import { asText, letters, type Cell, type SheetGrid } from "./register";

// Responses to a programme's application form, exported from Google Forms as a workbook: one row a response, one column a
// question. People type what they like, so every answer is kept as text exactly as sent. What is worked out is the country,
// because only responses from Ethiopia are shown to anyone (the rest are kept and never listed).

/** The questions the form asks, in the order they are shown, by the key an answer is stored under. */
export const APPLICATION_QUESTIONS = [
  { key: "produces", label: "What the business produces", heading: /^what does your business produce/ },
  { key: "category", label: "Category", heading: /^which category best describes/ },
  { key: "mainProducts", label: "Main products", heading: /^what are your main products/ },
  { key: "capacity", label: "Monthly production capacity", heading: /^monthly production capacity/ },
  { key: "employees", label: "Employees", heading: /^number of employees/ },
  { key: "yearEstablished", label: "Year established", heading: /^year business was established/ },
  { key: "sellsWhere", label: "Where it sells now", heading: /^where do you currently sal/ },
  { key: "revenue", label: "Average monthly revenue", heading: /^average monthly revenue/ },
  { key: "challenges", label: "Biggest challenges in growing", heading: /^what are the your biggest challenges|^what are your biggest challenges/ },
  { key: "exportedBefore", label: "Has exported before", heading: /^have you exported before/ },
  { key: "documents", label: "Has these", heading: /^do you have any of the following/ },
  { key: "standards", label: "Quality or safety standards", heading: /^do your products meet any/ },
  { key: "exportMarkets", label: "Export markets of interest", heading: /^what markets/ },
  { key: "constraint", label: "Biggest operational constraint", heading: /^what is your biggest operational constraint/ },
  { key: "canIncreaseProduction", label: "Can increase production if demand grows", heading: /^are you able to increase production/ },
  { key: "supportNeeded", label: "Support needed most", heading: /^what support do you need/ },
  { key: "hasBankAccount", label: "Has a business bank account", heading: /^do you currently have a business bank account/ },
  { key: "bank", label: "Bank", heading: /^which bank do you use/ },
  { key: "hadLoan", label: "Has had a business loan", heading: /^have you ever accessed a business loan/ },
  { key: "zemenInterest", label: "Interested in financing through Zemen Bank", heading: /^are you .*financing opportunities through zemen/ },
  { key: "whyJoin", label: "Why they want to join", heading: /^why do you want to join/ },
  { key: "expectations", label: "What they expect from the training", heading: /^what do you expect to achieve/ },
  { key: "availability", label: "Can attend every session", heading: /^are you available to attend all/ },
  { key: "heardFrom", label: "How they heard of the programme", heading: /^how did you hear/ },
  { key: "additional", label: "Anything else", heading: /^any additional information/ },
] as const;
export type ApplicationQuestionKey = (typeof APPLICATION_QUESTIONS)[number]["key"];

export interface ApplicationInput {
  /** When the form was sent, as an ISO time. */
  submittedAt: string;
  email: string;
  businessName: string;
  contactName: string | null;
  /** Tidied where it can be: an Ethiopian number is written +2519XXXXXXXX. Otherwise as typed, without spaces and dashes. */
  phone: string | null;
  /** Where the business says it is, as typed. */
  location: string | null;
  /** The ISO country code, or null when the response doesn't say clearly enough. */
  country: string | null;
  /** The answer to each question that has one, by key. */
  answers: Partial<Record<ApplicationQuestionKey, string>>;
}

// ---- Country ----

// Places a business may name, by country. Matched as whole words in what was typed, so "Harare" is not "Harar".
const PLACES: Readonly<Record<string, readonly string[]>> = {
  ET: [
    "ethiopia", "ethioipia", "ethiopian", "addis", "adiss", "finfinne", "bahir dar", "bahirdar", "amhara", "oromia", "oromiya", "dukem",
    "bonga", "kaffa", "kafa", "south west", "southwest", "sidama", "hawassa", "awassa", "dire dawa", "mekelle", "mekele", "tigray",
    "adama", "nazret", "jimma", "gondar", "gonder", "harar", "debre", "bishoftu", "sebeta", "gambella", "gambela", "wolaita", "shashemene",
    "dessie", "arba minch", "adigrat", "holeta", "sululta", "burayu", "legetafo", "ziway", "woldia", "nekemte", "yirgacheffe", "sodo",
  ],
  TZ: ["tanzania", "dar es salaam", "arusha", "dodoma", "mwanza", "zanzibar"],
  KE: ["kenya", "nairobi", "mombasa", "kisumu", "nakuru", "eldoret"],
  NG: ["nigeria", "lagos", "abuja", "ogun", "minna", "kano", "ibadan", "kaduna", "north central", "port harcourt", "enugu"],
  GH: ["ghana", "accra", "kumasi", "tema"],
  SL: ["sierra leone", "freetown"],
  ZW: ["zimbabwe", "harare", "bulawayo"],
  MW: ["malawi", "lilongwe", "blantyre"],
  PK: ["pakistan", "lahore", "karachi", "islamabad"],
  UG: ["uganda", "kampala"],
  RW: ["rwanda", "kigali"],
  ZM: ["zambia", "lusaka"],
  ZA: ["south africa", "johannesburg", "cape town", "durban", "pretoria"],
  EG: ["egypt", "cairo"],
  IN: ["india", "mumbai", "delhi"],
};

const PLACE_PATTERNS = Object.entries(PLACES).map(([country, names]) => ({ country, pattern: new RegExp(`\\b(?:${names.join("|").replaceAll(" ", "\\s+")})\\b`) }));

/** The country a place name points to; undefined when it names none, null when it names more than one. */
function countryOfPlace(place: string | null): string | null | undefined {
  if (!place) return undefined;
  const words = place.toLowerCase().replace(/[^a-z]+/g, " ");
  const found = PLACE_PATTERNS.filter((p) => p.pattern.test(words)).map((p) => p.country);
  return found.length === 0 ? undefined : found.length === 1 ? found[0] : null;
}

const EMAIL_COUNTRIES = new Set(["ET", "KE", "TZ", "UG", "RW", "NG", "GH", "SL", "ZW", "MW", "ZM", "ZA", "EG", "PK", "IN"]);

function countryOfEmail(email: string): string | undefined {
  const tld = email.split("@")[1]?.split(".").at(-1)?.toUpperCase();
  return tld && EMAIL_COUNTRIES.has(tld) ? tld : undefined;
}

// Country calling codes, longest first.
const CALLING_CODES: readonly (readonly [string, string])[] = [
  ["971", "AE"], ["251", "ET"], ["254", "KE"], ["255", "TZ"], ["256", "UG"], ["250", "RW"], ["234", "NG"], ["233", "GH"], ["232", "SL"],
  ["263", "ZW"], ["265", "MW"], ["260", "ZM"], ["27", "ZA"], ["20", "EG"], ["92", "PK"], ["91", "IN"], ["44", "GB"], ["49", "DE"], ["86", "CN"],
];

/** The digits of a number, with a leading + kept; "±" is the + typed with the wrong key. */
const cleanPhone = (raw: string): string => {
  const plus = /^\s*[+±]/.test(raw) ? "+" : "";
  return plus + raw.replace(/[^\d]/g, "");
};

function countryOfPhone(phone: string | null): string | undefined {
  if (!phone) return undefined;
  const cleaned = cleanPhone(phone);
  const digits = cleaned.replace(/^\+/, "");
  // Written in full: +CC…, 00CC…, or CC… with enough digits to be one.
  const international = cleaned.startsWith("+") ? digits : digits.startsWith("00") ? digits.slice(2) : digits.length >= 11 && !digits.startsWith("0") ? digits : null;
  if (international) return CALLING_CODES.find(([code]) => international.startsWith(code))?.[1];
  // A local Ethiopian mobile number: 09XXXXXXXX, or 9XXXXXXXX once the zero is lost. (07 is Kenya's, and Ethiopia's, so it says nothing.)
  return /^0?9\d{8}$/.test(digits) ? "ET" : undefined;
}

/**
 * The country a response comes from. Where the business says it is wins, then the country of its email address, then its phone
 * number. A place that could be two countries is left as null, and so is one that says nothing: such a response isn't shown.
 */
export function applicationCountry(input: { location: string | null; email: string | null; phone: string | null }): string | null {
  const place = countryOfPlace(input.location);
  if (place !== undefined) return place;
  return (input.email ? countryOfEmail(input.email) : undefined) ?? countryOfPhone(input.phone) ?? null;
}

/** An Ethiopian number as +2519XXXXXXXX when it is one; anything else without spaces and dashes. */
export function tidyPhone(raw: string | null, country: string | null): string | null {
  if (!raw) return null;
  const cleaned = cleanPhone(raw);
  if (cleaned.replace(/\D/g, "") === "") return null;
  if (country === "ET") {
    const match = /^(?:\+?251|0)?([79]\d{8})$/.exec(cleaned.replace(/^\+/, ""));
    if (match) return `+251${match[1]}`;
  }
  return cleaned;
}

// ---- Reading the sheet ----

type Structured = "timestamp" | "email" | "emailAlt" | "businessName" | "contactName" | "phone" | "location";
const STRUCTURED: readonly { key: Structured; heading: RegExp }[] = [
  { key: "timestamp", heading: /^timestamp/ },
  { key: "email", heading: /^email address/ },
  { key: "emailAlt", heading: /^email address/ },
  { key: "businessName", heading: /^business name/ },
  { key: "contactName", heading: /^contact person/ },
  { key: "phone", heading: /^phone number/ },
  { key: "location", heading: /^city region/ },
];

/** Days since 1899-12-30, which is how a spreadsheet keeps a time. A time typed as text is read as a date and time. */
function timeOf(cell: Cell): string | null {
  if (typeof cell === "number") {
    if (!(cell > 25_569 && cell < 80_000)) return null;
    return new Date(Math.round((cell - 25_569) * 86_400_000)).toISOString();
  }
  const text = asText(cell);
  if (!text) return null;
  const parsed = Date.parse(/(?:Z|[+-]\d\d:?\d\d)$/.test(text) ? text : `${text} UTC`);
  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
}

/** An answer as typed. Line breaks are kept, since people list things on lines; a number is its digits. */
function answerOf(cell: Cell): string | null {
  if (cell === null || cell === undefined) return null;
  const text = (typeof cell === "number" ? String(cell) : cell).replace(/\r\n?/g, "\n").replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
  return text === "" ? null : text;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface ReadApplicationsResult {
  applications: ApplicationInput[];
  /** Things to look at in the sheet. They name businesses in Ethiopia only; a response from elsewhere is counted, never named. */
  warnings: string[];
}

/** Which sheet holds the responses: the first with "Timestamp" and "Business Name" headings. */
function findResponses(sheets: Readonly<Record<string, SheetGrid>>): { grid: SheetGrid; headRow: number } | null {
  for (const grid of Object.values(sheets)) {
    for (let i = 0; i < Math.min(grid.length, 5); i++) {
      const headings = (grid[i] ?? []).map((c) => letters(asText(c) ?? ""));
      if (headings.some((h) => /^timestamp/.test(h)) && headings.some((h) => /^business name/.test(h))) return { grid, headRow: i };
    }
  }
  return null;
}

/** Whether the sheets are a form's responses: one has "Timestamp" and "Business Name" headings. */
export const isApplicationResponses = (sheets: Readonly<Record<string, SheetGrid>>): boolean => findResponses(sheets) !== null;

/** Reads the responses from a Google Forms export. Throws a sentence fit to show when the sheet isn't one. */
export function readApplications(sheets: Readonly<Record<string, SheetGrid>>): ReadApplicationsResult {
  const found = findResponses(sheets);
  if (!found) throw new Error(`This isn't a form's responses: no sheet has "Timestamp" and "Business Name" headings.`);
  const { grid, headRow } = found;

  const structured = new Map<Structured, number>();
  const questions = new Map<ApplicationQuestionKey, number>();
  (grid[headRow] ?? []).forEach((cell, index) => {
    const heading = letters(asText(cell) ?? "");
    if (!heading) return;
    const s = STRUCTURED.find((c) => c.heading.test(heading) && !structured.has(c.key));
    if (s) return void structured.set(s.key, index);
    const q = APPLICATION_QUESTIONS.find((c) => c.heading.test(heading) && !questions.has(c.key));
    if (q) questions.set(q.key, index);
  });

  const applications: ApplicationInput[] = [];
  const warnings: string[] = [];
  for (let i = headRow + 1; i < grid.length; i++) {
    const row = grid[i] ?? [];
    const at = (key: Structured): Cell => (structured.has(key) ? row[structured.get(key)!] : undefined);
    const businessName = asText(at("businessName"));
    const email = (asText(at("email")) ?? asText(at("emailAlt")))?.toLowerCase() ?? null;
    if (row.every((c) => asText(c) === null)) continue;

    const location = asText(at("location"));
    const country = applicationCountry({ location, email, phone: asText(at("phone")) });
    // A response from Ethiopia may be named in a warning; any other is only counted.
    const who = country === "ET" ? (businessName ?? email ?? "A response") : "A response";
    const where = `Row ${i + 1}`;
    const submittedAt = timeOf(at("timestamp"));
    if (submittedAt === null || email === null || businessName === null) {
      const missing = submittedAt === null ? "time sent" : email === null ? "email address" : "business name";
      warnings.push(`${where}${country === "ET" && businessName ? ` (${businessName})` : ""} has no ${missing}, so it was skipped.`);
      continue;
    }

    const phone = tidyPhone(asText(at("phone")), country);
    if (country === "ET") {
      if (!EMAIL.test(email)) warnings.push(`${who}: "${email}" isn't an email address.`);
      if (phone !== null && !/^\+251[79]\d{8}$/.test(phone)) warnings.push(`${who}: the phone number "${phone}" doesn't look like an Ethiopian one.`);
    }

    const answers: ApplicationInput["answers"] = {};
    for (const [key, index] of questions) {
      const answer = answerOf(row[index]);
      if (answer !== null) answers[key] = answer;
    }
    applications.push({ submittedAt, email, businessName, contactName: asText(at("contactName")), phone, location, country, answers });
  }

  if (applications.length === 0) throw new Error("The sheet has no responses in it.");
  return { applications, warnings };
}

// ---- Counting ----

const keyOf = (text: string) => letters(text);

/** How many times each response's business applied, found by its email address or its name; 1 when only once. */
export function timesApplied(applications: readonly Pick<ApplicationInput, "email" | "businessName">[]): number[] {
  return applications.map((a) => applications.filter((b) => b.email === a.email || keyOf(b.businessName) === keyOf(a.businessName)).length);
}

/** Whether an answer to a yes or no question is a yes. */
export const isYes = (answer: string | undefined): boolean => /^\s*y(es)?\b/i.test(answer ?? "");
