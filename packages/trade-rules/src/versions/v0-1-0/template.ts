import type { PlacementTemplate, Question, ScaleStep, Section, SectionId, UnscoredAnswer } from "../../types";

// The question wording is the Placement Assessment Specification v1.0, section 2 and the data
// dictionary. The spec doesn't give keys for B to F, so those are named here. G1 to G4 have keys in the
// data dictionary but no wording, and A4a to A4c have no wording either: those are drafted from the
// spec's field names and the M01 opportunity brief, and marked `drafted` for Entrust to confirm.

const SCALE: readonly ScaleStep[] = [
  { score: 0, key: "not_in_place", label: "Not in place", definition: "No established process or usable output." },
  { score: 1, key: "informal", label: "Informal", definition: "Some activity, but inconsistent or incomplete." },
  { score: 2, key: "repeatable", label: "Repeatable", definition: "A repeatable process exists and can be demonstrated." },
  {
    score: 3,
    key: "documented_reviewed",
    label: "Documented and reviewed",
    definition: "The process is documented, regularly used and reviewed for results.",
  },
];

const UNSCORED: readonly UnscoredAnswer[] = [
  { value: "not_applicable", label: "Not applicable", effect: "Leaves the question out of the score only once staff approve it." },
  { value: "not_known", label: "Not known", effect: "Isn't scored and is flagged for follow-up. Missing is not zero." },
];

const SECTIONS: readonly Section[] = [
  {
    id: "A",
    title: "Export experience and current opportunity",
    scored: false,
    notes: [
      "These questions set the commercial context and the urgency of support. They are never folded into a score.",
      "A business with no previous export but a confirmed order needs urgent execution support, not only introductory training.",
    ],
  },
  {
    id: "B",
    title: "Buyer development and conversion",
    scored: true,
    evidenceExamples: "A buyer pipeline, a quotation, an anonymized buyer correspondence record, or a customer follow-up log.",
  },
  {
    id: "C",
    title: "Financial records and bankability",
    scored: true,
    notes: [
      "For C1 to C6, a score of 3 requires a usable, current example. A participant's confidence in their ability is not proof of competence.",
      "C7 is context, not a competence score. A declined application does not mean the business is unbankable; the reasons for the decision matter.",
    ],
  },
  {
    id: "D",
    title: "Transaction finance and payment risk",
    scored: true,
    notes: ["These are skills to assess and teach, not assumptions about which payment instrument or financing product suits every transaction."],
  },
  {
    id: "E",
    title: "Costing and execution management",
    scored: true,
    evidenceExamples: "An anonymized costing sheet, shipment tracker, transaction checklist, or post-shipment cost reconciliation.",
  },
  {
    id: "F",
    title: "Digital operations and productivity",
    scored: true,
    notes: [
      "A business must not be penalized for not owning an ERP. A well-maintained, fit-for-purpose spreadsheet or simpler system can meet the requirement.",
    ],
  },
  { id: "G", title: "Operational readiness", scored: true },
];

const capability = (id: string, key: string, text: string, options: { evidenceBased?: boolean; drafted?: boolean } = {}): Question => ({
  id,
  key,
  section: id.charAt(0) as SectionId,
  kind: "capability",
  text,
  evidenceBased: options.evidenceBased ?? false,
  ...(options.drafted ? { drafted: true } : {}),
});

const QUESTIONS: readonly Question[] = [
  // Section A: pathway and commercial context. A1 and A2 are the answers the evidence in A5 backs up.
  {
    id: "A1",
    key: "export_history",
    section: "A",
    kind: "choice",
    text: "Have you completed an international export shipment?",
    options: [
      { value: "never", label: "Never" },
      { value: "preparing_first_export", label: "Preparing first export" },
      { value: "occasional_exports", label: "One or a few shipments" },
      { value: "regular_exports", label: "Regular exports" },
    ],
    evidenceBased: true,
  },
  {
    id: "A2",
    key: "deal_stage",
    section: "A",
    kind: "choice",
    text: "What is the status of your most advanced current export opportunity?",
    options: [
      { value: "none", label: "None" },
      { value: "buyer_identified", label: "Buyer identified" },
      { value: "buyer_contacted", label: "Buyer contacted" },
      { value: "inquiry_received", label: "Inquiry received" },
      { value: "quotation_sent", label: "Quotation sent" },
      { value: "order_confirmed", label: "Order confirmed" },
      { value: "shipment_underway", label: "Shipment underway" },
      { value: "shipped_awaiting_payment", label: "Shipped and awaiting payment" },
    ],
    evidenceBased: true,
  },
  {
    id: "A3",
    key: "active_buyer_count",
    section: "A",
    kind: "choice",
    text: "How many active international buyers do you currently serve?",
    options: [
      { value: "0", label: "0" },
      { value: "1", label: "1" },
      { value: "2_to_3", label: "2 to 3" },
      { value: "4_or_more", label: "4 or more" },
    ],
    evidenceBased: false,
  },
  {
    id: "A4",
    key: "product_market",
    section: "A",
    kind: "choice",
    text: "Do you have a specific product and target market for your next export?",
    options: [
      { value: "no", label: "No" },
      { value: "product_only", label: "Product only" },
      { value: "market_only", label: "Market only" },
      { value: "both_not_validated", label: "Both selected but not validated" },
      { value: "both_validated", label: "Both validated" },
    ],
    evidenceBased: false,
  },
  {
    id: "A4a",
    key: "target_product",
    section: "A",
    kind: "text",
    text: "Which product do you plan to export next?",
    evidenceBased: false,
    askWhen: { question: "A4", in: ["product_only", "both_not_validated", "both_validated"] },
    drafted: true,
  },
  {
    id: "A4b",
    key: "target_market",
    section: "A",
    kind: "text",
    text: "Which country or market do you plan to sell it in?",
    evidenceBased: false,
    askWhen: { question: "A4", in: ["market_only", "both_not_validated", "both_validated"] },
    drafted: true,
  },
  {
    id: "A4c",
    key: "target_buyer_type",
    section: "A",
    kind: "text",
    text: "What type of buyer are you aiming at, such as a wholesaler, retailer, distributor or direct consumer?",
    evidenceBased: false,
    askWhen: { question: "A4", in: ["both_not_validated", "both_validated"] },
    drafted: true,
  },
  {
    id: "A5",
    key: "available_commercial_evidence",
    section: "A",
    kind: "multi_choice",
    text: "Can you provide evidence of a previous shipment or current commercial opportunity?",
    options: [
      { value: "shipment_record", label: "Yes, shipment record" },
      { value: "buyer_inquiry_or_quotation", label: "Yes, buyer inquiry or quotation" },
      { value: "purchase_order_or_contract", label: "Yes, purchase order or contract" },
      { value: "not_available", label: "Not currently available", exclusive: true },
    ],
    evidenceBased: false,
  },

  // Section B: buyer development and conversion. Max 15.
  capability("B1", "buyer_list", "Maintains an up-to-date list of prospective and existing buyers.", { evidenceBased: true }),
  capability("B2", "buyer_verification", "Verifies buyer identity, commercial relevance and credibility before committing resources.", {
    evidenceBased: true,
  }),
  capability("B3", "quotations_and_inquiries", "Prepares professional quotations and responds to buyer inquiries.", { evidenceBased: true }),
  capability("B4", "follow_up_tracking", "Tracks follow-ups, negotiation stages and next actions.", { evidenceBased: true }),
  capability("B5", "buyer_relationships", "Manages existing buyer relationships, complaints and repeat-order opportunities.", { evidenceBased: true }),

  // Section C: financial records and bankability. Max 18, plus C7 as context.
  capability("C1", "sales_expense_records", "Are sales and expenses recorded consistently?", { evidenceBased: true }),
  capability("C2", "financial_statements", "Can you produce current financial statements or reliable management accounts?", { evidenceBased: true }),
  capability("C3", "bank_reconciliation", "Can you reconcile business transactions against bank records?", { evidenceBased: true }),
  capability("C4", "cash_flow_forecast", "Do you prepare a cash-flow forecast?", { evidenceBased: true }),
  capability("C5", "working_capital_estimate", "Can you calculate the working capital needed to fulfill an order?", { evidenceBased: true }),
  capability("C6", "financing_documents", "Can you assemble the documents required for a bank financing application?", { evidenceBased: true }),
  {
    id: "C7",
    key: "financing_history",
    section: "C",
    kind: "choice",
    text: "Have you applied for business financing, and what was the outcome?",
    options: [
      { value: "never_applied", label: "Never applied" },
      { value: "preparing", label: "Preparing" },
      { value: "submitted", label: "Submitted" },
      { value: "approved", label: "Approved" },
      { value: "declined", label: "Declined" },
      { value: "disbursed", label: "Disbursed" },
    ],
    evidenceBased: false,
  },

  // Section D: transaction finance and payment risk. Max 15.
  capability(
    "D1",
    "payment_method_comparison",
    "Can the SME compare advance payment, documentary credit and documentary collection in the context of a specific deal?",
  ),
  capability("D2", "payment_risk_identification", "Can it identify the risks associated with delayed payment, currency movements and buyer default?"),
  capability("D3", "cash_need_timing", "Can it estimate the timing and amount of cash needed before receiving buyer payment?"),
  capability("D4", "financing_request", "Can it prepare a financing request linked to a specific purchase order, contract or shipment?"),
  capability(
    "D5",
    "payment_terms_effect",
    "Can it explain how payment terms, documents and shipment milestones affect the likelihood and timing of payment?",
  ),

  // Section E: costing and execution management. Max 18.
  capability("E1", "cost_and_margin", "Calculates product cost, shipment-related costs and expected profit margin.", { evidenceBased: true }),
  capability("E2", "shipment_charges", "Can estimate freight, handling and other shipment charges and account for cost changes.", {
    evidenceBased: true,
  }),
  capability("E3", "shipment_tracking", "Tracks shipment milestones, documentation, responsible parties and deadlines.", { evidenceBased: true }),
  capability(
    "E4",
    "contingency_process",
    "Has a contingency process for delays, rejected goods, unavailable containers or changed transport arrangements.",
    { evidenceBased: true },
  ),
  capability("E5", "cost_reconciliation", "Reconciles actual shipment costs against the original quotation and identifies margin leakage.", {
    evidenceBased: true,
  }),
  capability("E6", "transaction_review", "Reviews completed transactions to improve the next quotation or shipment.", { evidenceBased: true }),

  // Section F: digital operations and productivity. Max 15.
  capability("F1", "digital_profile", "Maintains accurate business and product information online or in a shareable digital profile."),
  capability("F2", "buyer_tracking_system", "Uses a working system to track buyers, quotations, orders and follow-ups."),
  capability("F3", "cost_and_receivables_tracking", "Uses a digital method to track costs, invoices and receivables."),
  capability(
    "F4",
    "ai_tool_use",
    "Can use AI tools to research buyers, draft commercial communications or prepare documents, while checking the results.",
  ),
  capability("F5", "organized_records", "Maintains accessible, organized business records that can be used for management or financing decisions."),

  // Section G: operational readiness. Max 12. The keys are the data dictionary's; the wording is drafted.
  capability("G1", "production_capacity_planning", "Plans production capacity against order quantities and delivery dates.", { drafted: true }),
  capability("G2", "fulfillment_responsibility", "Has named people responsible for each stage of fulfilling an order.", { drafted: true }),
  capability("G3", "shipment_contingency", "Has a plan for what to do when production or a shipment runs late.", { drafted: true }),
  capability("G4", "delivery_schedule_control", "Controls the delivery schedule from confirmed order to dispatch and checks it against the buyer's date.", {
    drafted: true,
  }),
];

export const PLACEMENT_TEMPLATE: PlacementTemplate = {
  sections: SECTIONS,
  questions: QUESTIONS,
  scale: SCALE,
  unscoredAnswers: UNSCORED,
};
