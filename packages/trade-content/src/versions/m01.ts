import type { ModuleContent } from "../schema";

export const M01_V0_1_0: ModuleContent = {
  module: "M01",
  version: "0.1.0",
  title: "Diagnostic and Deal Selection",
  deliverable: "Export opportunity brief",
  objectives: [
    "Identify viable export markets and products",
    "Evaluate regulatory and quality requirements",
    "Structure an export deal hypothesis",
  ],
  status: "approved",
  approval: { by: "Entrust Content Team", at: "2026-11-02" },
  lessons: [
    {
      id: "lesson-1",
      title: "Market & Deal Selection",
      body: "# Market & Deal Selection\n\nExport readiness requires matching your proven domestic capabilities with demand in targeted regional and international markets. Prioritize markets based on tariff preferences, trade logistics, and regulatory barriers.",
      minutes: 15,
    },
    {
      id: "lesson-2",
      title: "Export Opportunity Brief Structure",
      body: "# Export Opportunity Brief Structure\n\nThe brief documents the complete transaction hypothesis: the product specification, target buyer profile, proposed volume, delivery Incoterm, and realistic cash timeline.",
      minutes: 20,
    },
    {
      id: "lesson-3",
      title: "Regulatory and Standards Compliance",
      body: "# Regulatory and Standards Compliance\n\nInternational buyers enforce sanitary, phytosanitary, packaging, and traceability standards. Failing to verify mandatory certificates before dispatch causes border rejections.",
      minutes: 15,
    },
  ],
  workedExample: {
    title: "Specialty Coffee to Europe",
    body: "An Ethiopian coffee cooperative structured an opportunity brief for washed Grade 1 Yirgacheffe, verifying EU pesticide residue limits and organic certifications prior to contracting.",
  },
  worksheets: [
    {
      id: "opportunity-brief",
      title: "Export Opportunity Brief",
      fields: [
        { id: "product_name", label: "Target Product Name", kind: "text", required: true },
        { id: "target_market", label: "Destination Country", kind: "text", required: true },
        {
          id: "delivery_term",
          label: "Incoterm",
          kind: "choice",
          options: [
            { value: "fob", label: "FOB - Free on Board" },
            { value: "cif", label: "CIF - Cost, Insurance & Freight" },
            { value: "exw", label: "EXW - Ex Works" },
          ],
        },
      ],
      tables: [
        {
          id: "buyer_criteria",
          label: "Buyer Qualification Checklist",
          columns: [
            { id: "criterion", label: "Criterion", kind: "text" },
            { id: "status", label: "Status", kind: "text" },
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
        text: "What is the primary purpose of an Export Opportunity Brief?",
        options: [
          { id: "a", text: "To replace formal customs clearance" },
          { id: "b", text: "To define the product, target market, buyer profile and deal viability" },
          { id: "c", text: "To request immediate grant funding without verification" },
        ],
        correct: ["b"],
        explanation: "The brief defines the target market, buyer profile, product specifications, and deal economics.",
        lessonId: "lesson-2",
      },
      {
        id: "q2",
        text: "Which criteria determine whether an SME is ready for Pathway B (Direct Order Execution)? (Select all that apply)",
        options: [
          { id: "a", text: "The business has a verified live purchase order or export contract" },
          { id: "b", text: "The business only has an informal ambition to export" },
          { id: "c", text: "The business has verified production capacity" },
        ],
        correct: ["a", "c"],
        explanation: "Pathway B requires verified order documentation and confirmed production capacity.",
        lessonId: "lesson-1",
      },
      {
        id: "q3",
        text: "What does SPS stand for in international trade standards?",
        options: [
          { id: "a", text: "Sanitary and Phytosanitary measures" },
          { id: "b", text: "Standard Purchasing System" },
          { id: "c", text: "Supplier Price Schedule" },
        ],
        correct: ["a"],
        explanation: "SPS measures protect humans, animals, and plants from diseases, pests, or contaminants.",
        lessonId: "lesson-3",
      },
      {
        id: "q4",
        text: "When evaluating a target market, why are Rules of Origin critical?",
        options: [
          { id: "a", text: "They determine tariff treatment and preferential duty access under trade agreements" },
          { id: "b", text: "They determine the flight schedule of shipping carriers" },
        ],
        correct: ["a"],
        explanation: "Rules of origin determine whether goods qualify for preferential duty rates under agreements like AfCFTA.",
        lessonId: "lesson-1",
      },
      {
        id: "q5",
        text: "In M01 deal selection, what must an exporter do before committing to buyer delivery deadlines?",
        options: [
          { id: "a", text: "Confirm lead times for raw materials, production, and freight logistics" },
          { id: "b", text: "Assume standard shipping never experiences delays" },
        ],
        correct: ["a"],
        explanation: "A realistic timeline must account for material sourcing, net production capacity, and transit logistics.",
        lessonId: "lesson-2",
      },
    ],
  },
  rubric: {
    criteria: [
      { id: "market", title: "Target Market Selection", maxPoints: 4, mustHave: true },
      { id: "buyer", title: "Buyer Profile & Deal Hypothesis", maxPoints: 4, mustHave: true },
      { id: "compliance", title: "Compliance & Standards Checklist", maxPoints: 4, mustHave: false },
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
      { id: "no-target-market", text: "No identified target market or product specifications" },
    ],
  },
  aiPrompts: [
    {
      id: "market-research",
      title: "Market Research Assistant",
      prompt: "Help me analyze trade flows and tariff barriers for my product in target markets.",
      verification: [
        "Verify tariff rates against official customs schedules",
        "Cross-check buyer requirements with local trade associations",
      ],
    },
  ],
  staff: {
    facilitatorGuide: "Guide learners through selecting one clear target product and market.",
    liveSessionPlan: "Review sample opportunity briefs and assess readiness.",
    hybridSequence: "Complete lessons 1 and 2 before attending cohort session.",
  },
};
