import type { ModuleContent } from "../schema";
import { SCORING_GUIDE, STANDARD_BANDS, choice, dateField, form, learningPlan, longText, moneyField, register, shortText, question } from "./helpers";

// Entrust's M04 package, version 1.0, as supplied on 9 Nov 2026. The knowledge check's wrong options are
// the platform team's (see helpers.ts). The module's worksheet stays the transaction brief the trade
// engine defines.
export const M04_V1_0_0: ModuleContent = {
  module: "M04",
  version: "1.0.0",
  title: "Trade Finance and Payment Risk",
  deliverable: "Transaction Finance and Payment-Risk Brief",
  objectives: [
    "Explain the main trade payment methods.",
    "Identify the risks associated with different payment terms.",
    "Understand the basic operation of letters of credit and documentary collections.",
    "Estimate the financing requirement for an export transaction.",
    "Distinguish working capital from trade finance.",
    "Identify buyer, bank, currency and country risks.",
    "Select appropriate questions and controls before accepting payment terms.",
    "Prepare a transaction finance and payment-risk brief.",
  ],
  status: "approved",
  approval: { by: "Minase Fikadu, TRADE platform team", at: "2026-11-09" },
  lessons: [
    {
      id: "introduction",
      title: "Purpose and entry requirements",
      body: `## Module purpose

M04 helps SMEs understand how international trade transactions are financed, how payment terms affect cash flow and what risks arise when dealing with overseas buyers.

An SME may secure an order but still be unable to fulfill it because it cannot finance production, cannot manage the payment period or has accepted terms that expose it to unacceptable risk.

This module introduces the main trade finance options, payment methods, transaction risks and practical controls.

It does not provide a credit decision, legal opinion or guarantee of payment. Financing and payment arrangements must be assessed with the relevant bank, financial institution, insurer or qualified professional.

## Entry requirements

You should have:

- A product or service offering.
- A basic understanding of your costs.
- An identified or potential buyer.
- An estimated order value, where available.
- Basic information about production and delivery requirements.

M03 is recommended before M04, but you may complete M04 independently if you have the required information.`,
    },
    {
      id: "lesson-1",
      title: "Understanding trade finance",
      body: `## Topics

- What trade finance means.
- Working capital versus transaction finance.
- Pre-shipment and post-shipment financing.
- Export finance.
- Import finance.
- Order financing.
- Inventory financing.
- Receivables financing.
- Bank guarantees and other instruments.
- The role of banks and financial institutions.

Financing availability depends on the lender's product, policies, applicable law, collateral requirements and transaction characteristics.

## Practical activity

Map the financing needs of a proposed order.`,
    },
    {
      id: "lesson-2",
      title: "International payment methods",
      body: `## Topics

- Advance payment.
- Open account.
- Documentary collection.
- Documents against Payment (D/P).
- Documents against Acceptance (D/A).
- Letters of credit.
- Bank transfers.
- Payment milestones.
- Deposits and balances.

Each payment method allocates risk differently.`,
    },
    {
      id: "lesson-3",
      title: "Understanding letters of credit",
      body: `## Topics

- Parties to a letter of credit.
- Applicant and beneficiary.
- Issuing and advising banks.
- Confirming bank, where applicable.
- Documentary requirements.
- Presentation periods.
- Expiry dates.
- Discrepancies.
- Payment conditions.
- The importance of complying with documentary terms.

A letter of credit is subject to its stated terms and applicable rules. It is not an unconditional guarantee that every shipment will be paid.

## Practical activity

Review a simplified illustrative letter-of-credit checklist and identify documentary obligations.`,
    },
    {
      id: "lesson-4",
      title: "Buyer and payment risk",
      body: `## Topics

- Buyer identity and financial standing.
- Payment history.
- Country and transfer risk.
- Currency risk.
- Bank risk.
- Fraud and impersonation.
- Changes to bank account details.
- Unusual payment instructions.
- Unreasonable pressure to ship.
- Unclear contractual obligations.

## Practical activity

Complete a buyer payment-risk checklist.`,
    },
    {
      id: "lesson-5",
      title: "Financing an export transaction",
      body: `## Topics

- Production funding.
- Raw material and inventory funding.
- Packaging and quality costs.
- Inland transport.
- Freight and insurance costs.
- Customs and handling charges.
- Payment delays.
- Cash flow timing.
- Financing costs.
- Repayment source.

## Worked example

An SME receives an order worth USD 50,000. It requires USD 18,000 before production, USD 7,000 during production and USD 5,000 for shipment-related costs.

The buyer proposes payment 45 days after delivery.

The SME must calculate the cash required before payment and determine whether its existing cash, supplier terms or financing arrangements can cover the requirement.`,
    },
    {
      id: "lesson-6",
      title: "Negotiating safer payment terms",
      body: `## Topics

- Deposits.
- Staged payments.
- Payment before dispatch.
- Documentary payment arrangements.
- Letters of credit.
- Credit limits.
- Payment milestones.
- Late-payment provisions.
- Currency and bank charges.
- Negotiating changes to unacceptable terms.

## Practical activity

Prepare a payment-term negotiation plan.`,
    },
    {
      id: "practical-exercise",
      title: "Practical exercise: Transaction Finance and Payment-Risk Brief",
      body: `## Output 1: Transaction funding requirement

- Buyer.
- Product.
- Order value.
- Currency.
- Production cost.
- Packaging cost.
- Quality and inspection costs.
- Inland transport.
- Freight and insurance.
- Other costs.
- Total cash required.
- Timing of each payment.
- Expected buyer payment date.

## Output 2: Payment method comparison

| Payment method | Main benefit | Main risk or limitation | Questions to verify |
| --- | --- | --- | --- |
| Advance payment | Reduces seller payment exposure | Buyer may resist; seller must fulfill | Is payment received and cleared? |
| Open account | May attract buyers | Seller carries significant payment exposure | Is buyer credit acceptable? |
| Documentary collection | Banks handle documents under instructions | Banks do not guarantee payment | What happens if buyer refuses documents? |
| Letter of credit | Payment subject to compliant presentation | Documentary discrepancies and bank risk | Can the SME meet all terms? |

## Output 3: Buyer payment-risk checklist

- Buyer identity checked.
- Buyer business activity reviewed.
- Payment history or references reviewed, where available.
- Payment terms documented.
- Buyer bank details confirmed through an independent channel.
- Currency and transfer restrictions considered.
- Country and banking risks considered.
- Fraud indicators reviewed.
- Contractual payment obligations understood.

## Output 4: Financing options assessment

For each option:

- Financing institution.
- Product.
- Amount potentially required.
- Eligibility requirements.
- Security or collateral requirements.
- Cost of finance.
- Application lead time.
- Repayment source.
- Status of enquiry.

## Output 5: Payment negotiation plan

- Current buyer proposal.
- Main risks.
- Preferred payment terms.
- Acceptable alternative.
- Minimum conditions.
- Negotiation points.
- Final decision.

## Completion requirements

To complete M04 you must:

- Complete all six lessons.
- Pass the knowledge check at 80% or higher.
- Submit the five practical outputs.
- Score at least 24/36.
- Have no critical failure.
- Document a payment-risk decision for the illustrative or actual transaction.

You can link the brief to an export transaction in the Export Transaction Workspace.`,
    },
  ],
  workedExample: {
    title: "Illustrative case: Addis Workwear PLC",
    body: `An overseas buyer requests 3,000 uniforms worth USD 45,000.

The buyer proposes:

- No deposit.
- Production within 30 days.
- Shipment after inspection.
- Payment 60 days after delivery.

The SME estimates that production and shipment require USD 25,000 before receiving payment.

The SME must assess:

- Whether it can fund production.
- Whether the buyer has been adequately qualified.
- Whether the payment period is commercially acceptable.
- Whether a deposit or alternative payment instrument can be negotiated.
- Whether a bank can provide a suitable financing product.
- Whether the transaction margin can absorb financing costs.

Possible negotiation:

- A deposit to cover part of production.
- A balance linked to agreed shipment documentation.
- An appropriate documentary instrument, subject to bank confirmation.
- A revised delivery schedule that reflects financing availability.

The SME should not accept the original terms without understanding the cash flow and payment exposure.`,
  },
  worksheets: [
    register(
      "payment_method_comparison",
      "Payment method comparison",
      "Output 2: for each payment method, the main benefit, the main risk or limitation, and the questions to verify.",
      [
        choice("method", "Payment method", [["advance", "Advance payment"], ["open_account", "Open account"], ["documentary_collection_dp", "Documentary collection (D/P)"], ["documentary_collection_da", "Documentary collection (D/A)"], ["letter_of_credit", "Letter of credit"], ["staged", "Deposit and balance"]], true),
        longText("benefit", "Main benefit", true),
        longText("risk", "Main risk or limitation", true),
        longText("verify", "Questions to verify", true),
      ],
      4,
    ),
    register(
      "financing_options_assessment",
      "Financing options assessment",
      "Output 4: each financing option you have looked at. Financing depends on the lender, so record the status of every enquiry.",
      [
        shortText("institution", "Financing institution", true),
        shortText("product", "Product", true),
        moneyField("amount", "Amount potentially required"),
        longText("eligibility", "Eligibility requirements"),
        longText("security", "Security or collateral requirements"),
        longText("cost", "Cost of finance"),
        shortText("lead_time", "Application lead time"),
        longText("repayment_source", "Repayment source", true),
        choice("status", "Status of enquiry", [["not_started", "Not started"], ["enquired", "Enquired"], ["applied", "Applied"], ["approved", "Approved"], ["declined", "Declined"]], true),
      ],
    ),
    form("payment_negotiation_plan", "Payment negotiation plan", "Output 5: what the buyer proposes, what you want, and the least you will accept. Your final decision is the payment-risk decision this module asks for.", [
      longText("current_proposal", "Current buyer proposal", true),
      longText("main_risks", "Main risks", true),
      longText("preferred_terms", "Preferred payment terms", true),
      longText("acceptable_alternative", "Acceptable alternative"),
      longText("minimum_conditions", "Minimum conditions", true),
      longText("negotiation_points", "Negotiation points"),
      longText("final_decision", "Final decision on payment risk", true),
    ]),
    learningPlan(),
  ],
  knowledgeCheck: {
    passMark: 80,
    questions: [
      question(
        "q1",
        "lesson-1",
        "What is trade finance intended to support?",
        "Financing and risk management associated with trade transactions.",
        ["Only the purchase of land and buildings for exporters.", "The marketing of products to overseas buyers.", "Payment of the exporter's income tax."],
        "d",
      ),
      question(
        "q2",
        "lesson-2",
        "What is the main payment risk under open account terms for an exporter?",
        "The buyer receives the goods or services before payment and may delay or fail to pay.",
        ["The buyer pays before the goods are produced.", "The exporter's bank holds the goods until payment.", "The documents are always rejected by the buyer's bank."],
        "a",
      ),
      question(
        "q3",
        "lesson-2",
        "What does D/P mean in documentary collection?",
        "Documents against Payment.",
        ["Deposit and Purchase.", "Delivery by Port.", "Documents after Purchase order."],
        "c",
      ),
      question(
        "q4",
        "lesson-2",
        "What does D/A mean?",
        "Documents against Acceptance.",
        ["Deposit in Advance.", "Delivery at Arrival.", "Duty Assessed."],
        "b",
      ),
      question(
        "q5",
        "lesson-2",
        "Does a bank handling a documentary collection guarantee payment?",
        "No. The bank handles documents according to instructions but does not generally guarantee that the buyer will pay.",
        ["Yes, the bank pays if the buyer does not.", "Yes, as long as the documents are in order.", "Yes, the bank pays the exporter on the day the goods are shipped."],
        "d",
      ),
      question(
        "q6",
        "lesson-3",
        "What is a key risk under a letter of credit?",
        "Failure to comply with documentary terms or presentation requirements, resulting in discrepancies.",
        ["The exporter must pay the issuing bank's charges in advance.", "The buyer can cancel payment after the goods have been shipped.", "The exporter cannot see the terms until after shipment."],
        "a",
      ),
      question(
        "q7",
        "lesson-5",
        "Why should an SME calculate its cash requirement before accepting an order?",
        "To establish whether it can fund production and delivery before receiving buyer payment.",
        ["To decide which colour and size to produce.", "To set the exchange rate with the buyer's bank.", "To choose the transport company."],
        "c",
      ),
      question(
        "q8",
        "lesson-4",
        "Why should changes to buyer bank details be independently verified?",
        "To reduce the risk of payment diversion and impersonation fraud.",
        ["Because banks charge a fee for every change.", "Because the buyer must be notified of the exporter's own bank details.", "To make sure the buyer's bank uses the same currency as the exporter's."],
        "b",
      ),
      question(
        "q9",
        "lesson-1",
        "What is pre-shipment finance used for?",
        "Funding activities required before shipment, such as production and procurement.",
        ["Paying the buyer's import duties after delivery.", "Covering losses on goods that were damaged in transit.", "Funding the exporter's activities after the buyer has paid."],
        "a",
      ),
      question(
        "q10",
        "lesson-1",
        "Does the existence of a purchase order guarantee access to bank financing?",
        "No. Financing depends on the lender's assessment, product terms and applicable requirements.",
        ["Yes, every bank finances a confirmed purchase order in full.", "Yes, if the buyer is overseas.", "Yes, if the order is for more than USD 10,000."],
        "d",
      ),
    ],
  },
  rubric: {
    criteria: [
      { id: "funding_requirement", title: "Transaction funding requirement calculation", maxPoints: 6, mustHave: false },
      { id: "payment_methods", title: "Understanding and comparison of payment methods", maxPoints: 6, mustHave: false },
      { id: "payment_risk", title: "Buyer and payment-risk assessment", maxPoints: 6, mustHave: false },
      { id: "financing_options", title: "Financing options assessment", maxPoints: 6, mustHave: false },
      { id: "negotiation_plan", title: "Payment-term negotiation plan", maxPoints: 6, mustHave: false },
      { id: "brief_and_decision", title: "Quality of transaction finance brief and decision", maxPoints: 6, mustHave: false },
    ],
    passMark: 24,
    mustHaveMinimum: 0,
    bands: STANDARD_BANDS,
    criticalFailures: [
      { id: "cf1", text: "Misrepresenting a payment instrument as a guaranteed payment." },
      { id: "cf2", text: "Ignoring a known payment fraud indicator." },
      { id: "cf3", text: "Advising shipment without identifying a material unresolved payment risk." },
      { id: "cf4", text: "Fabricating buyer financial or banking evidence." },
      { id: "cf5", text: "Miscalculating or omitting a material funding requirement in a way that changes the transaction decision." },
    ],
  },
  aiPrompts: [],
  staff: {
    facilitatorGuide: `## Facilitator responsibilities

- Explain the practical differences between payment methods.
- Avoid presenting one instrument as universally safest or best.
- Encourage SMEs to consult their banks before agreeing to financing or documentary arrangements.
- Use realistic transaction examples.
- Ensure each SME documents its cash requirement and payment conditions.

${SCORING_GUIDE}`,
    liveSessionPlan: `Duration: 180 minutes

| Time | Activity |
| --- | --- |
| 15 min | Introduction to trade finance |
| 30 min | Payment methods |
| 30 min | Letters of credit and documentary collection |
| 25 min | Buyer and payment risk |
| 35 min | Transaction funding exercise |
| 30 min | Payment negotiation simulation |
| 15 min | Review and questions |`,
    hybridSequence: `The digital version includes six lesson units, with:

- A payment method comparison.
- A transaction finance calculator.
- A buyer payment-risk checklist.
- A financing options register.
- A payment negotiation simulation.
- The knowledge check.
- Practical submission and reviewer feedback.

The platform also provides a trade finance glossary and a payment negotiation template.

Delivery is self-paced, instructor-led or hybrid.`,
  },
};
