import { options, sectionBuilder, whenAnswered } from "@entrust/forms";
import type { Condition } from "@entrust/forms";
import type { DiagnosticTemplate } from "./types";

// The TRADE SME Onboarding and Business Diagnostic, version 1.0.0. The wording is the document's, and
// Q1 to Q169 are its question numbers, which stay the stable IDs. Where the document gives no answer
// type, the type is chosen from the wording: a question that starts "Do you", "Is", "Are", "Have you"
// or "Can you" is yes/no, a question that names its answers lists them as options, an amount of money
// carries a currency, and the rest is text. A published version never changes: put a correction in a
// new version.

/** Shown after a yes (or a no) to an earlier question. */
const after = (n: number, answer: "yes" | "no" = "yes"): Condition => whenAnswered(`Q${n}`, answer);

const section = (id: string) => sectionBuilder(id, "Q");

const s1 = section("S1");
const s2 = section("S2");
const s3 = section("S3");
const s4 = section("S4");
const s5 = section("S5");
const s6 = section("S6");
const s7 = section("S7");
const s8 = section("S8");
const s9 = section("S9");
const s10 = section("S10");

const A = "A. Existing insurance";
const B = "B. Business property and assets";
const C = "C. Machinery and production risks";
const D = "D. Employees and third-party risks";
const E = "E. Transport and export risks";
const F = "F. Business continuity and digital risks";

export const DIAGNOSTIC_1_0_0: DiagnosticTemplate = {
  id: "trade.diagnostic",
  version: "1.0.0",
  title: "TRADE SME Onboarding and Business Diagnostic",
  variables: ["country"],
  storage: {
    S1: "sme_profile",
    S2: "responses",
    S3: "responses",
    S4: "insurance_profile",
    S5: "responses",
    S6: "responses",
    S7: "responses",
    S8: "responses",
    S9: "responses",
    S10: "consent",
  },
  pathwayInputs: { exported: "Q135", lastShipment: "Q137", liveOrder: ["Q132", "Q139"] },
  omitted: {
    Q7: "The person completing the assessment is the signed-in user, so the form doesn't ask for their name and position again. The declaration in section 10 records both.",
    Q60: "Repeats Q18 (own or rented premises). The answer to Q18 is used.",
  },
  sections: [
    { id: "S1", title: "Business registration and profile", purpose: "Establish the SME's identity and basic business profile." },
    { id: "S2", title: "Products and business operations", purpose: "Understand what the business sells and how it operates." },
    {
      id: "S3",
      title: "Financial readiness and bankability",
      purpose: "Identify financial management, cash-flow, recordkeeping, and financing gaps. Detailed scoring should be conducted through the MIZAN assessment.",
    },
    {
      id: "S4",
      title: "Insurance and business risk profile",
      purpose: "Identify business assets, exposures, existing insurance coverage, and potential protection gaps for EthioLife's review.",
    },
    { id: "S5", title: "Production capacity and operational readiness", purpose: "Determine what the SME can realistically produce and deliver." },
    {
      id: "S6",
      title: "Market access and buyer readiness",
      purpose: "Understand the SME's commercial position and ability to convert market opportunities into sales.",
    },
    {
      id: "S7",
      title: "Export readiness and compliance",
      purpose: "Identify the SME's export experience and transaction-specific execution requirements.",
    },
    { id: "S8", title: "Management and digital systems", purpose: "Assess the business's management discipline and ability to use digital tools." },
    {
      id: "S9",
      title: "SME priorities and support requirements",
      purpose: "Identify the SME's immediate priorities and determine which Entrust and partner services may be relevant.",
    },
    { id: "S10", title: "Declaration and consent" },
  ],
  questions: [
    // Section 1. Business registration and profile. Kept in the SME registry.
    s1.short(1, "Registered business name."),
    s1.short(2, "Trade name, if different.", { optional: true }),
    s1.short(3, "Business registration number."),
    s1.short(4, "Tax Identification Number (TIN)."),
    s1.number(5, "Year the business was established.", { integer: true, min: 1900, max: 2100 }),
    s1.one(6, "Business ownership type:", options("Sole proprietorship", "Private limited company", "PLC", "Partnership", "Cooperative", "Other")),
    s1.short(8, "Business email address."),
    s1.short(9, "Business telephone number."),
    s1.long(10, "Physical business address and operating location."),
    s1.short(11, "Website, if available.", { optional: true }),
    s1.long(12, "Social media or online business pages.", { optional: true }),
    s1.short(13, "Industry or sector."),
    s1.one(14, "Main business activity:", options("Manufacturing", "Agro-processing", "Agriculture", "Trading", "Services", "Other")),
    s1.number(15, "Number of permanent employees.", { integer: true, min: 0, max: 100000 }),
    s1.number(16, "Number of temporary or contract employees.", { integer: true, min: 0, max: 100000 }),
    s1.yesNo(17, "Is the business woman-owned or woman-led?"),
    s1.one(18, "Does the business operate from its own premises or rented premises?", options("Own premises", "Rented premises")),

    // Section 2. Products and business operations.
    s2.long(19, "What are your main products or services?"),
    s2.short(20, "Which product generates the highest revenue?"),
    s2.list(21, "What are your three most important products by sales volume?", { maxItems: 3 }),
    s2.many(22, "Do you manufacture, process, assemble, or trade these products?", options("Manufacture", "Process", "Assemble", "Trade")),
    s2.list(23, "What are your main raw materials or inputs?"),
    s2.long(24, "Where do you source your raw materials?"),
    s2.yesNo(25, "Do you depend on one major supplier?"),
    s2.yesNo(26, "Do you have formal supplier agreements?"),
    s2.yesNo(27, "Do you have the necessary licenses, permits, or certifications for your current operations?"),
    s2.yesNo(28, "Do you have documented production or service procedures?"),
    s2.yesNo(29, "Do you maintain quality-control records?"),
    s2.long(30, "What is the biggest operational challenge affecting your business?"),

    // Section 3. Financial readiness and bankability. Stored unscored: MIZAN reads it later.
    s3.yesNo(31, "Do you maintain separate business and personal bank accounts?"),
    s3.yesNo(32, "Do you use accounting software or a formal accounting system?"),
    s3.yesNo(33, "Are your financial records updated regularly?"),
    s3.yesNo(34, "Do you prepare monthly income and expense reports?"),
    s3.yesNo(35, "Do you prepare annual financial statements?"),
    s3.yesNo(36, "Are your financial statements audited or independently reviewed?"),
    s3.yesNo(37, "Can you provide financial statements for the last two financial years?"),
    s3.yesNo(38, "Do you prepare cash-flow forecasts?"),
    s3.yesNo(39, "Do you have a documented annual business budget?"),
    s3.yesNo(40, "Do you know your production cost and gross profit margin for each major product?"),
    s3.yesNo(41, "Do you maintain records of outstanding customer payments?"),
    s3.yesNo(42, "Do you maintain records of outstanding supplier payments?"),
    s3.yesNo(43, "Do you currently have outstanding loans or other business financing?"),
    s3.long(44, "If yes, identify the lender, outstanding balance, repayment schedule, and purpose.", { showIf: after(43) }),
    s3.yesNo(45, "Have you previously applied for business financing?"),
    s3.one(46, "If yes, was the application approved, rejected, or partially approved?", options("Approved", "Rejected", "Partially approved"), { showIf: after(45) }),
    s3.money(47, "What is your current financing requirement?"),
    s3.long(48, "What would the financing be used for?"),
    s3.money(49, "How much financing could the business reasonably repay?"),
    s3.long(50, "What is the biggest financial challenge currently facing the business?"),

    // Section 4. Insurance and business risk profile, for EthioLife's review. Only Entrust staff see it.
    s4.yesNo(51, "Does your business currently have any insurance policies?", { group: A }),
    s4.many(
      52,
      "If yes, which types of insurance do you have?",
      options(
        "Property and fire",
        "Machinery and equipment",
        "Stock and inventory",
        "Business interruption",
        "Motor vehicle or fleet",
        "Marine cargo or goods in transit",
        "Employee-related insurance",
        "Public liability",
        "Product liability",
        "Other",
      ),
      { group: A, showIf: after(51) },
    ),
    s4.short(53, "Which insurance company provides your current coverage?", { group: A, showIf: after(51) }),
    s4.short(54, "When do your policies expire?", { group: A, showIf: after(51) }),
    s4.yesNo(55, "Do you know the insured value and coverage limits?", { group: A, showIf: after(51) }),
    s4.yesNo(56, "Have you made an insurance claim in the last three years?", { group: A }),
    s4.long(57, "If yes, what was the reason and outcome?", { group: A, showIf: after(56) }),
    s4.yesNo(58, "Have you experienced a significant loss that was not covered by insurance?", { group: A }),
    s4.long(59, "What prevents your business from obtaining or maintaining insurance?", { group: A, showIf: after(51, "no") }),
    s4.money(61, "What is the approximate replacement value of your premises, if owned?", { group: B, optional: true }),
    s4.yesNo(62, "Does your business have warehouses, storage facilities, or other operating locations?", { group: B }),
    s4.money(63, "What is the approximate value of your machinery and equipment?", { group: B }),
    s4.money(64, "What is the approximate value of your stock and inventory?", { group: B }),
    s4.yesNo(65, "Are your premises exposed to fire, flooding, theft, water damage, or other significant risks?", { group: B }),
    s4.yesNo(66, "Do you have fire detection or firefighting equipment?", { group: B }),
    s4.yesNo(67, "Do you have security systems or controlled access?", { group: B }),
    s4.yesNo(68, "Do you have backup power or alternative operating arrangements?", { group: B }),
    s4.yesNo(69, "Do you have a plan to continue operations if your main facility becomes unavailable?", { group: B }),
    s4.yesNo(70, "Does your business depend on specialized machinery or equipment?", { group: C }),
    s4.list(71, "What are your most critical machines or pieces of equipment?", { group: C }),
    s4.long(72, "What would happen if your most important machine stopped working?", { group: C }),
    s4.short(73, "How long would it take to repair or replace it?", { group: C }),
    s4.yesNo(74, "Do you have preventive maintenance records?", { group: C }),
    s4.yesNo(75, "Have you experienced machinery breakdown or production interruptions in the last two years?", { group: C }),
    s4.yesNo(76, "Would your business be able to absorb the cost of replacing a critical machine?", { group: C }),
    s4.yesNo(77, "Do you have employees working in production, warehouses, transport, or other potentially hazardous environments?", { group: D }),
    s4.yesNo(78, "Do you provide workplace safety training?", { group: D }),
    s4.yesNo(79, "Do you maintain workplace accident records?", { group: D }),
    s4.yesNo(80, "Have employees experienced workplace injuries or accidents in the last three years?", { group: D }),
    s4.yesNo(81, "Do customers, suppliers, contractors, or visitors regularly enter your premises?", { group: D }),
    s4.yesNo(82, "Could your business face claims arising from injury, property damage, or defective products?", { group: D }),
    s4.yesNo(83, "Does your business transport goods using its own vehicles?", { group: E }),
    s4.yesNo(84, "Do you use third-party transport companies?", { group: E }),
    s4.money(85, "What is the approximate value of goods transported in a typical shipment?", { group: E }),
    s4.yesNo(86, "Have goods been lost, damaged, or delayed during transportation?", { group: E }),
    s4.yesNo(87, "Do you currently insure goods while in transit?", { group: E }),
    s4.yesNo(88, "Do you export products or plan to export within the next 12 months?", { group: E }),
    s4.money(89, "What is the approximate value of a typical export shipment?", { group: E }),
    s4.many(90, "Which transport methods do you use or expect to use?", options("Road", "Air", "Sea", "Multimodal"), { group: E }),
    s4.yesNo(91, "Do you understand who carries the risk for your goods under your agreed delivery terms?", { group: E }),
    s4.yesNo(92, "Do you currently have marine cargo or export shipment insurance?", { group: E }),
    s4.short(93, "How long could your business continue operating if its main facility or equipment became unavailable?", { group: F }),
    s4.yesNo(94, "Do you have backup copies of important business records?", { group: F }),
    s4.yesNo(95, "Are your financial and customer records stored digitally?", { group: F }),
    s4.long(96, "Who has access to your business systems and sensitive information?", { group: F }),
    s4.yesNo(97, "Have you experienced cyber incidents, data loss, or unauthorized access?", { group: F }),
    s4.yesNo(98, "Do you have a written business continuity or emergency response plan?", { group: F }),

    // Section 5. Production capacity and operational readiness.
    s5.short(99, "What is your maximum production capacity per month?"),
    s5.short(100, "What is your current average monthly production?"),
    s5.number(101, "What percentage of your available production capacity are you currently using?", { min: 0, max: 100 }),
    s5.short(102, "How many days or weeks does it take to complete a normal customer order?"),
    s5.short(103, "What is the largest order you have fulfilled to date?"),
    s5.short(104, "What is the largest order you could fulfill today without additional investment?"),
    s5.short(105, "What is the maximum additional production you could handle with your current facilities and workforce?"),
    s5.yesNo(106, "Do you have sufficient raw materials for your normal production requirements?"),
    s5.short(107, "How long would it take to obtain additional raw materials?"),
    s5.yesNo(108, "Do you have sufficient machinery and equipment to increase production?"),
    s5.yesNo(109, "Are there any critical production bottlenecks?"),
    s5.yesNo(110, "Do you have documented production schedules?"),
    s5.yesNo(111, "Do you maintain inventory records?"),
    s5.yesNo(112, "Do you have quality-control procedures?"),
    s5.yesNo(113, "Can you consistently meet product specifications?"),
    s5.yesNo(114, "Do you have packaging suitable for your target markets?"),
    s5.money(115, "What investment would be required to increase production capacity?"),
    s5.yesNo(116, "If you received an order tomorrow that was twice your normal monthly output, could you fulfill it?"),
    s5.long(117, "If not, what would prevent you from fulfilling it?", { showIf: after(116, "no") }),

    // Section 6. Market access and buyer readiness.
    s6.long(118, "Who are your main customers?"),
    s6.many(
      119,
      "Do you sell mainly to individuals, businesses, government, wholesalers, or distributors?",
      options("Individuals", "Businesses", "Government", "Wholesalers", "Distributors"),
    ),
    s6.long(120, "What are your main sales channels?"),
    s6.yesNo(121, "Do you have repeat customers?"),
    s6.yesNo(122, "Do you have formal contracts or purchase agreements with customers?"),
    s6.yesNo(123, "Do you maintain a customer database?"),
    s6.yesNo(124, "Do you actively identify and approach new buyers?"),
    s6.yesNo(125, "Do you have a documented sales or marketing plan?"),
    s6.yesNo(126, "Do you have a current product catalogue or company profile?"),
    s6.yesNo(127, "Do you have product specifications and pricing information?"),
    // The document says "outside Ethiopia". The wording takes the country of the SME's cohort.
    s6.yesNo(128, "Have you sold to customers outside {country}?"),
    s6.list(129, "If yes, which countries?", { showIf: after(128) }),
    s6.yesNo(130, "Have you received international buyer enquiries?"),
    s6.yesNo(131, "Do you currently have any active buyer discussions?"),
    s6.yesNo(132, "Do you have a confirmed purchase order or signed supply agreement?"),
    s6.money(133, "What is the approximate value of your current sales pipeline?"),
    s6.long(134, "What is the biggest obstacle preventing you from accessing new markets?"),

    // Section 7. Export readiness and compliance. Q135 and Q137 decide the pathway.
    s7.yesNo(135, "Have you completed an export transaction?"),
    s7.long(136, "If yes, what products have you exported and to which countries?", { showIf: after(135) }),
    s7.date(137, "When was your most recent export shipment?", { showIf: after(135), notFuture: true }),
    s7.yesNo(138, "Do you currently have a confirmed international buyer?"),
    s7.yesNo(139, "Do you have an active purchase order or export contract?"),
    s7.yesNo(140, "Have you identified your target export markets?"),
    s7.yesNo(141, "Do you know the applicable product standards and certification requirements for those markets?"),
    s7.yesNo(142, "Do you know the export documentation required for your product and destination?"),
    s7.yesNo(143, "Do you have experience preparing export documentation?"),
    s7.yesNo(144, "Do you have an active bank account suitable for receiving export proceeds?"),
    s7.yesNo(145, "Have you discussed export payment terms with your bank?"),
    s7.long(146, "Which payment methods have you used or expect to use?"),
    s7.yesNo(147, "Do you understand the delivery terms agreed with your buyer, such as Incoterms?"),
    s7.long(148, "What is the biggest obstacle preventing you from completing an export transaction?"),

    // Section 8. Management and digital systems.
    s8.yesNo(149, "Does your business have a current business plan?"),
    s8.yesNo(150, "Does your business have an organizational structure with defined responsibilities?"),
    s8.yesNo(151, "Do you hold regular management or operational review meetings?"),
    s8.yesNo(152, "Do you track monthly sales and business performance?"),
    s8.yesNo(153, "Do you use digital accounting or inventory systems?"),
    s8.yesNo(154, "Do you use spreadsheets to manage business records?"),
    s8.yesNo(155, "Do you have a company email address and professional online presence?"),
    s8.yesNo(156, "Do you use digital tools to manage customers and suppliers?"),
    s8.yesNo(157, "Are business documents stored in an organized and accessible format?"),
    s8.long(158, "What digital or management improvements would have the greatest impact on your business?"),

    // Section 9. SME priorities and support requirements. Q161 feeds the support-service recommendations
    // and Q164 records the wish to be connected to partners.
    s9.list(159, "What are your three most important business objectives for the next 12 months?", { maxItems: 3 }),
    s9.long(160, "What is the biggest obstacle to achieving those objectives?"),
    s9.many(
      161,
      "What support would be most useful to your business?",
      options(
        "Financial readiness and bankability",
        "Access to finance",
        "Insurance and risk protection",
        "Production capacity improvement",
        "Buyer identification and market access",
        "Export documentation and compliance",
        "Digital systems and business records",
        "Management and operational improvement",
        "Investment or strategic partnerships",
      ),
    ),
    s9.yesNo(162, "Are you willing to provide supporting documents for your assessment?"),
    s9.yesNo(163, "Are you willing to participate in a follow-up diagnostic or specialist review?"),
    s9.yesNo(164, "Would you like Entrust to connect you with relevant service providers or partners?"),

    // Section 10. Declaration and consent. Q165 to Q168 are required to submit, and Q169 is recorded
    // whichever way it is answered. D1 to D4 are the declaration's electronic signature.
    s10.yesNo(165, "I confirm that the information provided is accurate to the best of my knowledge.", { mustBe: "yes" }),
    s10.yesNo(
      166,
      "I understand that this assessment is intended to identify business readiness, operational constraints, and potential risks. It does not guarantee financing, insurance coverage, export approval, or commercial contracts.",
      { mustBe: "yes" },
    ),
    s10.yesNo(
      167,
      "I authorize Entrust Africa to use this information to prepare my SME diagnostic profile and recommend relevant support services.",
      { mustBe: "yes" },
    ),
    s10.yesNo(
      168,
      "I understand that information will only be shared with banks, insurers, or other partners with the appropriate consent and for the stated purpose.",
      { mustBe: "yes" },
    ),
    s10.yesNo(169, "I agree to be contacted by Entrust Africa regarding my assessment and relevant business support services."),
    s10.short("D1", "Declaration: full name.", { group: "Declaration" }),
    s10.short("D2", "Declaration: position / title.", { group: "Declaration" }),
    s10.date("D3", "Declaration: date.", { group: "Declaration", notFuture: true }),
    s10.short("D4", "Declaration: electronic signature.", { group: "Declaration" }),
  ],
};
