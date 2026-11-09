// M05's guided practice on AfriConnect: how to go from a product to a credible buyer. It mirrors the real flow, Market Intelligence
// for choosing a market and the Marketplace for finding businesses, using made-up markets and companies. Learners can repeat it
// freely. It isn't assessed, and nothing in it is real trade data.

export interface SimulationOption {
  id: string;
  text: string;
  /** Why this choice is right or wrong, shown once it's picked. */
  feedback: string;
  correct: boolean;
}

export interface SimulationTable {
  head: readonly string[];
  rows: readonly (readonly string[])[];
}

interface StepBase {
  id: string;
  title: string;
  /** Where this is on the real AfriConnect. */
  where: string;
  body: string;
  table?: SimulationTable;
}

export interface ChoiceStep extends StepBase {
  kind: "choice";
  question: string;
  options: readonly SimulationOption[];
}

export interface MultiStep extends StepBase {
  kind: "multi";
  question: string;
  options: readonly SimulationOption[];
}

export interface ClassifyStep extends StepBase {
  kind: "classify";
  question: string;
  classes: readonly { id: string; label: string }[];
  records: readonly { id: string; name: string; facts: readonly string[]; answer: string; feedback: string }[];
}

export type SimulationStep = ChoiceStep | MultiStep | ClassifyStep;

export const BUYER_SIMULATION: readonly SimulationStep[] = [
  {
    id: "corridor",
    kind: "choice",
    title: "Choose a trade corridor",
    where: "AfriConnect: Market Intelligence",
    body: "Addis Workwear PLC, a fictional Ethiopian manufacturer, wants new buyers for its work suits. Market Intelligence starts with a corridor: the exporter, a destination and an HS6 product. You pick the exporter, Ethiopia, then search for your product.",
    question: "Your search shows three products. Which do you analyse?",
    options: [
      { id: "suits", text: "Work suits, poly-cotton", correct: true, feedback: "Right. Analyse what you actually make. In real use, confirm the HS6 code, because a near-match gives you another product's market." },
      { id: "tshirts", text: "Cotton T-shirts", correct: false, feedback: "That market may be bigger, but Addis Workwear doesn't make T-shirts. Start from your own product." },
      { id: "boots", text: "Leather safety boots", correct: false, feedback: "A related buyer may need them, but it isn't your product, so its figures tell you nothing about your opportunity." },
    ],
  },
  {
    id: "market",
    kind: "choice",
    title: "Compare destination markets",
    where: "AfriConnect: Market Intelligence, destination ranking",
    body: "AfriConnect can rank AfCFTA destinations for a product. These figures are invented for this exercise, and the markets are made up.",
    table: {
      head: ["Market", "Imports from AfCFTA origins", "Growth a year", "Policy evidence", "Logistics score"],
      rows: [
        ["Market A", "USD 48 million", "1%", "Import licensing recorded", "2.4 / 5"],
        ["Market B", "USD 16 million", "9%", "No measure recorded", "3.4 / 5"],
        ["Market C", "USD 2 million", "14%", "No measure recorded", "3.1 / 5"],
        ["Market D, next door", "USD 0.3 million", "0%", "No measure recorded", "2.9 / 5"],
      ],
    },
    question: "Which market do you research first?",
    options: [
      { id: "a", text: "Market A: it's the largest", correct: false, feedback: "Size alone isn't a reason. Growth is flat, a licensing measure needs checking and logistics score lowest. M05 warns against choosing a market simply because it's large." },
      { id: "b", text: "Market B: solid demand, growing, no measure recorded", correct: true, feedback: "The most defensible start: real demand that's growing, with no recorded barrier. \"No measure recorded\" still isn't the same as no requirements, so you'd verify." },
      { id: "c", text: "Market C: it's growing fastest", correct: false, feedback: "Growth on a very small base can mean few buyers. It may be worth watching, but it's a weaker first choice than B." },
      { id: "d", text: "Market D: it's closest", correct: false, feedback: "Being close doesn't create demand, and there's almost none here. M05 warns against choosing a market simply because it's close." },
    ],
  },
  {
    id: "limits",
    kind: "multi",
    title: "Know what the analysis doesn't tell you",
    where: "AfriConnect: Market Intelligence, analysis",
    body: "You open the analysis for Ethiopia, Market B and work suits. It shows recorded trade, demand and policy evidence. Market intelligence supports a decision. It doesn't make one.",
    question: "Which of these can you fairly say from it? Choose all that apply.",
    options: [
      { id: "demand", text: "Market B imports this product from AfCFTA origins", correct: true, feedback: "Yes. That's what recorded trade shows." },
      { id: "worth", text: "Market B is worth researching further", correct: true, feedback: "Yes. It's a reason to look for buyers, and no more than that." },
      { id: "buyer", text: "A buyer in Market B will purchase from Addis Workwear", correct: false, feedback: "No. Trade data shows a market, not a buyer or an order." },
      { id: "legal", text: "No permit or certification is needed for Market B", correct: false, feedback: "No. It isn't legal advice. Verify requirements with the relevant authorities." },
      { id: "price", text: "Addis Workwear's price will be competitive", correct: false, feedback: "No. You'd need your own costing and the buyer's requirements. That's M06." },
    ],
  },
  {
    id: "qualify",
    kind: "classify",
    title: "Find businesses and qualify them",
    where: "AfriConnect: Marketplace, businesses and sourcing requests",
    body: "The Marketplace is where you find named businesses and buyers' sourcing requests. These three are made up. Being listed doesn't prove a business is active, financially capable or legitimate, so you check each one.",
    question: "Classify each one, using M05's qualification decision.",
    classes: [
      { id: "qualified", label: "Qualified" },
      { id: "conditional", label: "Conditionally qualified" },
      { id: "not", label: "Not qualified" },
    ],
    records: [
      {
        id: "lakeside",
        name: "Lakeside Safety Supplies",
        facts: ["Posted a sourcing request for 500 work jackets, with fabric and sizes", "Registration record and website match", "The buyer named is its purchasing manager"],
        answer: "qualified",
        feedback: "Identity, relevance, authority and a specific requirement are all there, which justifies commercial engagement. You'd still check payment before committing.",
      },
      {
        id: "riftvalley",
        name: "Rift Valley Uniform Distributors",
        facts: ["Listed as a uniform distributor, with a registration record", "No current sourcing request", "The contact's role and authority aren't known"],
        answer: "conditional",
        feedback: "Potentially suitable, but the requirement and the contact's authority are still outstanding. Ask before you invest more time.",
      },
      {
        id: "eastland",
        name: "Eastland Industrial Supply",
        facts: ["Messages come from a free webmail address", "The company name and city differ between sources", "Says it has a \"confirmed order\" and wants your best price this week", "Won't share registration details"],
        answer: "not",
        feedback: "Several warning signs and a refusal to give basic information. One sign doesn't prove fraud, but material concerns remain unresolved, so don't engage commercially until they're cleared.",
      },
    ],
  },
  {
    id: "next",
    kind: "choice",
    title: "Decide the next step",
    where: "TRADE: your M05 worksheets",
    body: "Lakeside is qualified. What you've found goes into your Buyer Research Sheet, with the source and date, and Lakeside goes into your pipeline as Qualified.",
    question: "What do you do next with Lakeside?",
    options: [
      { id: "intro", text: "Send an introduction about its request, and ask to discuss specifications, quantities and quality", correct: true, feedback: "Right. It's relevant to this buyer and asks for a specific next step." },
      { id: "order", text: "Record Lakeside as a confirmed order", correct: false, feedback: "A sourcing request isn't an order. Presenting an unverified prospect as a confirmed order is one of M05's critical failures." },
      { id: "quote", text: "Send a firm quotation straight away", correct: false, feedback: "Too early. A quotation shouldn't be a firm offer while material information is missing." },
      { id: "produce", text: "Start buying fabric so you're ready", correct: false, feedback: "No commitments before there's a confirmed order you've checked you can fulfil." },
    ],
  },
];

/** The answer to each step: an option ID, a list of them, or a class for each record. */
export type SimulationAnswer = string | readonly string[] | Readonly<Record<string, string>>;

export function isStepCorrect(step: SimulationStep, answer: SimulationAnswer | undefined): boolean {
  if (answer === undefined) return false;
  if (step.kind === "choice") return step.options.some((o) => o.id === answer && o.correct);
  if (step.kind === "multi") {
    if (!Array.isArray(answer)) return false;
    const right = step.options.filter((o) => o.correct).map((o) => o.id);
    return right.length === answer.length && right.every((id) => answer.includes(id));
  }
  if (typeof answer !== "object" || Array.isArray(answer)) return false;
  const classes = answer as Readonly<Record<string, string>>;
  return step.records.every((r) => classes[r.id] === r.answer);
}

export function simulationScore(answers: Readonly<Record<string, SimulationAnswer>>): { correct: number; total: number } {
  return { correct: BUYER_SIMULATION.filter((s) => isStepCorrect(s, answers[s.id])).length, total: BUYER_SIMULATION.length };
}
