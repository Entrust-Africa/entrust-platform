import type { ModuleContent } from "../schema";
import { SCORING_GUIDE, STANDARD_BANDS, question } from "./helpers";

// Entrust's M01 package, version 1.0, as supplied on 9 Nov 2026. The lessons, worked example, outputs,
// assessment and facilitator guide follow its text. Entrust gave the knowledge check as questions and
// right answers only, so the wrong options are the platform team's (see helpers.ts). The module's
// worksheets stay the ones the trade engine defines; this package carries the outputs as lesson text.
export const M01_V1_0_0: ModuleContent = {
  module: "M01",
  version: "1.0.0",
  title: "Diagnostic and Deal Selection",
  deliverable: "SME business baseline, prioritized gap register and documented commercial opportunity decision",
  objectives: [
    "Describe the current business position using available evidence.",
    "Identify the principal operational, financial and commercial constraints.",
    "Distinguish a market opportunity from a qualified commercial opportunity.",
    "Assess potential deals against buyer credibility, product fit, capacity, costs and payment conditions.",
    "Identify information gaps requiring further verification.",
    "Select a priority opportunity, or determine that further preparation is required.",
    "Develop a short list of practical actions.",
  ],
  status: "draft",
  lessons: [
    {
      id: "introduction",
      title: "Purpose and entry requirements",
      body: `## Module purpose

M01 establishes the SME's starting position and helps the business identify which commercial opportunity it should pursue.

Many SMEs pursue export opportunities without first establishing whether the product, buyer, order size, price, production capacity and payment conditions make commercial sense. Others spend time preparing for markets without having a specific buyer or realistic route to market.

This module introduces a structured way to assess the business, identify capability gaps and select a realistic commercial opportunity.

The diagnostic is not intended to certify that a business is export-ready. It establishes a baseline for the SME's development and transaction decisions.

## Entry requirements

You should have:

- A registered or identifiable business profile.
- A clear description of your products or services.
- Basic information about customers and sales.
- Available financial and operational information.
- Details of any known buyers or current opportunities.

Where information is unavailable, record the gap rather than invent an answer.`,
    },
    {
      id: "lesson-1",
      title: "Understanding the SME's current position",
      body: `## Topics

- Business model and revenue sources.
- Products and services.
- Customer segments.
- Sales channels.
- Business ownership and management.
- Operating history.
- Current business priorities.

## Practical activity

Prepare a one-page business overview.`,
    },
    {
      id: "lesson-2",
      title: "Identifying business capability gaps",
      body: `## Topics

- Financial records and cash flow.
- Production or service capacity.
- Quality management.
- Management and staffing.
- Digital systems and records.
- Working capital.
- Insurance and operational risks.
- Export documentation and compliance experience.

Distinguish between a capability that exists, one that exists but lacks evidence, and one that does not yet exist.

## Practical activity

Complete a business gap register.`,
    },
    {
      id: "lesson-3",
      title: "Understanding commercial opportunities",
      body: `## Topics

- Difference between market interest and actual buyer demand.
- Product-market fit.
- Buyer requirements.
- Order size and frequency.
- Delivery expectations.
- Pricing and competitiveness.
- Market access and distribution.
- Commercial opportunity versus speculative enquiry.

## Practical activity

Describe up to three potential opportunities and identify the evidence supporting each.`,
    },
    {
      id: "lesson-4",
      title: "Qualifying a buyer and an opportunity",
      body: `## Topics

- Buyer identity and business existence.
- Buyer website and contact information.
- Business activity and market presence.
- Product requirements.
- Order quantity and delivery expectations.
- Payment terms.
- Buyer references and transaction history, where available.
- Red flags and unresolved questions.

A buyer should not be classified as verified solely because a website or email address exists.

## Practical activity

Complete a buyer qualification checklist.`,
    },
    {
      id: "lesson-5",
      title: "Selecting the right deal",
      body: `Evaluate an opportunity against six dimensions:

1. Buyer credibility and evidence.
2. Product and specification fit.
3. Commercial value and expected margin.
4. Production and fulfillment capacity.
5. Payment and financing conditions.
6. Export requirements and delivery feasibility.

Identify whether the opportunity is commercially attractive, operationally achievable and sufficiently supported by evidence.

## Practical activity

Compare two opportunities and select one for further development.`,
    },
    {
      id: "lesson-6",
      title: "Making the commercial decision",
      body: `There are four possible decisions:

- **Proceed:** available evidence supports moving to the next transaction stage.
- **Hold:** important information is missing or a major condition remains unresolved.
- **Renegotiate:** the opportunity may be viable if price, quantity, payment, delivery or other terms change.
- **No-go:** the risks or commercial conditions make the opportunity unsuitable.

The decision must be documented with reasons and next actions.`,
    },
    {
      id: "practical-exercise",
      title: "Practical exercise: SME Diagnostic and Deal Selection",
      body: `You complete five outputs.

## Output 1: Business baseline

- Business overview.
- Products and services.
- Customer segments.
- Sales channels.
- Operating history.
- Current priorities.

## Output 2: Capability gap register

| Area | Current position | Evidence available | Gap | Priority |
| --- | --- | --- | --- | --- |
| Financial records | | | | |
| Production capacity | | | | |
| Quality management | | | | |
| Working capital | | | | |
| Digital systems | | | | |
| Export requirements | | | | |
| Risk protection | | | | |

## Output 3: Opportunity register

For each opportunity:

- Buyer.
- Country.
- Product.
- Estimated quantity.
- Estimated value.
- Buyer requirements.
- Delivery expectations.
- Payment terms.
- Evidence available.
- Outstanding questions.

## Output 4: Deal qualification scorecard

Score each of the six dimensions from 1 to 5:

1. Buyer credibility.
2. Product fit.
3. Commercial viability.
4. Fulfillment capacity.
5. Payment and finance feasibility.
6. Export and delivery feasibility.

The score is a prioritization aid, not an automatic approval. A low score or unresolved critical issue should trigger further review regardless of the total.

## Output 5: Deal decision record

- Selected opportunity.
- Decision: proceed, hold, renegotiate or no-go.
- Supporting evidence.
- Outstanding risks.
- Required action.
- Responsible person.
- Target date.

## Completion requirements

To complete M01 you must:

- Complete the module lessons.
- Pass the knowledge check at 80% or higher.
- Submit all five practical outputs.
- Score at least 24/36.
- Have no critical failure.
- Record at least one priority commercial action.

The platform keeps your diagnostic responses, evidence references, gap register, opportunity register, scorecard, decision record, knowledge check attempts, practical scores, reviewer comments, and the module version and completion date.`,
    },
  ],
  workedExample: {
    title: "Illustrative case: Addis Workwear PLC",
    body: `Addis Workwear produces uniforms and industrial workwear. It receives two enquiries.

**Opportunity A**

- A distributor requests 5,000 uniforms.
- The buyer has supplied a company profile and product specifications.
- The proposed delivery period is 45 days.
- The SME has capacity for approximately 3,000 units within the requested period.
- The buyer requests 60-day payment terms.
- The SME has limited working capital.

**Opportunity B**

- A regional distributor requests 1,500 uniforms.
- Product specifications are clear.
- The buyer is willing to discuss a deposit and balance before dispatch.
- The SME has sufficient production capacity.
- Delivery requirements appear manageable, subject to logistics confirmation.

The SME should not automatically select Opportunity A because the order is larger.

Opportunity B may be more suitable because the quantity, production capacity and proposed payment structure are more manageable. However, buyer identity, final pricing, delivery responsibilities and other conditions still require verification.

The learner must record a decision and explain the evidence behind it.`,
  },
  worksheets: [],
  knowledgeCheck: {
    passMark: 80,
    questions: [
      question(
        "q1",
        "introduction",
        "What is the primary purpose of an SME diagnostic?",
        "To establish the business's current position, evidence and capability gaps.",
        ["To certify that the business is ready to export.", "To guarantee that the business will win export orders.", "To rank the business against its competitors."],
        "b",
      ),
      question(
        "q2",
        "lesson-3",
        "Does a buyer enquiry automatically represent a qualified commercial opportunity?",
        "No. Buyer identity, demand, specifications, payment and fulfillment conditions require assessment.",
        ["Yes, because the buyer has shown interest in the product.", "Yes, once the buyer has sent an email from a company address.", "Yes, if the enquiry is for a large quantity."],
        "c",
      ),
      question(
        "q3",
        "introduction",
        "What should an SME do when it does not have reliable information for a diagnostic question?",
        "Record the information as unavailable and identify how it can be obtained.",
        ["Estimate a figure that looks reasonable.", "Leave the question out of the diagnostic.", "Copy the answer from a similar business."],
        "a",
      ),
      question(
        "q4",
        "lesson-2",
        "Why should production capacity be reviewed before accepting an order?",
        "To establish whether the business can fulfill the required quantity and delivery schedule.",
        ["To decide the colour and design of the product.", "To set the price the buyer will pay.", "To choose which bank will finance the order."],
        "d",
      ),
      question(
        "q5",
        "lesson-5",
        "Is the largest order always the best commercial opportunity?",
        "No. Commercial viability, capacity, margin, payment and risk must also be considered.",
        ["Yes, because a larger order gives the most revenue.", "Yes, because a larger order lowers the cost of every unit.", "Yes, as long as the buyer accepts the specification."],
        "b",
      ),
      question(
        "q6",
        "lesson-3",
        "What is the difference between a market opportunity and a qualified buyer opportunity?",
        "A market opportunity indicates potential demand; a qualified buyer opportunity has supporting evidence of a specific buyer's interest and requirements.",
        [
          "A market opportunity is for a single buyer; a qualified buyer opportunity covers a whole country.",
          "There is no difference; both describe a confirmed order.",
          "A market opportunity has a signed contract; a qualified buyer opportunity does not.",
        ],
        "a",
      ),
      question(
        "q7",
        "lesson-6",
        "When should an SME select the hold decision?",
        "When important information or conditions remain unresolved.",
        ["When the buyer is offering a low price.", "When the order is smaller than the SME hoped.", "When the SME wants to accept the order without checking further."],
        "c",
      ),
      question(
        "q8",
        "lesson-6",
        "When is renegotiation appropriate?",
        "When an opportunity may become viable through changes to price, quantity, payment or delivery terms.",
        ["When the buyer cannot be identified at all.", "When the SME has already shipped the goods.", "Only when the buyer has refused the order."],
        "d",
      ),
      question(
        "q9",
        "lesson-5",
        "Does a high deal qualification score eliminate the need to verify critical information?",
        "No. Critical conditions must still be checked.",
        ["Yes, a high score means the opportunity is approved.", "Yes, if the score is above 4 on every dimension.", "Yes, because the score already includes verification."],
        "b",
      ),
      question(
        "q10",
        "lesson-6",
        "What should a deal decision record contain?",
        "The decision, supporting evidence, outstanding risks, required actions, responsible person and target date.",
        [
          "Only the decision and the buyer's name.",
          "The buyer's website address and the SME's bank balance.",
          "The deal score and a note that the decision is final.",
        ],
        "a",
      ),
    ],
  },
  rubric: {
    criteria: [
      { id: "business_baseline", title: "Completeness and accuracy of business baseline", maxPoints: 6, mustHave: false },
      { id: "capability_gaps", title: "Identification and prioritization of capability gaps", maxPoints: 6, mustHave: false },
      { id: "opportunity_evidence", title: "Quality of opportunity identification and evidence", maxPoints: 6, mustHave: false },
      { id: "buyer_and_deal_qualification", title: "Buyer and deal qualification", maxPoints: 6, mustHave: false },
      { id: "decision_and_reasoning", title: "Commercial decision and supporting reasoning", maxPoints: 6, mustHave: false },
      { id: "action_plan_and_ownership", title: "Action plan and ownership", maxPoints: 6, mustHave: false },
    ],
    passMark: 24,
    mustHaveMinimum: 0,
    bands: STANDARD_BANDS,
    criticalFailures: [
      { id: "cf1", text: "Fabricating buyer, financial or operational evidence." },
      { id: "cf2", text: "Recommending acceptance of a transaction despite a known unresolved critical risk without documenting it." },
      { id: "cf3", text: "Presenting unverified information as independently verified." },
      { id: "cf4", text: "Failing to identify a material capacity or payment constraint that is evident from the submitted information." },
    ],
  },
  aiPrompts: [],
  staff: {
    facilitatorGuide: `## Facilitator responsibilities

- Challenge unsupported assumptions.
- Help SMEs distinguish between an enquiry and a qualified opportunity.
- Ask for evidence behind important claims.
- Avoid making export-readiness guarantees.
- Ensure each SME leaves with a documented commercial decision or a clear reason to hold.

${SCORING_GUIDE}`,
    liveSessionPlan: `Duration: 150 minutes

| Time | Activity |
| --- | --- |
| 10 min | Introduction and objectives |
| 20 min | Business baseline exercise |
| 25 min | Capability gap assessment |
| 30 min | Opportunity qualification |
| 25 min | Worked case and group discussion |
| 25 min | Deal selection exercise |
| 15 min | Review and next actions |`,
    hybridSequence: `The digital version includes six short lesson units, with:

- A downloadable business baseline template.
- An interactive capability gap register.
- An opportunity register.
- A buyer qualification checklist.
- A deal selection scorecard.
- The knowledge check.
- Practical submission and reviewer feedback.

Delivery is self-paced, instructor-led or hybrid.`,
  },
};
