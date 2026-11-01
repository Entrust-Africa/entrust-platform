import type { FactInput } from "./facts";

// The scenarios a learner practises on in TRADE's M08 (#74). Each is a CLEAR case that opens with the
// facts below and runs on the same engine, rule packs, steps, gates, evidence, flags and document
// comparison as a real one.

/** What every screen shows on a practice case. */
export const PRACTICE_LABEL = "Practice. Simulated, not a real export.";

/** What a scripted event does to the case when the learner plays it. */
export type PracticeEffect =
  /** Enters what documents say, as the SME would, by document id and field. */
  | { kind: "document_fields"; documents: Readonly<Record<string, Readonly<Record<string, string>>>> }
  /** Moves the planned loading time later. The learner records the first one themselves. */
  | { kind: "delay_loading"; days: number };

/** Something that happens to the shipment, which the learner plays when the story reaches it and then has to handle. */
export interface PracticeEvent {
  id: string;
  title: string;
  /** What the learner is told has happened. */
  story: string;
  effects: readonly PracticeEffect[];
}

export interface PracticeScenario {
  id: string;
  title: string;
  summary: string;
  /** The facts the case opens with. A scenario that takes the learner's own deal has none until they give them. */
  facts: Record<string, FactInput>;
  /** The learner supplies the facts, from their own M01 or M04 brief. */
  ownFacts: boolean;
  events: readonly PracticeEvent[];
}

const ZEBU_EXPORTER = "ZEBU Coffee, Addis Ababa, Ethiopia";
const ZEBU_BUYER = "Artisan Coffee USA";
const ZEBU_GOODS = {
  goodsDescription: "Green coffee, Grade 1, washed",
  hsCode: "0901.11",
  quantity: "19200 kg",
  netWeight: "19200 kg",
  packages: "320",
};

/**
 * Ported from the CLEAR simulation's demo: the ZEBU Coffee pilot case. The pilot record has no quantity,
 * packaging or weights, so those are invented for the exercise: 320 bags of 60 kg, which makes 19,200 kg
 * net and 19,584 kg gross with the bags. Every number here is simulated.
 */
export const ZEBU_COFFEE: PracticeScenario = {
  id: "zebu-coffee",
  title: "ZEBU Coffee: green coffee to the United States",
  summary:
    "ZEBU Coffee ships Ethiopian green coffee to Artisan Coffee USA: US$60,873.43, FOB Djibouti, 10% advance and 90% cash against documents.",
  facts: { product: "green_coffee", destinationCountry: "US", transportMode: "sea", incoterm: "FOB", paymentTerms: "cad" },
  ownFacts: false,
  events: [
    {
      id: "documents-arrive",
      title: "The shipping documents arrive",
      story:
        "The carrier's bill of lading, the packing list, the commercial invoice and the bank export permit are in. Check them against each other before anything goes to the bank.",
      effects: [
        {
          kind: "document_fields",
          documents: {
            final_commercial_invoice: {
              exporter: ZEBU_EXPORTER,
              consignee: ZEBU_BUYER,
              buyer: ZEBU_BUYER,
              ...ZEBU_GOODS,
              grossWeight: "19584 kg",
              portOfLoading: "Djibouti",
              incotermPlace: "FOB Djibouti",
              totalValue: "60873.43",
              currency: "USD",
              countryOfOrigin: "Ethiopia",
              invoiceReference: "INV-0089",
            },
            // The 12 kg that don't agree with the bill of lading, as in the simulation's completed example.
            final_packing_list: {
              exporter: ZEBU_EXPORTER,
              consignee: ZEBU_BUYER,
              buyer: ZEBU_BUYER,
              ...ZEBU_GOODS,
              grossWeight: "19596 kg",
              portOfLoading: "Djibouti",
              countryOfOrigin: "Ethiopia",
              invoiceReference: "INV-0089",
            },
            transport_document: {
              exporter: ZEBU_EXPORTER,
              consignee: "To the order of Commercial Bank of Ethiopia",
              notifyParty: ZEBU_BUYER,
              ...ZEBU_GOODS,
              grossWeight: "19584 kg",
              portOfLoading: "Djibouti",
              incotermPlace: "FOB Djibouti",
            },
            bank_export_permit: { totalValue: "60873.43", currency: "USD" },
          },
        },
      ],
    },
    {
      id: "shipment-delay",
      title: "The vessel is delayed",
      story:
        "The shipping line moves the loading back five days. The deadlines that count from loading move with it, so check what is due and when. Record a planned loading time before you play this.",
      effects: [{ kind: "delay_loading", days: 5 }],
    },
  ],
};

/** The learner's own target deal, from the product, destination, Incoterm and payment terms in their brief. */
export const OWN_DEAL: PracticeScenario = {
  id: "own-deal",
  title: "Your own target deal",
  summary: "A practice case for the deal in your Export Opportunity Brief or your Transaction Finance and Payment-Risk Brief.",
  facts: {},
  ownFacts: true,
  events: [],
};

export const PRACTICE_SCENARIOS: readonly PracticeScenario[] = [ZEBU_COFFEE, OWN_DEAL];

export const findScenario = (id: string): PracticeScenario | undefined => PRACTICE_SCENARIOS.find((s) => s.id === id);
