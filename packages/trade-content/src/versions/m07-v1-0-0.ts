import type { ModuleContent } from "../schema";
import { SCORING_GUIDE, STANDARD_BANDS, question } from "./helpers";

// Entrust's M07 package, version 1.0, as supplied on 9 Nov 2026. The knowledge check's wrong options are
// the platform team's (see helpers.ts). The module's worksheet stays the order fulfilment plan the trade
// engine defines. M07 has six practical outputs, where M01, M03 and M04 have five.
export const M07_V1_0_0: ModuleContent = {
  module: "M07",
  version: "1.0.0",
  title: "Operational Planning and Fulfillment",
  deliverable: "Order Fulfillment Plan",
  objectives: [
    "Translate an order into an operational work plan.",
    "Assess current and available production or service capacity.",
    "Identify materials, labor, equipment and supplier requirements.",
    "Prepare a basic production or service schedule.",
    "Establish quality-control checkpoints.",
    "Identify fulfillment risks and contingency actions.",
    "Coordinate packaging, logistics and delivery responsibilities.",
    "Monitor fulfillment and document completion.",
  ],
  status: "draft",
  lessons: [
    {
      id: "introduction",
      title: "Purpose and entry requirements",
      body: `## Module purpose

M07 helps SMEs determine whether they can reliably fulfill a commercial order and how to organize the people, materials, production, quality, packaging and delivery activities required.

An SME may identify a buyer and agree on a price but still fail to deliver because it has underestimated production time, material requirements, capacity constraints or quality-control obligations.

This module introduces a practical approach to translating an order into an operational fulfillment plan.

## Entry requirements

You should have:

- A product or service description.
- An estimated or confirmed order quantity.
- Basic information about production capacity.
- Information about materials and suppliers.
- An estimated delivery date.
- Any known buyer specifications.

Where an actual order is unavailable, you may use the illustrative case.`,
    },
    {
      id: "lesson-1",
      title: "Understanding order requirements",
      body: `## Topics

- Purchase orders and commercial agreements.
- Product specifications.
- Quantity and tolerances.
- Quality standards.
- Packaging and labeling.
- Delivery dates.
- Inspection requirements.
- Buyer communication.
- Contractual responsibilities.

## Practical activity

Prepare an order requirement summary.`,
    },
    {
      id: "lesson-2",
      title: "Assessing operational capacity",
      body: `## Topics

- Installed capacity.
- Actual production capacity.
- Available capacity.
- Existing orders and commitments.
- Labor availability.
- Equipment availability.
- Production lead time.
- Bottlenecks.
- Outsourcing.
- Capacity expansion.

## Worked example

A garment business can produce 1,000 uniforms per month under normal operating conditions. It already has commitments for 650 units and receives an additional order for 500 units.

Its available monthly capacity is only 350 units before considering overtime, additional shifts or subcontracting.

The business must determine how it will fulfill the order without compromising existing commitments.

## Practical activity

Complete a capacity assessment.`,
    },
    {
      id: "lesson-3",
      title: "Materials, suppliers and procurement",
      body: `## Topics

- Bill of materials.
- Material quantities.
- Supplier identification.
- Supplier lead times.
- Minimum order quantities.
- Price changes.
- Supplier reliability.
- Stock availability.
- Procurement schedules.
- Alternative suppliers.

## Practical activity

Prepare a material and procurement plan.`,
    },
    {
      id: "lesson-4",
      title: "Production and service scheduling",
      body: `## Topics

- Breaking an order into tasks.
- Work sequence.
- Labor allocation.
- Equipment scheduling.
- Production milestones.
- Lead times.
- Work-in-progress monitoring.
- Bottleneck management.
- Progress reporting.

## Practical activity

Prepare a production schedule with milestones and responsible persons.`,
    },
    {
      id: "lesson-5",
      title: "Quality control and fulfillment risk",
      body: `## Topics

- Buyer specifications.
- Quality-control standards.
- Inspection points.
- Defect prevention.
- Rework.
- Product testing.
- Packaging quality.
- Supplier quality.
- Operational disruption.
- Contingency planning.

## Practical activity

Prepare a quality-control and risk checklist.`,
    },
    {
      id: "lesson-6",
      title: "Packaging, logistics and delivery coordination",
      body: `## Topics

- Packaging requirements.
- Product protection.
- Labeling.
- Storage and handling.
- Dispatch planning.
- Transport coordination.
- Delivery milestones.
- Shipping documentation coordination.
- Proof of delivery.
- Buyer communication.
- Exception management.

Operational planning is different from regulatory export compliance. Check product- and destination-specific requirements through the appropriate current sources and workflows, including CLEAR Export where enabled.

## Practical activity

Prepare a fulfillment and delivery plan.`,
    },
    {
      id: "practical-exercise",
      title: "Practical exercise: Order Fulfillment Plan",
      body: `## Output 1: Order requirement summary

- Buyer.
- Product.
- Quantity.
- Specifications.
- Quality requirements.
- Packaging requirements.
- Labeling requirements.
- Delivery location.
- Required delivery date.
- Inspection requirements.
- Outstanding questions.

## Output 2: Capacity assessment

| Capacity item | Current position | Order requirement | Gap | Corrective action |
| --- | --- | --- | --- | --- |
| Production capacity | | | | |
| Available labor | | | | |
| Equipment | | | | |
| Raw materials | | | | |
| Storage | | | | |
| Quality control | | | | |
| Delivery capability | | | | |

## Output 3: Material and procurement plan

- Material.
- Required quantity.
- Current stock.
- Quantity to purchase.
- Supplier.
- Supplier lead time.
- Purchase date.
- Expected arrival.
- Alternative supplier.
- Procurement risk.

## Output 4: Production schedule

| Activity | Start date | End date | Responsible person | Dependency | Status |
| --- | --- | --- | --- | --- | --- |
| Confirm specifications | | | | | |
| Procure materials | | | | | |
| Prepare production | | | | | |
| Production | | | | | |
| Quality inspection | | | | | |
| Packaging | | | | | |
| Dispatch | | | | | |

## Output 5: Quality and risk plan

Quality checkpoints identify:

- What is inspected.
- When it is inspected.
- Who is responsible.
- Acceptance criteria.
- Evidence retained.
- Corrective action if the requirement is not met.

The risk register identifies:

- Risk.
- Probability.
- Impact.
- Warning indicator.
- Mitigation.
- Contingency.
- Responsible person.

## Output 6: Fulfillment and delivery plan

- Order quantity.
- Production milestones.
- Quality approval.
- Packaging completion.
- Dispatch date.
- Logistics provider.
- Delivery milestones.
- Buyer communication schedule.
- Delivery confirmation.
- Exception escalation process.

## Completion requirements

To complete M07 you must:

- Complete all six lessons.
- Pass the knowledge check at 80% or higher.
- Submit the six practical outputs.
- Score at least 24/36.
- Have no critical failure.
- Identify at least three operational improvement actions.

Where possible, your outputs link directly to the Export Transaction Workspace, so you do not re-enter the same order, product or buyer information.`,
    },
  ],
  workedExample: {
    title: "Illustrative case: Addis Workwear PLC",
    body: `Addis Workwear receives a confirmed order for 2,000 industrial uniforms.

The buyer requires:

- Approved fabric specifications.
- Consistent sizing.
- Product labeling.
- Individual packaging.
- Delivery within 60 days.

The SME currently has:

- Capacity to produce 1,200 units per month.
- Existing commitments for 600 units.
- One primary fabric supplier.
- Limited finished-goods storage.
- A quality inspection process that is not formally documented.

The SME must determine:

- Whether the remaining capacity is sufficient.
- Whether additional shifts are required.
- Whether fabric can be procured on time.
- Whether an alternative supplier is necessary.
- How quality will be checked.
- How production and packaging will be scheduled.
- Whether the delivery deadline is realistic.

The SME prepares a milestone plan and identifies the risks that could delay fulfillment.`,
  },
  worksheets: [],
  knowledgeCheck: {
    passMark: 80,
    questions: [
      question(
        "q1",
        "lesson-1",
        "Why should an SME review an order's specifications before production?",
        "To understand exactly what must be produced and delivered and identify any unresolved requirements.",
        ["To find out how much the buyer is willing to pay.", "To decide which bank to use for payment.", "To avoid having to speak to the buyer again."],
        "b",
      ),
      question(
        "q2",
        "lesson-2",
        "What is the difference between installed capacity and available capacity?",
        "Installed capacity is the maximum potential capacity under defined conditions; available capacity accounts for existing commitments and current constraints.",
        [
          "Installed capacity is what the SME produced last month; available capacity is what it plans to produce next month.",
          "Installed capacity includes only labor; available capacity includes only equipment.",
          "There is no difference; both describe the same figure.",
        ],
        "a",
      ),
      question(
        "q3",
        "lesson-2",
        "Why should existing orders be considered when accepting a new order?",
        "Existing commitments reduce the capacity available for additional production.",
        ["Existing orders increase the capacity available for new ones.", "Existing orders only matter if they are from the same buyer.", "Existing orders can be ignored because new orders are always more valuable."],
        "c",
      ),
      question(
        "q4",
        "lesson-3",
        "What is a bill of materials?",
        "A structured list of materials and quantities required to produce a product.",
        ["The invoice a supplier sends after delivery.", "A statement of the money owed to all suppliers.", "A list of the machines in the factory."],
        "d",
      ),
      question(
        "q5",
        "lesson-3",
        "Why should an SME monitor supplier lead times?",
        "Delayed materials can disrupt production and cause missed delivery deadlines.",
        ["Because suppliers lower their prices when they are given more time.", "Because lead times decide the colour of the finished product.", "Because lead times only matter after the goods have shipped."],
        "a",
      ),
      question(
        "q6",
        "lesson-4",
        "What is a production milestone?",
        "A defined stage or checkpoint used to monitor progress toward completing an order.",
        ["The total number of units the factory has ever produced.", "The date on which the buyer pays.", "A bonus paid to workers at the end of the month."],
        "b",
      ),
      question(
        "q7",
        "lesson-5",
        "Why are quality-control checkpoints important?",
        "They identify defects or non-conformity early and reduce the risk of delivering products that fail buyer requirements.",
        ["They remove the need to follow the buyer's specifications.", "They only matter for the final inspection at the port.", "They speed up production by skipping rework."],
        "d",
      ),
      question(
        "q8",
        "lesson-5",
        "What is a contingency plan?",
        "A prepared alternative action to manage a disruption or identified risk.",
        ["A record of every order the business has completed.", "A price list for the buyer.", "An agreement that the buyer will pay late."],
        "c",
      ),
      question(
        "q9",
        "lesson-6",
        "Why should packaging and labeling be included in the fulfillment plan?",
        "They are part of the buyer's requirements and can affect product protection, identification and delivery acceptance.",
        ["They are optional and the buyer can arrange them after delivery.", "They only matter for orders sold in the home market.", "They decide the SME's production capacity."],
        "a",
      ),
      question(
        "q10",
        "lesson-6",
        "What should an SME do when a production delay threatens the delivery date?",
        "Assess the impact, identify corrective options and communicate promptly with the buyer and relevant parties.",
        ["Ship the incomplete order without telling the buyer.", "Wait until the delivery date has passed before contacting the buyer.", "Cancel the order and keep the buyer's deposit."],
        "b",
      ),
    ],
  },
  rubric: {
    criteria: [
      { id: "order_requirements", title: "Understanding and documentation of order requirements", maxPoints: 6, mustHave: false },
      { id: "capacity_assessment", title: "Capacity assessment and gap identification", maxPoints: 6, mustHave: false },
      { id: "procurement_plan", title: "Material and supplier procurement plan", maxPoints: 6, mustHave: false },
      { id: "production_schedule", title: "Production schedule and resource allocation", maxPoints: 6, mustHave: false },
      { id: "quality_and_risk", title: "Quality-control and risk management plan", maxPoints: 6, mustHave: false },
      { id: "delivery_plan", title: "Fulfillment and delivery coordination plan", maxPoints: 6, mustHave: false },
    ],
    passMark: 24,
    mustHaveMinimum: 0,
    bands: STANDARD_BANDS,
    criticalFailures: [
      { id: "cf1", text: "Claiming the business can fulfill an order when the submitted capacity information clearly shows an unresolved material shortfall." },
      { id: "cf2", text: "Ignoring a known quality or specification requirement that could result in rejection." },
      { id: "cf3", text: "Fabricating capacity, supplier or quality evidence." },
      { id: "cf4", text: "Failing to identify a material production or delivery risk that is evident from the information supplied." },
    ],
  },
  aiPrompts: [],
  staff: {
    facilitatorGuide: `## Facilitator responsibilities

- Challenge unrealistic production assumptions.
- Encourage SMEs to calculate available rather than theoretical capacity.
- Review supplier dependency and procurement timing.
- Ensure quality requirements are translated into practical inspection steps.
- Help each SME identify a realistic delivery plan.

${SCORING_GUIDE}`,
    liveSessionPlan: `Duration: 180 minutes

| Time | Activity |
| --- | --- |
| 20 min | Introduction and order requirements |
| 30 min | Capacity assessment exercise |
| 25 min | Materials and procurement |
| 35 min | Production scheduling |
| 30 min | Quality and risk planning |
| 25 min | Fulfillment simulation |
| 15 min | Review and next actions |`,
    hybridSequence: `The digital version includes six lesson units, with:

- An order requirement template.
- A capacity assessment worksheet.
- A procurement planning tool.
- A production schedule.
- A quality-control checklist.
- An operational risk register.
- A fulfillment plan.
- The knowledge check.
- Practical submission and reviewer feedback.

The platform also provides a material and procurement register, milestone tracking, and document uploads.

Delivery is self-paced, instructor-led or hybrid.`,
  },
};
