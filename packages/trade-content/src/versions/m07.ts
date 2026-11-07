import type { ModuleContent } from "../schema";

export const M07_V0_1_0: ModuleContent = {
  module: "M07",
  version: "0.1.0",
  title: "Operational Planning and Fulfillment",
  deliverable: "Order fulfillment plan",
  objectives: [
    "Calculate net factory capacity and cycle times",
    "Develop a bill of materials with realistic scrap allowances",
    "Construct a backward milestone schedule from the handover date",
    "Enforce pre-dispatch quality control and risk mitigations",
    "Record formal management authorisation decisions",
  ],
  status: "approved",
  approval: { by: "Entrust Content Team", at: "2026-11-07" },
  lessons: [
    {
      id: "capacity-planning",
      title: "Capacity Planning and Bottlenecks",
      body: "# Capacity Planning\n\nNet capacity accounts for available machine hours, cycle time, maintenance, and scrap rework allowances. Overtime and subcontracting mitigate peak capacity shortfalls.",
      minutes: 15,
    },
    {
      id: "bom-waste",
      title: "Bill of Materials and Waste Allowances",
      body: "# Bill of Materials (BOM)\n\nEvery export line item must include raw material inputs, unit costs, and specific waste percentages (scrap allowance) to guarantee adequate procurement.",
      minutes: 15,
    },
    {
      id: "backward-scheduling",
      title: "Backward Scheduling and Critical Paths",
      body: "# Backward Scheduling\n\nMilestones are scheduled backwards from the carrier handover date: packaging, final inspection, production run, and material procurement lead times.",
      minutes: 15,
    },
    {
      id: "qc-authorisation",
      title: "Quality Control and Authorisation",
      body: "# Quality Control & Authorisation\n\nMandatory pre-dispatch quality checks prevent defective shipments. Every order fulfilment plan requires recorded executive authorisation before execution.",
      minutes: 15,
    },
  ],
  workedExample: {
    title: "1,000-Uniform Export Order",
    body: "Order for 1,000 uniforms: 2,625 meters of fabric (2.5 m base with 5% waste), net daily output of 55 units with overtime, requiring 18.2 production days.",
  },
  worksheets: [
    {
      id: "fulfilment_plan",
      title: "Order Fulfilment Plan",
      fields: [
        { id: "customer_name", label: "Customer / Buyer name", kind: "text", required: true },
        { id: "order_quantity", label: "Order quantity (units)", kind: "number", required: true },
        { id: "machines", label: "Operational machines", kind: "number", required: true },
        { id: "working_hours_per_day", label: "Working hours per day", kind: "number", required: true },
        { id: "cycle_time_minutes", label: "Cycle time per unit (min)", kind: "number", required: true },
        { id: "scrap_rate", label: "Scrap allowance (%)", kind: "percent", required: true },
        { id: "material_lead_days", label: "Material procurement lead time (days)", kind: "number", required: true },
        { id: "handover_date", label: "Handover date", kind: "date", required: true },
        { id: "contract_deadline", label: "Contract deadline", kind: "date", required: true },
      ],
      tables: [
        {
          id: "bom",
          label: "Bill of materials",
          columns: [
            { id: "item", label: "Material item", kind: "text", required: true },
            { id: "unit", label: "Unit", kind: "text", required: true },
            { id: "base_qty_per_unit", label: "Base qty / unit", kind: "number", required: true },
            { id: "waste_percent", label: "Waste %", kind: "percent", required: true },
            { id: "unit_cost", label: "Unit cost", kind: "money" },
          ],
          minRows: 1,
        },
        {
          id: "risks",
          label: "Risk and contingency register",
          columns: [
            { id: "risk", label: "Operational risk", kind: "text", required: true },
            { id: "mitigation", label: "Contingency action", kind: "text" },
          ],
        },
      ],
      computed: [
        {
          id: "net_capacity",
          label: "Net capacity and days required",
          kind: "days",
          calculator: "net_capacity",
          inputs: ["order_quantity", "machines", "working_hours_per_day", "cycle_time_minutes", "scrap_rate"],
        },
        {
          id: "materials_cost",
          label: "Total materials cost",
          kind: "money",
          calculator: "bill_of_materials",
          inputs: ["order_quantity", "bom"],
        },
        {
          id: "backward_schedule",
          label: "Backward milestone schedule",
          kind: "days",
          calculator: "backward_schedule",
          inputs: ["handover_date", "contract_deadline", "material_lead_days"],
        },
      ],
    },
  ],
  knowledgeCheck: {
    passMark: 80,
    questions: [
      {
        id: "q1",
        text: "How is net daily factory capacity determined from standard shift hours?",
        options: [
          { id: "a", text: "Total machine hours without considering machine downtime or cycle time" },
          { id: "b", text: "Productive machine hours adjusted for scrap and rework allowance, divided by unit cycle time" },
          { id: "c", text: "Contract delivery quantity divided by calendar days in the month" },
        ],
        correct: ["b"],
        explanation: "Net capacity reflects effective productive machine hours after deducting scrap allowances, scaled by unit cycle time.",
        lessonId: "capacity-planning",
      },
      {
        id: "q2",
        text: "In the 1,000-uniform exercise, what is the required fabric quantity given 2.5 m base and 5% scrap allowance?",
        options: [
          { id: "a", text: "2,500 meters" },
          { id: "b", text: "2,625 meters" },
          { id: "c", text: "2,750 meters" },
        ],
        correct: ["b"],
        explanation: "1,000 units × 2.5 m = 2,500 m base; with 5% waste (125 m), total procurement is 2,625 meters.",
        lessonId: "bom-waste",
      },
      {
        id: "q3",
        text: "What starting anchor is used to calculate backward milestone schedules in export fulfilment?",
        options: [
          { id: "a", text: "The day raw materials are ordered from the supplier" },
          { id: "b", text: "The agreed handover date to the carrier or forwarder" },
          { id: "c", text: "The date buyer payment is deposited in the bank" },
        ],
        correct: ["b"],
        explanation: "Backward scheduling works back from the carrier handover date through transit, QC, production, and procurement lead times.",
        lessonId: "backward-scheduling",
      },
      {
        id: "q4",
        text: "Which of the following constitute critical failures in an order fulfilment plan? (Select all that apply)",
        options: [
          { id: "a", text: "Output exceeds net capacity with neither overtime nor outsourcing scheduled" },
          { id: "b", text: "Material procurement lead times are omitted from the schedule" },
          { id: "c", text: "No quality control inspection checkpoint is scheduled prior to dispatch" },
          { id: "d", text: "Material procurement due date clashes with M04 cash availability" },
          { id: "e", text: "Contract delivery terms use FOB instead of EXW" },
        ],
        correct: ["a", "b", "c", "d"],
        explanation: "All four conditions represent severe operational risks that lead to contract default or line stoppage.",
        lessonId: "qc-authorisation",
      },
      {
        id: "q5",
        text: "Why is formal authorisation recorded prior to factory floor execution?",
        options: [
          { id: "a", text: "To officially commit factory machine capacity, labor shifts, and capital outlay" },
          { id: "b", text: "To eliminate the need for quality control inspections" },
          { id: "c", text: "To automatically transfer logistics responsibility to the buyer" },
        ],
        correct: ["a"],
        explanation: "Authorisation provides managerial sign-off verifying capacity feasibility, material commitments, and financial coverage.",
        lessonId: "qc-authorisation",
      },
    ],
  },
  rubric: {
    criteria: [
      {
        id: "capacity_realism",
        title: "Capacity Planning & Cycle Time Realism",
        description: "Accurate calculation of net capacity, machine availability, cycle time, and overtime / outsourcing feasibility.",
        maxPoints: 4,
        mustHave: true,
      },
      {
        id: "materials_bom",
        title: "Bill of Materials & Waste Control",
        description: "Comprehensive input specification with realistic waste / scrap percentages and accurate procurement volumes.",
        maxPoints: 4,
        mustHave: true,
      },
      {
        id: "milestone_schedule",
        title: "Backward Scheduling & Milestone Feasibility",
        description: "Milestones scheduled backwards from handover date, accounting for procurement lead times, QC, and cash alignment.",
        maxPoints: 4,
        mustHave: true,
      },
      {
        id: "governance_authorisation",
        title: "Quality Assurance & Authorisation Governance",
        description: "Pre-dispatch QC protocols, operational risk mitigation contingencies, and recorded management authorisation.",
        maxPoints: 4,
        mustHave: false,
      },
    ],
    passMark: 12,
    mustHaveMinimum: 3,
    bands: [
      { label: "Critical", from: 0 },
      { label: "Developing", from: 40 },
      { label: "Functional", from: 67 },
      { label: "Demonstrated", from: 85 },
    ],
    criticalFailures: [
      {
        id: "output_exceeds_net_capacity",
        text: "Output exceeds 100% of net capacity with no overtime or outsourcing",
        autoCheck: "output_exceeds_net_capacity",
      },
      {
        id: "material_lead_time_omitted",
        text: "Material procurement lead times omitted",
        autoCheck: "material_lead_time_omitted",
      },
      {
        id: "no_qc_before_dispatch",
        text: "No quality control inspection checkpoint scheduled before dispatch",
        autoCheck: "no_qc_before_dispatch",
      },
      {
        id: "schedule_cash_clash",
        text: "Schedule clashes with M04 cash dates",
        autoCheck: "schedule_cash_clash",
      },
    ],
  },
  aiPrompts: [
    {
      id: "capacity-optimiser",
      title: "Optimise line capacity and cycle time",
      prompt: "Given product specifications and order volume, suggest machine layout and cycle time adjustments.",
      verification: [
        "Verify machine manufacturer cycle time ratings",
        "Check labor shift regulations and overtime restrictions",
      ],
    },
  ],
  staff: {
    facilitatorGuide: "Focus on the 1,000-uniform exercise: highlight why 18.2 days with overtime is mathematically correct and verify students account for material lead times.",
    liveSessionPlan: "Simulate capacity bottleneck resolutions and evaluate trade-offs between overtime and subcontracting.",
    hybridSequence: "Complete Capacity and BOM lessons before attending the live factory simulation session.",
  },
};
