import type { ModuleContent } from "../schema";
import { SCORING_GUIDE, STANDARD_BANDS, choice, dateField, learningPlan, longText, register, shortText, question } from "./helpers";

// Entrust's M03 package, version 1.0, as supplied on 9 Nov 2026. The knowledge check's wrong options are
// the platform team's (see helpers.ts). The module's worksheets stay the ones the trade engine defines.
export const M03_V1_0_0: ModuleContent = {
  module: "M03",
  version: "1.0.0",
  title: "Financial Performance and Bankability",
  deliverable: "Financial Readiness File",
  objectives: [
    "Identify the core financial records required to manage a business.",
    "Distinguish revenue, profit, cash flow and working capital.",
    "Review basic financial performance.",
    "Identify costs and understand gross margin.",
    "Prepare a basic cash flow forecast.",
    "Estimate a financing requirement and explain its purpose.",
    "Organize financial information for a bank or investor discussion.",
    "Identify financial weaknesses requiring corrective action.",
  ],
  status: "approved",
  approval: { by: "Minase Fikadu, TRADE platform team", at: "2026-11-09" },
  lessons: [
    {
      id: "introduction",
      title: "Purpose and entry requirements",
      body: `## Module purpose

M03 helps SMEs understand their financial position, improve the quality of their financial records and identify the information a lender or investor may need to evaluate the business.

Many SMEs operate with incomplete records, mix personal and business transactions, do not understand their actual margins or cannot explain how much financing they need and how it will be repaid.

This module develops practical financial discipline and helps you prepare a more credible financial information package.

The module does not replace an accountant, auditor, lender or investment professional. Completing it does not guarantee financing or investment approval.

## Entry requirements

You should have, where available:

- Sales records.
- Purchase and expense records.
- Bank or mobile money statements.
- Payroll information.
- Inventory information.
- Existing loan information.
- Basic information about outstanding customer and supplier balances.

Where financial statements are unavailable, begin with the records you do have and identify the missing information.`,
    },
    {
      id: "lesson-1",
      title: "Understanding business financial records",
      body: `## Topics

- Sales and revenue records.
- Purchase and expense records.
- Receipts and invoices.
- Bank statements.
- Payroll.
- Inventory records.
- Accounts receivable and payable.
- Loan and repayment records.
- Separation of personal and business finances.

## Practical activity

Complete a financial records inventory.`,
    },
    {
      id: "lesson-2",
      title: "Understanding financial performance",
      body: `## Topics

- Revenue.
- Cost of sales.
- Gross profit.
- Operating expenses.
- Operating profit.
- Net profit.
- Assets and liabilities.
- Owner's equity.
- Understanding the difference between profit and cash.

## Worked example

A garment SME records:

- Sales revenue: ETB 1,000,000.
- Direct production costs: ETB 650,000.
- Gross profit: ETB 350,000.
- Operating expenses: ETB 250,000.
- Operating profit before other items: ETB 100,000.

The ETB 100,000 operating profit does not necessarily mean the same amount is available in the bank account. Customer payment delays, inventory purchases and debt repayments affect cash availability.

## Practical activity

Prepare a basic income and expense summary.`,
    },
    {
      id: "lesson-3",
      title: "Cash flow and working capital",
      body: `## Topics

- Cash received versus sales recorded.
- Customer payment delays.
- Supplier payment obligations.
- Inventory requirements.
- Payroll and operating expenses.
- Working capital cycle.
- Cash flow forecasting.
- Identifying periods of cash shortage.

## Worked example

A business receives an order requiring ETB 300,000 in production inputs. The buyer will pay 60 days after delivery. The SME must determine how it will fund production and operating costs before receiving payment.

## Practical activity

Prepare a 13-week cash flow forecast using the platform template.`,
    },
    {
      id: "lesson-4",
      title: "Cost control and financial ratios",
      body: `## Topics

- Fixed and variable costs.
- Direct and indirect costs.
- Gross margin.
- Operating margin.
- Break-even analysis.
- Inventory turnover.
- Receivables and payables.
- Debt obligations.

## Worked example

A product sells for ETB 1,000 per unit and has direct costs of ETB 650.

Gross profit per unit is ETB 350.

Gross margin is gross profit ÷ selling price × 100 = 35%.

This is before operating expenses and other applicable costs.

## Practical activity

Calculate the margin for one major product.`,
    },
    {
      id: "lesson-5",
      title: "Understanding financing requirements",
      body: `## Topics

- Working capital financing.
- Equipment and machinery financing.
- Inventory financing.
- Order financing.
- Expansion financing.
- Refinancing existing obligations.
- Equity investment versus debt.
- Financing amount and timing.
- Use of funds.
- Repayment capacity.

You must distinguish between the amount you want and the amount you can justify.

## Practical activity

Prepare a financing requirement statement.`,
    },
    {
      id: "lesson-6",
      title: "Preparing for a bank or investor discussion",
      body: `## Topics

- Business profile.
- Financial statements and records.
- Bank statements.
- Existing borrowing.
- Cash flow forecasts.
- Financing purpose.
- Repayment assumptions.
- Business risks.
- Supporting documents.
- Questions lenders and investors may ask.

## Practical activity

Prepare a basic financial readiness file.`,
    },
    {
      id: "practical-exercise",
      title: "Practical exercise: Financial Readiness File",
      body: `## Output 1: Financial records inventory

| Record | Available? | Period covered | Quality | Action required |
| --- | --- | --- | --- | --- |
| Sales records | | | | |
| Purchase records | | | | |
| Expense records | | | | |
| Bank statements | | | | |
| Inventory records | | | | |
| Payroll records | | | | |
| Loan records | | | | |
| Financial statements | | | | |

## Output 2: Basic financial performance summary

- Revenue.
- Cost of sales.
- Gross profit.
- Operating expenses.
- Operating profit.
- Other income and expenses.
- Net profit, where available.

Identify the period covered and the source of the figures.

## Output 3: Cash flow forecast

Record:

- Opening cash balance.
- Expected customer receipts.
- Other cash inflows.
- Supplier payments.
- Payroll.
- Operating expenses.
- Loan repayments.
- Other cash outflows.
- Closing cash balance.

The forecast covers 13 weeks and identifies any projected cash shortages.

## Output 4: Financing requirement statement

- Amount requested.
- Currency.
- Purpose.
- Cost breakdown.
- Timing of requirement.
- Expected business benefit.
- Repayment source.
- Expected repayment period.
- Supporting evidence.
- Risks and assumptions.

## Output 5: Financial readiness action plan

Identify missing records, reconciliation requirements, accounting support, cash flow improvements and other corrective actions.

## Completion requirements

To complete M03 you must:

- Complete all six lessons.
- Pass the knowledge check at 80% or higher.
- Submit the five practical outputs.
- Score at least 24/36.
- Have no critical failure.
- Identify at least three financial improvement actions.

Where MIZAN is integrated, the platform may link to the approved MIZAN assessment record. It does not reproduce or alter MIZAN's scoring methodology.`,
    },
  ],
  workedExample: {
    title: "Illustrative case: Addis Workwear PLC",
    body: `Addis Workwear has annual sales of ETB 6 million. It wants ETB 1.5 million to purchase materials and fulfill a confirmed order.

The business has:

- Incomplete monthly financial statements.
- Sales records.
- Supplier invoices.
- Bank statements.
- Existing loan repayments.
- A customer payment period of 45 days.

The SME must determine:

- Whether the ETB 1.5 million request is supported by an order-level cash requirement.
- Whether the order produces sufficient margin.
- When cash will be received.
- Whether existing obligations affect repayment capacity.
- Whether the business can support the required repayment schedule.

The SME should not assume that the existence of an order guarantees financing approval.`,
  },
  worksheets: [
    register(
      "financial_readiness_action_plan",
      "Financial readiness action plan",
      "Output 5: the missing records, reconciliations, accounting support and cash flow improvements, with at least three actions.",
      [
        choice("area", "Area", [["missing_records", "Missing records"], ["reconciliation", "Reconciliation"], ["accounting_support", "Accounting support"], ["cash_flow", "Cash flow improvement"], ["other", "Other"]], true),
        longText("action", "Action", true),
        shortText("owner", "Responsible person", true),
        dateField("target_date", "Target date", true),
        shortText("evidence", "Evidence of completion"),
      ],
      3,
    ),
    learningPlan(3),
  ],
  knowledgeCheck: {
    passMark: 80,
    questions: [
      question(
        "q1",
        "lesson-2",
        "What is the difference between revenue and profit?",
        "Revenue is income from sales or services; profit is what remains after applicable costs and expenses.",
        ["Revenue is what remains after costs; profit is the total income from sales.", "They are two names for the same figure.", "Revenue is cash in the bank; profit is the value of unsold stock."],
        "c",
      ),
      question(
        "q2",
        "lesson-3",
        "Why can a profitable business still experience a cash shortage?",
        "Because customers may pay late, inventory and operating costs require cash, and debt obligations must be met.",
        ["Because profit is always paid out to the owner immediately.", "Because a profitable business never needs to buy inventory.", "Because profit and cash are always the same amount."],
        "a",
      ),
      question(
        "q3",
        "lesson-2",
        "What is gross profit?",
        "Revenue minus cost of sales.",
        ["Revenue minus all operating expenses and tax.", "Cash in the bank at the end of the period.", "The total of all sales invoices that are still unpaid."],
        "d",
      ),
      question(
        "q4",
        "lesson-4",
        "What does gross margin measure?",
        "Gross profit as a percentage of sales revenue.",
        ["Operating expenses as a percentage of cash.", "The amount of money the business owes its lenders.", "Net profit as a percentage of total assets."],
        "b",
      ),
      question(
        "q5",
        "lesson-1",
        "Why should personal and business finances be separated?",
        "To improve financial accuracy, accountability and visibility of business performance.",
        ["To reduce the tax that the owner has to pay.", "Because banks only lend to businesses with several bank accounts.", "To avoid keeping receipts and invoices."],
        "c",
      ),
      question(
        "q6",
        "lesson-3",
        "What is working capital used for?",
        "Funding day-to-day business operations and short-term operating requirements.",
        ["Buying land and buildings for the long term.", "Paying dividends to the owners each year.", "Repaying the original capital invested by the owner."],
        "a",
      ),
      question(
        "q7",
        "lesson-5",
        "What should a financing request explain?",
        "The amount required, purpose, cost breakdown, timing, expected benefit and repayment source.",
        ["Only the amount required and the owner's name.", "The lender's preferred interest rate and the loan officer's name.", "The business's turnover for the best month of the year."],
        "d",
      ),
      question(
        "q8",
        "lesson-5",
        "Does a confirmed purchase order automatically guarantee a loan?",
        "No. The lender must assess the business, transaction, repayment capacity and applicable risks.",
        ["Yes, a confirmed order is treated as collateral by every bank.", "Yes, if the order is from an overseas buyer.", "Yes, if the order is larger than the loan requested."],
        "b",
      ),
      question(
        "q9",
        "lesson-3",
        "Why is a cash flow forecast useful?",
        "It identifies expected cash inflows, outflows and periods of potential shortage.",
        ["It proves to a lender that the business is profitable.", "It replaces the need for bank statements and sales records.", "It records what the business spent in the past year."],
        "a",
      ),
      question(
        "q10",
        "lesson-1",
        "What should an SME do when its financial records are incomplete?",
        "Identify missing records, reconstruct information where possible and establish a reliable recordkeeping process.",
        ["Prepare estimated statements and present them as audited.", "Wait until an accountant can prepare complete statements for the past five years.", "Leave out the missing periods and submit the rest."],
        "c",
      ),
    ],
  },
  rubric: {
    criteria: [
      { id: "records_inventory", title: "Financial records inventory and evidence quality", maxPoints: 6, mustHave: false },
      { id: "financial_performance", title: "Basic financial performance analysis", maxPoints: 6, mustHave: false },
      { id: "cash_flow", title: "Cash flow forecast and interpretation", maxPoints: 6, mustHave: false },
      { id: "cost_and_margin", title: "Cost and margin analysis", maxPoints: 6, mustHave: false },
      { id: "financing_requirement", title: "Financing requirement and justification", maxPoints: 6, mustHave: false },
      { id: "improvement_plan", title: "Financial readiness improvement plan", maxPoints: 6, mustHave: false },
    ],
    passMark: 24,
    mustHaveMinimum: 0,
    bands: STANDARD_BANDS,
    criticalFailures: [
      { id: "cf1", text: "Fabricating financial figures or supporting records." },
      { id: "cf2", text: "Presenting estimates as audited or verified financial statements." },
      { id: "cf3", text: "Materially misrepresenting existing debt or repayment obligations." },
      { id: "cf4", text: "Recommending a financing request without identifying its purpose or repayment source." },
    ],
  },
  aiPrompts: [],
  staff: {
    facilitatorGuide: `## Facilitator responsibilities

Use practical SME examples and avoid assuming that all participants have formal accounting systems. Where a participant lacks financial records, the objective is to establish a corrective process, not to manufacture figures.

${SCORING_GUIDE}`,
    liveSessionPlan: `Duration: 180 minutes

| Time | Activity |
| --- | --- |
| 20 min | Introduction and financial records |
| 30 min | Financial performance exercise |
| 35 min | Cash flow and working capital |
| 25 min | Cost and margin analysis |
| 35 min | Financing requirement exercise |
| 25 min | Financial readiness file review |
| 10 min | Questions and next actions |`,
    hybridSequence: `The digital version includes six lesson units, with:

- Downloadable financial templates.
- An interactive margin calculator.
- A 13-week cash flow worksheet.
- A financing requirement builder.
- The knowledge check.
- Practical submission and feedback.

The platform also provides a financial records inventory, a basic income and expense template, a cash flow forecast template, a cost and margin calculator, a financing requirement template, a financial readiness action plan, document upload with version history, and assessment with reviewer feedback.

Delivery is self-paced, instructor-led or hybrid.`,
  },
};
