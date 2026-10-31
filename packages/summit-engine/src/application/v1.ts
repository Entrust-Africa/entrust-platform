import { options, sectionBuilder, whenAnswered } from "@entrust/forms";
import type { Condition, FormOption } from "@entrust/forms";
import type { ApplicationTemplate } from "./types";

// The Summit application form, version 0.1.0, a DRAFT. Section 4 of the specification names the nine
// sections and what each collects, and gives the conditional rules, but lists no questions. The
// questions below are drafted from the specification's scoring guidance (section 6), the opportunity
// profile (section 9) and the matching preparation (section 10), so that an officer has something to
// judge each category on. Entrust has to confirm or replace them before the form is published, and a
// published version never changes.

const section = (n: number) => sectionBuilder(`S${n}`);
const s1 = section(1);
const s2 = section(2);
const s3 = section(3);
const s4 = section(4);
const s5 = section(5);
const s6 = section(6);
const s7 = section(7);
const s8 = section(8);
const s9 = section(9);

const PATHWAYS: FormOption[] = [
  { value: "trade_and_market_access", label: "Trade and market access" },
  { value: "investment", label: "Investment" },
  { value: "strategic_partnership", label: "Strategic partnership" },
  { value: "combined_trade_and_investment", label: "Combined trade and investment" },
];

/** The registered and operating answers carry a stable value apart from their wording. */
const REGISTRATION: FormOption[] = [
  { value: "registered", label: "Registered in my country" },
  { value: "accepted_legal_status", label: "Not a company registration, but an accepted legal operating status in my country" },
  { value: "not_registered", label: "Not registered" },
];
const OPERATING: FormOption[] = [
  { value: "operating", label: "Currently operating" },
  { value: "ready_to_launch", label: "Not yet operating, with a documented commercial venture ready for launch" },
  { value: "not_operating", label: "Not operating and no documented venture" },
];

const DOCUMENTS: FormOption[] = [
  { value: "registration_certificate", label: "Registration certificate" },
  { value: "financial_statements", label: "Financial statements or management accounts" },
  { value: "product_information", label: "Product information or catalogue" },
  { value: "business_plan", label: "Business plan or financial model" },
  { value: "export_records", label: "Export declarations, shipping records or invoices" },
  { value: "buyer_contracts", label: "Buyer contracts, purchase orders or correspondence" },
  { value: "certifications", label: "Certifications or test reports" },
  { value: "use_of_funds_schedule", label: "Use-of-funds schedule" },
  { value: "none", label: "None of these", exclusive: true },
];

/** Shown when investment is part of what the applicant seeks: the investment or combined pathway, or a yes to S4.1. */
const seekingInvestment: Condition = {
  any: [{ fact: "S2.12", in: ["investment", "combined_trade_and_investment"] }, whenAnswered("S4.1")],
};
const hasActiveBuyer = whenAnswered("S3.5");

export const APPLICATION_0_1_0: ApplicationTemplate = {
  id: "summit.application",
  version: "0.1.0",
  status: "draft",
  title: "Africa Diaspora Trade and Investment Summit: SME application",
  registry: ["S1.1", "S1.2", "S1.3", "S1.5", "S1.6", "S1.7", "S1.8"],
  inputs: {
    pathway: "S2.12",
    seekingInvestment: "S4.1",
    registration: { question: "S1.4", met: ["registered", "accepted_legal_status"], notMet: ["not_registered"] },
    operating: { question: "S2.8", met: ["operating", "ready_to_launch"], notMet: ["not_operating"] },
    representative: "S1.14",
    offering: ["S2.2", "S2.3"],
    declaration: ["S9.1", "S9.2", "S9.3"],
  },
  sections: [
    { id: "S1", title: "Business identity", purpose: "Registration, ownership, country, contacts" },
    { id: "S2", title: "Business overview", purpose: "Products, services, industry, revenue, operations" },
    { id: "S3", title: "Trade opportunity", purpose: "Exports, buyers, target markets, sourcing" },
    { id: "S4", title: "Investment opportunity", purpose: "Capital requirement, use of funds, investment structure" },
    { id: "S5", title: "Business readiness", purpose: "Financial records, operations, management, certifications" },
    { id: "S6", title: "Diaspora engagement", purpose: "Potential partnerships and diaspora markets" },
    { id: "S7", title: "Summit objectives", purpose: "Participation objectives and desired connections" },
    { id: "S8", title: "Supporting documents", purpose: "Registration, financial, product, and investment documents" },
    { id: "S9", title: "Declaration", purpose: "Accuracy, consent, and authorization" },
  ],
  questions: [
    // Section 1. Business identity. The registry fills in what it already holds.
    s1.short("S1.1", "Registered business name."),
    s1.short("S1.2", "Trade name, if different.", { optional: true }),
    s1.short("S1.3", "Country where the business is registered or operates."),
    s1.one("S1.4", "What is the legal status of the business in its country?", REGISTRATION),
    s1.short("S1.5", "Business registration number.", { showIf: { fact: "S1.4", in: ["registered", "accepted_legal_status"] } }),
    s1.number("S1.6", "Year the business was established.", { integer: true, min: 1900, max: 2100 }),
    s1.one("S1.7", "Business ownership type.", options("Sole proprietorship", "Private limited company", "Partnership", "Cooperative", "Other")),
    s1.yesNo("S1.8", "Is the business woman-owned or woman-led?"),
    s1.yesNo("S1.9", "Is the business youth-owned or youth-led?"),
    s1.short("S1.10", "Name of the contact person."),
    s1.short("S1.11", "Position of the contact person."),
    s1.short("S1.12", "Contact email address."),
    s1.short("S1.13", "Contact telephone number."),
    s1.yesNo("S1.14", "Are you an authorized representative of this business?"),

    // Section 2. Business overview. Also scored under categories A and B.
    s2.short("S2.1", "Industry or sector."),
    s2.long("S2.2", "Describe the business and what it sells."),
    s2.list("S2.3", "Main products or services.", { maxItems: 5 }),
    s2.money("S2.4", "Approximate annual revenue."),
    s2.number("S2.5", "Number of employees.", { integer: true, min: 0, max: 100000 }),
    s2.long("S2.6", "Production or service capacity."),
    s2.list("S2.7", "Countries you currently sell to or serve."),
    s2.one("S2.8", "Is the business operating?", OPERATING),
    s2.long("S2.9", "Who owns and manages the business, and what is their experience?"),
    s2.long("S2.10", "Who needs your product or service, and how do you compare with your competitors?"),
    s2.yesNo("S2.11", "Do you have pricing and product information you can share with buyers or partners?"),
    s2.one("S2.12", "Which opportunity are you mainly applying for?", PATHWAYS, { group: "Your Summit opportunity" }),

    // Section 3. Trade opportunity. Export history is asked only of an exporter, so a first-time exporter is not scored as failing it.
    s3.yesNo("S3.1", "Has the business exported before?"),
    s3.list("S3.2", "Which countries have you exported to?", { showIf: whenAnswered("S3.1") }),
    s3.money("S3.3", "Value of your exports in the last 12 months.", { showIf: whenAnswered("S3.1"), optional: true }),
    s3.list("S3.4", "Which markets do you want to sell to?"),
    s3.yesNo("S3.5", "Do you have an active buyer, enquiry, contract or purchase order?"),
    s3.many(
      "S3.6",
      "What do you have?",
      options("Buyer enquiries", "Signed contract", "Purchase order", "Letter of intent", "Other"),
      { showIf: hasActiveBuyer },
    ),
    s3.long("S3.7", "Describe the buyer and the transaction.", { showIf: hasActiveBuyer }),
    s3.money("S3.8", "Value of the order or expected transaction.", { showIf: hasActiveBuyer }),
    s3.long("S3.9", "How do you meet buyers' requirements, such as quality standards, certifications and volumes?"),
    s3.long("S3.10", "Where do you source your inputs?", { optional: true }),

    // Section 4. Investment opportunity. Hidden for an applicant that isn't seeking investment.
    s4.yesNo("S4.1", "Are you also seeking investment?", { showIf: { fact: "S2.12", in: ["trade_and_market_access", "strategic_partnership"] } }),
    s4.money("S4.2", "How much investment are you seeking?", { showIf: seekingInvestment }),
    s4.long("S4.3", "What would the investment be used for?", { showIf: seekingInvestment }),
    s4.many("S4.4", "What kind of investment are you seeking?", options("Equity", "Loan or debt financing", "Joint venture capital", "Other"), { showIf: seekingInvestment }),
    s4.long("S4.5", "Why will the investment pay off commercially?", { showIf: seekingInvestment }),
    s4.long("S4.6", "How will you carry it out, and what results do you expect?", { showIf: seekingInvestment }),
    s4.yesNo("S4.7", "Do you have a business plan or financial model for the investment?", { showIf: seekingInvestment }),

    // Section 5. Business readiness. Scored under category E.
    s5.yesNo("S5.1", "Do you keep regular financial records?"),
    s5.yesNo("S5.2", "Can you provide financial statements or management accounts for the last two years?"),
    s5.yesNo("S5.3", "Does the business have a management structure with defined responsibilities?"),
    s5.yesNo("S5.4", "Do you hold the licenses, permits or certifications your operations need?"),
    s5.short("S5.5", "What is the largest order or contract you could fulfil in the next 12 months?"),

    // Section 6. Diaspora engagement. Scored under category F.
    s6.yesNo("S6.1", "Have you worked with diaspora customers, partners or investors before?"),
    s6.long("S6.2", "Describe that work.", { showIf: whenAnswered("S6.1") }),
    s6.list("S6.3", "Which diaspora markets or communities do you want to reach?", { maxItems: 5 }),
    s6.many(
      "S6.4",
      "Which kinds of partnership interest you?",
      options("Joint venture", "Distribution or agency", "Co-investment", "Technology partnership", "Sourcing partnership", "Other"),
    ),
    s6.long("S6.5", "What partnership structure do you propose for the joint venture?", { showIf: { fact: "S6.4", in: ["joint_venture"] } }),
    s6.long("S6.6", "What would a partner gain commercially?"),
    s6.long("S6.7", "How would you keep a long-term relationship going?"),

    // Section 7. Summit objectives. The commercial ask feeds the business matching preparation.
    s7.long("S7.1", "What do you want to achieve at the Summit?"),
    s7.many(
      "S7.2",
      "Who do you want to meet?",
      options(
        "International buyers",
        "Importers and distributors",
        "Investors",
        "Financial institutions",
        "Diaspora-owned companies",
        "Joint venture partners",
        "Technology providers",
        "Strategic suppliers",
      ),
    ),
    s7.long("S7.3", "State your commercial ask, for example seeking USD 250,000 for expansion, seeking distributors, or seeking buyers."),
    s7.list("S7.4", "Which country or market is the ask for?", { maxItems: 5 }),
    s7.money("S7.5", "Estimated value of the transaction you hope for."),
    s7.yesNo("S7.6", "Are your business profile and product information ready for B2B meetings?"),
    s7.yesNo("S7.7", "Can you follow up on opportunities after the Summit?"),
    s7.short("S7.8", "Who from the business will attend the Summit?"),

    // Section 8. Supporting documents. The files themselves go through the files API.
    s8.many("S8.1", "Which of these documents can you provide?", DOCUMENTS),

    // Section 9. Declaration. All three must be yes to submit.
    s9.yesNo("S9.1", "I confirm that the information provided is accurate and complete to the best of my knowledge.", { mustBe: "yes" }),
    s9.yesNo("S9.2", "I accept the application declaration and data-use terms.", { mustBe: "yes" }),
    s9.yesNo(
      "S9.3",
      "I understand that my information will not be shared with investors, buyers, banks or other partners without my authorization.",
      { mustBe: "yes" },
    ),
    s9.short("S9.4", "Full name."),
    s9.short("S9.5", "Position / title."),
  ],
};
