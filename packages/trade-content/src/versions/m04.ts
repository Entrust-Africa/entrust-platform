import type { ModuleContent } from "../schema";

export const M04_V0_1_0: ModuleContent = {
  module: "M04",
  version: "0.1.0",
  title: "Costing, Pricing and Trade Finance",
  deliverable: "Export transaction brief",
  objectives: [
    "Work out a funding gap",
    "Calculate export pricing and margins",
    "Structure trade finance facilities",
  ],
  status: "approved",
  approval: { by: "Entrust Content Team", at: "2026-11-02" },
  lessons: [
    {
      id: "lesson-1",
      title: "Funding Gaps",
      body: "# Funding Gaps\n\nGap = outlay minus available cash. Identifying peak cash need ensures sufficient facility headroom.",
      minutes: 10,
    },
    {
      id: "lesson-2",
      title: "Payment Terms and Credit Risk",
      body: "# Payment Terms and Credit Risk\n\nOpen account leaves the exporter exposed to buyer default. Letters of credit and trade credit insurance transfer risk to institutions.",
      minutes: 15,
    },
  ],
  workedExample: {
    title: "Garment Order Working Capital",
    body: "Order outlay 760,000, available cash 350,000, resulting in a funding gap of 410,000 to be financed.",
  },
  worksheets: [
    {
      id: "brief",
      title: "Export Transaction Brief",
      fields: [
        { id: "outlay", label: "Total outlay", kind: "money", required: true },
        { id: "cash", label: "Cash in hand", kind: "money" },
        {
          id: "terms",
          label: "Payment terms",
          kind: "choice",
          options: [
            { value: "advance", label: "Advance" },
            { value: "open_account", label: "Open account" },
            { value: "lc", label: "Letter of credit" },
          ],
        },
      ],
      tables: [
        {
          id: "schedule",
          label: "Cash schedule",
          columns: [
            { id: "date", label: "Date", kind: "date" },
            { id: "amount", label: "Amount", kind: "money" },
          ],
          minRows: 1,
        },
      ],
      computed: [
        { id: "gap", label: "Funding gap", kind: "money", calculator: "funding_gap", inputs: ["outlay", "cash"] },
      ],
    },
  ],
  knowledgeCheck: {
    passMark: 80,
    questions: [
      {
        id: "q1",
        text: "Which payment term carries the most risk for the seller?",
        options: [
          { id: "a", text: "Advance" },
          { id: "b", text: "Letter of credit" },
          { id: "c", text: "Open account" },
        ],
        correct: ["c"],
        explanation: "The seller ships before it is paid.",
        lessonId: "lesson-2",
      },
      {
        id: "q2",
        text: "Which of these are direct project outlays? (Select all that apply)",
        options: [
          { id: "a", text: "Raw material procurement" },
          { id: "b", text: "Freight charges" },
          { id: "c", text: "Buyer advance payment" },
        ],
        correct: ["a", "b"],
        explanation: "Materials and freight are expenditures; an advance is a cash inflow.",
        lessonId: "lesson-1",
      },
      {
        id: "q3",
        text: "How is the net funding gap calculated?",
        options: [
          { id: "a", text: "Total outlay minus available cash in hand" },
          { id: "b", text: "Invoice total plus shipping cost" },
        ],
        correct: ["a"],
        explanation: "The funding gap is the net deficit requiring external debt or equity finance.",
        lessonId: "lesson-1",
      },
      {
        id: "q4",
        text: "What risk does an unverified buyer on open account introduce?",
        options: [
          { id: "a", text: "Total loss of goods shipped without legal recourse or payment guarantee" },
          { id: "b", text: "Excessive foreign exchange appreciation" },
        ],
        correct: ["a"],
        explanation: "Shipping to an unverified buyer on open account is a critical trade finance risk.",
        lessonId: "lesson-2",
      },
      {
        id: "q5",
        text: "What documentation does a confirming bank require to release LC funds?",
        options: [
          { id: "a", text: "Clean transport documents and compliance with LC terms" },
          { id: "b", text: "Informal confirmation from the freight agent" },
        ],
        correct: ["a"],
        explanation: "Under UCP 600, payment is strictly conditional on complying document presentation.",
        lessonId: "lesson-2",
      },
    ],
  },
  rubric: {
    criteria: [
      { id: "gap", title: "Funding gap", maxPoints: 3, mustHave: true },
      { id: "risk", title: "Risk register", maxPoints: 3, mustHave: false },
      { id: "plan", title: "Repayment plan", maxPoints: 3, mustHave: true },
    ],
    passMark: 6,
    mustHaveMinimum: 2,
    bands: [
      { label: "Critical", from: 0 },
      { label: "Developing", from: 40 },
      { label: "Functional", from: 67 },
      { label: "Demonstrated", from: 85 },
    ],
    criticalFailures: [
      { id: "open-account", text: "Open account with an unverified buyer", autoCheck: "open-account-unverified" },
      { id: "no-freight", text: "Freight missing from the outlays" },
    ],
  },
  aiPrompts: [
    {
      id: "check-terms",
      title: "Check my terms",
      prompt: "Review these payment terms.",
      verification: ["Recalculate the gap yourself", "Confirm buyer credit score"],
    },
  ],
  staff: {
    facilitatorGuide: "Spend ten minutes on the gap calculation.",
    liveSessionPlan: "Review cash outlays and repayment schedules.",
    hybridSequence: "Lesson first, then the session.",
  },
};
