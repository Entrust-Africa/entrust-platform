import type { ModuleContent } from "../schema";

export const M03_V0_1_0: ModuleContent = {
  module: "M03",
  version: "0.1.0",
  title: "Financial Performance and Bankability",
  deliverable: "Basic financial pack and cash-flow forecast",
  objectives: [
    "Build a monthly cash-flow projection",
    "Assess export working capital needs",
    "Prepare bankability documentation for trade financiers",
  ],
  status: "approved",
  approval: { by: "Entrust Content Team", at: "2026-11-02" },
  lessons: [
    {
      id: "lesson-1",
      title: "Cash-Flow Forecasting vs Accounting Profit",
      body: "# Cash-Flow Forecasting vs Accounting Profit\n\nProfitability does not guarantee solvency. In export contracts, expenses for materials, wages, and freight occur upfront, while buyer payments often arrive 30 to 90 days after delivery.",
      minutes: 15,
    },
    {
      id: "lesson-2",
      title: "Export Working Capital and Cash Cycle",
      body: "# Export Working Capital and Cash Cycle\n\nThe cash conversion cycle measures the days from purchasing raw materials to collecting payment. A longer cycle expands the working capital deficit that requires external financing.",
      minutes: 20,
    },
    {
      id: "lesson-3",
      title: "Lender Due Diligence and Bankability Requirements",
      body: "# Lender Due Diligence and Bankability Requirements\n\nTrade financiers evaluate three pillars: financial records integrity, repayment source certainty (such as an irrevocable LC), and borrower operational track record.",
      minutes: 15,
    },
  ],
  workedExample: {
    title: "Apparel Manufacturer Working Capital Gap",
    body: "A textile exporter secured an order of $120,000 requiring $75,000 in upfront fabric and labor outlays. By presenting a structured cash-flow schedule, they obtained a pre-shipment export credit facility.",
  },
  worksheets: [
    {
      id: "financial-pack",
      title: "Export Cash-Flow Pack",
      fields: [
        { id: "order_value", label: "Contract Value", kind: "money", required: true },
        { id: "production_cost", label: "Total Production Outlay", kind: "money", required: true },
        {
          id: "payment_term",
          label: "Payment Terms",
          kind: "choice",
          options: [
            { value: "advance", label: "Cash in Advance" },
            { value: "lc", label: "Letter of Credit" },
            { value: "open_account", label: "Open Account" },
          ],
        },
      ],
      tables: [
        {
          id: "monthly_cashflow",
          label: "Monthly Outlay Schedule",
          columns: [
            { id: "month", label: "Month", kind: "text" },
            { id: "inflow", label: "Cash Inflow", kind: "money" },
            { id: "outflow", label: "Cash Outflow", kind: "money" },
          ],
        },
      ],
      computed: [],
    },
  ],
  knowledgeCheck: {
    passMark: 80,
    questions: [
      {
        id: "q1",
        text: "Why can a profitable business fail during an export order?",
        options: [
          { id: "a", text: "Due to cash-flow insolvency caused by delayed buyer payments" },
          { id: "b", text: "Because gross margin is irrelevant" },
        ],
        correct: ["a"],
        explanation: "Cash timing is critical; outlays occur months before receivables arrive.",
        lessonId: "lesson-1",
      },
      {
        id: "q2",
        text: "Which items constitute operating cash outflows in export fulfilment? (Select all that apply)",
        options: [
          { id: "a", text: "Raw material procurement" },
          { id: "b", text: "Freight and logistics payments" },
          { id: "c", text: "Unearned asset appreciation" },
        ],
        correct: ["a", "b"],
        explanation: "Materials and transport represent direct operating cash outflows.",
        lessonId: "lesson-2",
      },
      {
        id: "q3",
        text: "What is the export working capital gap?",
        options: [
          { id: "a", text: "The funding shortfall between production outlays and receipt of customer payment" },
          { id: "b", text: "The difference between domestic and export selling prices" },
        ],
        correct: ["a"],
        explanation: "The working capital gap represents peak cash required to finance order fulfillment before collection.",
        lessonId: "lesson-2",
      },
      {
        id: "q4",
        text: "What financial statement is required by trade financiers to verify repayment capacity?",
        options: [
          { id: "a", text: "Cash flow statement and 12-month projections" },
          { id: "b", text: "Informal handwritten notes" },
        ],
        correct: ["a"],
        explanation: "Lenders require verified cash flow projections reflecting debt service capacity.",
        lessonId: "lesson-3",
      },
      {
        id: "q5",
        text: "How does receiving a 30% buyer advance payment impact the cash cycle?",
        options: [
          { id: "a", text: "It reduces the external financing required for initial raw material outlays" },
          { id: "b", text: "It increases credit risk without providing liquidity" },
        ],
        correct: ["a"],
        explanation: "An upfront advance reduces the peak working capital deficit.",
        lessonId: "lesson-2",
      },
    ],
  },
  rubric: {
    criteria: [
      { id: "cashflow", title: "Cash-Flow Forecast Accuracy", maxPoints: 4, mustHave: true },
      { id: "working-capital", title: "Working Capital Gap Quantification", maxPoints: 4, mustHave: true },
      { id: "bankability", title: "Lender Checklist & Risk Mitigation", maxPoints: 4, mustHave: false },
    ],
    passMark: 8,
    mustHaveMinimum: 2,
    bands: [
      { label: "Critical", from: 0 },
      { label: "Developing", from: 40 },
      { label: "Functional", from: 67 },
      { label: "Demonstrated", from: 85 },
    ],
    criticalFailures: [
      { id: "negative-cash-unmitigated", text: "Unmitigated negative cash balance during production" },
    ],
  },
  aiPrompts: [
    {
      id: "cashflow-prompt",
      title: "Cash Flow Drafting Helper",
      prompt: "Help me calculate the monthly working capital deficit for an export order.",
      verification: [
        "Verify payment terms match contract",
        "Ensure all cost lines include shipping, insurance, and duties",
      ],
    },
  ],
  staff: {
    facilitatorGuide: "Ensure SMEs understand that revenue is not cash.",
    liveSessionPlan: "Review cash cycles for agricultural versus manufactured goods.",
    hybridSequence: "Complete financial forecast before live coaching session.",
  },
};
