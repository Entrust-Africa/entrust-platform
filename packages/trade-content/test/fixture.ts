import type { ModuleContent } from "../src";

// A small made-up module for the tests. It isn't Entrust's content: nothing in it is taught.
export const fixture = (change: Partial<ModuleContent> = {}): ModuleContent => ({
  module: "M04",
  version: "0.1.0",
  title: "Test module",
  deliverable: "Test brief",
  objectives: ["Work out a funding gap"],
  status: "draft",
  lessons: [
    { id: "lesson-1", title: "Funding gaps", body: "# Funding gaps\n\nGap = outlay minus cash.", minutes: 10, videoUrl: "https://example.test/video" },
    { id: "lesson-2", title: "Payment terms", body: "Open account is the riskiest." },
  ],
  workedExample: { title: "Garment order", body: "Outlay 760k, cash 350k." },
  worksheets: [
    {
      id: "brief",
      title: "Brief",
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
          ],
        },
      ],
      tables: [{ id: "schedule", label: "Cash schedule", columns: [{ id: "date", label: "Date", kind: "date" }, { id: "amount", label: "Amount", kind: "money" }], minRows: 1 }],
      computed: [{ id: "gap", label: "Funding gap", kind: "money", calculator: "fundingGap", inputs: ["outlay", "cash"] }],
    },
  ],
  knowledgeCheck: {
    passMark: 80,
    questions: [
      {
        id: "q1",
        text: "Which payment term carries the most risk for the seller?",
        options: [{ id: "a", text: "Advance" }, { id: "b", text: "Letter of credit" }, { id: "c", text: "Open account" }],
        correct: ["c"],
        explanation: "The seller ships before it is paid.",
      },
      {
        id: "q2",
        text: "Which of these are outlays?",
        options: [{ id: "a", text: "Raw material" }, { id: "b", text: "Freight" }, { id: "c", text: "Buyer advance" }],
        correct: ["a", "b"],
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
    bands: [{ label: "Critical", from: 0 }, { label: "Developing", from: 40 }, { label: "Functional", from: 67 }, { label: "Demonstrated", from: 85 }],
    criticalFailures: [
      { id: "open-account", text: "Open account with an unverified buyer", autoCheck: "open-account-unverified" },
      { id: "no-freight", text: "Freight missing from the outlays" },
    ],
  },
  aiPrompts: [{ id: "check-terms", title: "Check my terms", prompt: "Review these payment terms.", verification: ["Recalculate the gap yourself"] }],
  staff: { facilitatorGuide: "Spend ten minutes on the gap.", liveSessionPlan: "Session plan", hybridSequence: "Lesson first, then the session" },
  ...change,
});

export const approved = (change: Partial<ModuleContent> = {}): ModuleContent =>
  fixture({ status: "approved", approval: { by: "Entrust content team", at: "2026-11-02" }, ...change });
