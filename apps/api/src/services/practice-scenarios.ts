import type { FactInput } from "./facts";

// The scenarios a learner practises on in TRADE's M08 (#74). Each is a CLEAR case that opens with the
// facts below and runs on the same engine, rule packs, steps, gates, evidence, flags and document
// comparison as a real one.

/** What every screen shows on a practice case. */
export const PRACTICE_LABEL = "Practice. Simulated, not a real export.";

export interface PracticeScenario {
  id: string;
  title: string;
  summary: string;
  /** The facts the case opens with. A scenario that takes the learner's own deal has none until they give them. */
  facts: Record<string, FactInput>;
  /** The learner supplies the facts, from their own M01 or M04 brief. */
  ownFacts: boolean;
}

/** Ported from the CLEAR simulation's demo: the ZEBU Coffee pilot case. */
export const ZEBU_COFFEE: PracticeScenario = {
  id: "zebu-coffee",
  title: "ZEBU Coffee: green coffee to the United States",
  summary:
    "ZEBU Coffee ships Ethiopian green coffee to Artisan Coffee USA: US$60,873.43, FOB Djibouti, 10% advance and 90% cash against documents.",
  facts: { product: "green_coffee", destinationCountry: "US", transportMode: "sea", incoterm: "FOB", paymentTerms: "cad" },
  ownFacts: false,
};

/** The learner's own target deal, from the product, destination, Incoterm and payment terms in their brief. */
export const OWN_DEAL: PracticeScenario = {
  id: "own-deal",
  title: "Your own target deal",
  summary: "A practice case for the deal in your Export Opportunity Brief or your Transaction Finance and Payment-Risk Brief.",
  facts: {},
  ownFacts: true,
};

export const PRACTICE_SCENARIOS: readonly PracticeScenario[] = [ZEBU_COFFEE, OWN_DEAL];

export const findScenario = (id: string): PracticeScenario | undefined => PRACTICE_SCENARIOS.find((s) => s.id === id);
