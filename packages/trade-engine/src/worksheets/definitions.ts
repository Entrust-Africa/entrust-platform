import { CURRENCIES } from "@entrust/forms";
import { OUTLAY_STAGES } from "../calculators";
import type { WorksheetDefinition, WorksheetField } from "./types";

const options = (...labels: string[]) => labels.map((label) => ({ value: label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""), label }));

const money = (id: string, label: string, help?: string): WorksheetField => ({ id, label, kind: "money", ...(help ? { help } : {}) });
const date = (id: string, label: string, help?: string): WorksheetField => ({ id, label, kind: "date", ...(help ? { help } : {}) });
const check = (id: string, label: string): WorksheetField => ({ id, label, kind: "checkbox" });
const yesNo = (id: string, label: string): WorksheetField => ({ id, label, kind: "choice", options: options("Yes", "No") });

/** The currency fields every worksheet with amounts opens with. The rate is the SME's own: the platform fetches none. */
export const MONEY_FIELDS: readonly WorksheetField[] = [
  { id: "currency", label: "Currency", kind: "choice", required: true, options: CURRENCIES.map((c) => ({ value: c, label: c })) },
  { id: "exchange_rate", label: "Exchange rate", kind: "number", help: "How many birr one unit of this currency buys.", showWhen: { field: "currency", in: ["USD", "EUR"] } },
  { id: "rate_date", label: "Date of the rate", kind: "date", showWhen: { field: "currency", in: ["USD", "EUR"] } },
];
const moneyIds = MONEY_FIELDS.map((f) => f.id);

// The 12 documents of M03's financial information pack. The list is ours until Entrust's content package replaces it.
export const INFORMATION_PACK_ITEMS = [
  "Bank statements for the last 12 months",
  "Income statements for the last two years",
  "Balance sheets for the last two years",
  "Cash-flow statement or forecast",
  "Business registration certificate",
  "Tax identification number (TIN) certificate",
  "Tax clearance certificate",
  "Trade licence",
  "Sales records for the last 12 months",
  "List of customers who owe you money",
  "List of suppliers you owe money",
  "Loan and credit statements",
] as const;
export const packItemId = (i: number): string => `doc_${String(i + 1).padStart(2, "0")}`;

// The 10 stages of an export journey, for M01's brief. The list is ours until Entrust's content package replaces it.
export const JOURNEY_STAGES = options(
  "Idea only",
  "Product ready to sell",
  "Target market chosen",
  "Buyer identified",
  "Buyer contacted",
  "Inquiry received",
  "Quotation sent",
  "Order confirmed",
  "Shipment underway",
  "Paid, and selling again",
);

export const PAYMENT_METHODS = options("Advance payment", "Letter of credit", "Documentary collection", "Open account", "Other");
const LEVELS = options("Low", "Medium", "High");

export const WORKSHEET_DEFINITIONS: readonly WorksheetDefinition[] = [
  {
    id: "m01-export-opportunity-brief",
    module: "M01",
    title: "Export Opportunity Brief",
    description: "One page on the export opportunity you will work on: the product, the destination, the buyer, where you stand, what holds you back and what you will do in the next 30 days.",
    money: false,
    fields: [
      { id: "company_name", label: "Company", kind: "text", required: true, help: "Filled in from your business's registry entry." },
      { id: "product", label: "Product", kind: "text", required: true },
      { id: "hs_code", label: "HS code, if you know it", kind: "text" },
      { id: "destination", label: "Destination market", kind: "text", required: true },
      { id: "buyer_profile", label: "The buyer you are aiming at", kind: "long_text", required: true },
      { id: "journey_stage", label: "Where you are on the export journey", kind: "choice", required: true, options: JOURNEY_STAGES },
      { id: "bottleneck", label: "The main thing holding you back", kind: "long_text", required: true },
      date("brief_date", "Date of this brief"),
    ],
    tables: [
      {
        id: "actions",
        label: "Three actions for the next 30 days",
        columns: [
          { id: "action", label: "Action", kind: "text", required: true },
          { id: "owner", label: "Who does it", kind: "text", required: true },
          { id: "deadline", label: "Deadline", kind: "date", required: true },
        ],
        minRows: 3,
        maxRows: 3,
      },
    ],
    computed: [],
    sections: [
      { id: "opportunity", title: "The opportunity", items: ["company_name", "product", "hs_code", "destination", "buyer_profile"] },
      { id: "position", title: "Where you stand", items: ["journey_stage", "bottleneck"] },
      { id: "actions", title: "Next 30 days", items: ["brief_date", "actions"] },
    ],
  },
  {
    id: "m03-income-statement",
    module: "M03",
    title: "Simplified income statement",
    description: "Revenue, what it cost to make what you sold, and what it cost to run the business, worked out into gross profit and operating profit.",
    money: true,
    fields: [
      ...MONEY_FIELDS,
      { id: "period", label: "The period this covers", kind: "text", help: "For example the financial year 2025." },
      money("revenue", "Revenue"),
      money("cost_of_goods_sold", "Cost of goods sold", "What the goods you sold cost you to make or buy."),
      money("operating_expenses", "Operating expenses", "Rent, wages, transport, marketing and the rest of what it costs to run the business."),
    ],
    tables: [],
    computed: [
      { id: "gross_profit", label: "Gross profit", kind: "money", etb: true },
      { id: "gross_margin", label: "Gross margin", kind: "percent" },
      { id: "operating_profit", label: "Operating profit", kind: "money", etb: true },
      { id: "operating_margin", label: "Operating margin", kind: "percent" },
    ],
    sections: [
      { id: "setup", title: "Currency", items: moneyIds },
      { id: "figures", title: "Your figures", items: ["period", "revenue", "cost_of_goods_sold", "operating_expenses"] },
      { id: "results", title: "What they show", items: ["gross_profit", "gross_margin", "operating_profit", "operating_margin"] },
    ],
  },
  {
    id: "m03-cash-flow-forecast",
    module: "M03",
    title: "Three-month cash-flow forecast",
    description: "What you expect to receive and pay each month. Each month starts with the cash the last one ended with.",
    money: true,
    fields: [...MONEY_FIELDS, money("opening_balance", "Cash you have at the start of month 1", "It can be below zero if the account is overdrawn.")],
    tables: [
      {
        id: "months",
        label: "The three months",
        columns: [{ id: "label", label: "Month", kind: "text" }, money("inflows", "Cash coming in"), money("outflows", "Cash going out")],
        computedColumns: [
          { id: "opening", label: "Starts with", kind: "money" },
          { id: "net", label: "Change", kind: "money" },
          { id: "closing", label: "Ends with", kind: "money" },
        ],
        minRows: 3,
        maxRows: 3,
      },
    ],
    computed: [
      { id: "lowest_closing", label: "Lowest month-end cash", kind: "money", etb: true },
      { id: "months_below_zero", label: "Months that end below zero", kind: "number" },
    ],
    sections: [
      { id: "setup", title: "Currency", items: moneyIds },
      { id: "forecast", title: "The forecast", items: ["opening_balance", "months"] },
      { id: "results", title: "What it shows", items: ["lowest_closing", "months_below_zero"] },
    ],
  },
  {
    id: "m03-working-capital-brief",
    module: "M03",
    title: "Export working-capital brief",
    description: "How much cash one export order needs before you are paid, how much of it you have, and the gap you would have to finance.",
    money: true,
    fields: [
      ...MONEY_FIELDS,
      money("pre_shipment_outflows", "Cash out before the goods ship", "Materials, production, packing."),
      money("post_shipment_outflows", "Cash out after the goods ship", "Freight, insurance, customs, agent fees."),
      money("internal_cash", "Cash you can put in yourself"),
      money("buyer_advance", "What the buyer pays up front"),
      date("start_date", "The day the first payment is due"),
      date("payment_date", "The day the buyer's payment arrives"),
    ],
    tables: [],
    computed: [
      { id: "total_outflows", label: "All the cash the order needs", kind: "money", etb: true },
      { id: "available_funds", label: "Cash you have for it", kind: "money", etb: true },
      { id: "gap", label: "Gap", kind: "money", etb: true },
      { id: "funding_needed", label: "What has to be financed", kind: "money", etb: true },
      { id: "days_until_payment", label: "Days until you are paid", kind: "days" },
    ],
    sections: [
      { id: "setup", title: "Currency", items: moneyIds },
      { id: "order", title: "The order", items: ["pre_shipment_outflows", "post_shipment_outflows", "internal_cash", "buyer_advance", "start_date", "payment_date"] },
      { id: "results", title: "The gap", items: ["total_outflows", "available_funds", "gap", "funding_needed", "days_until_payment"] },
    ],
  },
  {
    id: "m03-information-pack",
    module: "M03",
    title: "Financial information pack",
    description: "The twelve documents a bank or a buyer asks for. Tick each one you have ready.",
    money: false,
    fields: INFORMATION_PACK_ITEMS.map((label, i) => check(packItemId(i), label)),
    tables: [],
    computed: [
      { id: "provided", label: "Documents ready", kind: "number" },
      { id: "completion_percent", label: "Complete", kind: "percent" },
      { id: "missing", label: "Still to get", kind: "text" },
    ],
    sections: [
      { id: "documents", title: "The documents", items: INFORMATION_PACK_ITEMS.map((_, i) => packItemId(i)) },
      { id: "results", title: "How far you are", items: ["provided", "completion_percent", "missing"] },
    ],
  },
  {
    id: "m04-transaction-brief",
    module: "M04",
    title: "Transaction Finance and Payment-Risk Brief",
    description: "The brief you take to a bank: the deal, its terms, the buyer's checks, when the cash goes out, the funding gap, the payment risks and how you will repay.",
    money: true,
    prefillFrom: "m03-working-capital-brief",
    printable: true,
    fields: [
      ...MONEY_FIELDS,
      // A. Transaction identity
      { id: "transaction_name", label: "Name of the transaction", kind: "text", required: true },
      { id: "buyer_name", label: "Buyer", kind: "text", required: true },
      { id: "buyer_country", label: "Buyer's country", kind: "text" },
      { id: "product", label: "Product", kind: "text", required: true },
      { id: "quantity", label: "Quantity", kind: "text" },
      { id: "incoterm", label: "Delivery terms (Incoterm)", kind: "choice", options: options("EXW", "FCA", "FOB", "CFR", "CIF", "DAP", "DDP") },
      { id: "deal_basis", label: "What this brief is about", kind: "choice", required: true, options: options("A live order", "A target deal"), help: "A target deal is a real prospect or a practice case your facilitator gave you." },
      { id: "order_document_verified", label: "Do you have a verified purchase order, contract or pro-forma?", kind: "choice", options: options("Yes", "No") },
      // B. Commercial terms
      money("contract_value", "Value of the deal"),
      { id: "payment_method", label: "How the buyer pays", kind: "choice", required: true, options: PAYMENT_METHODS },
      date("production_start", "Production starts"),
      date("delivery_date", "Delivery to the buyer"),
      date("payment_window_end", "Last day the buyer's terms allow it to pay"),
      // C. Buyer due diligence
      yesNo("buyer_verified", "Have you checked who the buyer is and that they pay?"),
      check("dd_registration", "The buyer's company registration"),
      check("dd_references", "References from other suppliers"),
      check("dd_credit_check", "A credit report or bank reference"),
      check("dd_sanctions", "A sanctions and watch-list check"),
      check("dd_bank_confirmation", "The buyer's bank confirmed their account"),
      // E. Funding gap
      money("internal_cash", "Cash you can put in yourself"),
      // G. Repayment
      date("repayment_date", "The day you repay the financing"),
      { id: "repayment_source", label: "Where the repayment comes from", kind: "long_text" },
      // H. Documents
      check("doc_purchase_order", "Purchase order or contract"),
      check("doc_proforma", "Pro-forma invoice"),
      check("doc_insurance", "Cargo insurance"),
      check("doc_packing_list", "Packing list"),
      check("doc_commercial_invoice", "Commercial invoice"),
      check("doc_transport", "Bill of lading or airway bill"),
      // I. Open questions
      { id: "open_questions", label: "Open questions", kind: "long_text" },
    ],
    tables: [
      {
        id: "outlays",
        label: "Cash outlays",
        columns: [
          { id: "stage", label: "Stage", kind: "choice", required: true, options: OUTLAY_STAGES.map((s) => ({ value: s, label: s[0]!.toUpperCase() + s.slice(1) })) },
          { id: "description", label: "What for", kind: "text" },
          date("date", "Date paid"),
          money("amount", "Amount"),
        ],
        computedColumns: [{ id: "cumulative", label: "Paid out so far", kind: "money" }],
        minRows: 1,
        maxRows: 40,
      },
      { id: "advances", label: "What buyers pay up front", columns: [money("amount", "Amount")], maxRows: 5 },
      {
        id: "risks",
        label: "Payment risk register",
        columns: [
          { id: "risk", label: "Risk", kind: "text", required: true },
          { id: "likelihood", label: "How likely", kind: "choice", options: LEVELS },
          { id: "impact", label: "How much it would hurt", kind: "choice", options: LEVELS },
          { id: "mitigation", label: "What you will do about it", kind: "text" },
        ],
        maxRows: 15,
      },
    ],
    computed: [
      { id: "total_outlay", label: "Total cash outlay", kind: "money", etb: true },
      { id: "peak_cumulative", label: "Most cash out at one time", kind: "money", etb: true },
      { id: "peak_date", label: "The day that happens", kind: "text" },
      { id: "available_funds", label: "Cash you have for it", kind: "money", etb: true },
      { id: "gap", label: "Funding gap", kind: "money", etb: true },
      { id: "funding_needed", label: "What has to be financed", kind: "money", etb: true },
      { id: "peak_gap", label: "Gap at the peak", kind: "money", etb: true },
    ],
    sections: [
      { id: "identity", title: "A. The transaction", items: ["transaction_name", "buyer_name", "buyer_country", "product", "quantity", "incoterm", "deal_basis", "order_document_verified"] },
      { id: "terms", title: "B. Commercial terms", items: [...moneyIds, "contract_value", "payment_method", "production_start", "delivery_date", "payment_window_end"] },
      { id: "diligence", title: "C. Buyer due diligence", items: ["buyer_verified", "dd_registration", "dd_references", "dd_credit_check", "dd_sanctions", "dd_bank_confirmation"] },
      { id: "schedule", title: "D. When the cash goes out", items: ["outlays", "total_outlay", "peak_cumulative", "peak_date"] },
      { id: "funding", title: "E. Funding gap", items: ["internal_cash", "advances", "available_funds", "gap", "funding_needed", "peak_gap"] },
      { id: "risks", title: "F. Payment risks", items: ["risks"] },
      { id: "repayment", title: "G. Repayment plan", items: ["repayment_date", "repayment_source"] },
      { id: "documents", title: "H. Documents", items: ["doc_purchase_order", "doc_proforma", "doc_insurance", "doc_packing_list", "doc_commercial_invoice", "doc_transport"] },
      { id: "open", title: "I. Open questions", items: ["open_questions"] },
    ],
  },
];

export const WORKSHEETS: ReadonlyMap<string, WorksheetDefinition> = new Map(WORKSHEET_DEFINITIONS.map((w) => [w.id, w]));
export const findWorksheet = (id: string): WorksheetDefinition | undefined => WORKSHEETS.get(id);
