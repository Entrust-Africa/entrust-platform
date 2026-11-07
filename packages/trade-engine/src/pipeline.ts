import {
  type PipelineStage,
  type QualificationBand,
  type VerificationLadderStatus,
} from "./statuses";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface LeadQualificationInput {
  /** Product fit and technical specifications alignment (0–5) */
  productFit: number;
  /** Purchasing power or commercial deal volume (0–5) */
  purchasingPowerOrVolume: number;
  /** Commercial payment terms and credit alignment (0–5) */
  paymentTerms: number;
  /** Direct access to the key decision-maker (0–5) */
  accessToDecisionMaker: number;
  /** Past import experience and market compliance track record (0–5) */
  importExperience: number;
  /** Procurement and deal timeline immediacy (0–5) */
  timeline: number;
}

export interface LeadQualificationResult {
  scores: LeadQualificationInput;
  total: number; // 0 to 30
  band: QualificationBand; // low (0-14), medium (15-22), high (23-30)
}

/**
 * M05 Lead Qualification Scorecard (#68).
 * Evaluates six criteria scored 0 to 5, totaling up to 30.
 * Bands:
 * - 0 to 14: low
 * - 15 to 22: medium
 * - 23 to 30: high
 */
export function evaluateQualificationScorecard(input: LeadQualificationInput): LeadQualificationResult {
  const clamp = (v: number) => Math.max(0, Math.min(5, Math.round(Number(v) || 0)));

  const scores: LeadQualificationInput = {
    productFit: clamp(input.productFit),
    purchasingPowerOrVolume: clamp(input.purchasingPowerOrVolume),
    paymentTerms: clamp(input.paymentTerms),
    accessToDecisionMaker: clamp(input.accessToDecisionMaker),
    importExperience: clamp(input.importExperience),
    timeline: clamp(input.timeline),
  };

  const total =
    scores.productFit +
    scores.purchasingPowerOrVolume +
    scores.paymentTerms +
    scores.accessToDecisionMaker +
    scores.importExperience +
    scores.timeline;

  let band: QualificationBand = "low";
  if (total >= 23) {
    band = "high";
  } else if (total >= 15) {
    band = "medium";
  }

  return { scores, total, band };
}

export interface MarketCriteriaScores {
  marketSizeAndGrowth: number; // 1 to 5
  tariffAndTradePreference: number; // 1 to 5
  logisticsAndFreight: number; // 1 to 5
  regulatoryAndStandards: number; // 1 to 5
  paymentAndCurrencyRisk: number; // 1 to 5
  buyerDemandAndConcentration: number; // 1 to 5
  priceRealizationMargin: number; // 1 to 5
  easeOfDoingBusiness: number; // 1 to 5
  culturalAndLanguageFit: number; // 1 to 5
  competitiveIntensity: number; // 1 to 5
}

export interface CandidateMarketInput {
  country: string;
  scores: MarketCriteriaScores;
}

export interface MarketScorecardResult {
  country: string;
  scores: MarketCriteriaScores;
  weightedScore: number; // 1.0 to 5.0
  rank: number;
}

const MARKET_WEIGHTS: Record<keyof MarketCriteriaScores, number> = {
  marketSizeAndGrowth: 0.15,
  tariffAndTradePreference: 0.15,
  logisticsAndFreight: 0.1,
  regulatoryAndStandards: 0.1,
  paymentAndCurrencyRisk: 0.1,
  buyerDemandAndConcentration: 0.1,
  priceRealizationMargin: 0.1,
  easeOfDoingBusiness: 0.1,
  culturalAndLanguageFit: 0.05,
  competitiveIntensity: 0.05,
};

/**
 * M05 Market Selection Scorecard (#68).
 * Ten criteria scored 1 to 5 with weights, to compare candidate markets.
 */
export function evaluateMarketSelectionScorecard(markets: readonly CandidateMarketInput[]): MarketScorecardResult[] {
  const clamp = (v: number) => Math.max(1, Math.min(5, Math.round(Number(v) || 1)));

  const results = markets.map((m) => {
    let weightedSum = 0;
    const scores = {} as MarketCriteriaScores;

    for (const key of Object.keys(MARKET_WEIGHTS) as (keyof MarketCriteriaScores)[]) {
      const val = clamp(m.scores[key]);
      scores[key] = val;
      weightedSum += val * MARKET_WEIGHTS[key];
    }

    return {
      country: m.country,
      scores,
      weightedScore: Math.round(weightedSum * 100) / 100,
      rank: 1,
    };
  });

  // Sort descending by weighted score and assign ranks
  results.sort((a, b) => b.weightedScore - a.weightedScore);
  results.forEach((r, idx) => {
    r.rank = idx + 1;
  });

  return results;
}

export interface OpportunityJourneyInput {
  id: string;
  stage: PipelineStage;
  verificationStatus: VerificationLadderStatus;
  isClosedOrLost?: boolean;
}

export interface ExportJourneyStageResult {
  stageNumber: number; // 1 to 10
  title: string;
  description: string;
  furthestOpportunityId: string | null;
}

export const EXPORT_JOURNEY_STAGES: readonly { stageNumber: number; title: string; description: string }[] = [
  { stageNumber: 1, title: "Export Idea & Capability", description: "Product readiness and baseline diagnostic completed." },
  { stageNumber: 2, title: "Target Market Selected", description: "Target market identified and compliance requirements mapped." },
  { stageNumber: 3, title: "Buyer Leads & Outreach", description: "Buyer leads discovered, verified, and outreach initiated." },
  { stageNumber: 4, title: "Inquiry & Quotation", description: "Needs assessed, commercial fit confirmed, and quotation submitted." },
  { stageNumber: 5, title: "Sample Evaluation", description: "Commercial product samples dispatched and in evaluation." },
  { stageNumber: 6, title: "Sample Approved", description: "Buyer approved product samples and specifications." },
  { stageNumber: 7, title: "Contract & Firm Order", description: "Commercial contract negotiated and firm export order secured." },
  { stageNumber: 8, title: "Production & Shipment", description: "Fulfilment executed and cargo dispatched." },
  { stageNumber: 9, title: "Delivery Confirmed", description: "Cargo delivered to overseas destination." },
  { stageNumber: 10, title: "Payment Received & Scale", description: "Export proceeds received and ongoing re-orders secured." },
];

/**
 * Maps an SME's live pipeline opportunities and outcomes to its stage on the 10-stage export journey (#68).
 *
 * Mapping rules:
 * - Default: Stage 2 (assuming diagnostic / market readiness in program)
 * - Journey Stage 3: Covers pipeline stages 1 to 4 (lead_discovered to lead_verified)
 * - Journey Stage 4: Covers pipeline stages 5 to 8 (needs_assessed to quote_submitted)
 * - Pipeline Stage 9: samples_requested bridges stage 4 and 5
 * - Journey Stage 5: Covers pipeline stage 10 (samples_dispatched)
 * - Journey Stage 6: Covers pipeline stage 11 (sample_approved)
 * - Journey Stage 7: Covers pipeline stages 12 (contract_negotiated) and 13 (firm_order_secured)
 * - Outcomes (#69) map to Stages 8-10.
 */
export function mapExportJourneyStage(
  opportunities: readonly OpportunityJourneyInput[],
  outcomes?: { hasShipmentUnderway?: boolean; hasDelivered?: boolean; hasPaymentReceived?: boolean },
): ExportJourneyStageResult {
  if (outcomes?.hasPaymentReceived) {
    const s = EXPORT_JOURNEY_STAGES[9]!;
    return { stageNumber: s.stageNumber, title: s.title, description: s.description, furthestOpportunityId: null };
  }
  if (outcomes?.hasDelivered) {
    const s = EXPORT_JOURNEY_STAGES[8]!;
    return { stageNumber: s.stageNumber, title: s.title, description: s.description, furthestOpportunityId: null };
  }
  if (outcomes?.hasShipmentUnderway) {
    const s = EXPORT_JOURNEY_STAGES[7]!;
    return { stageNumber: s.stageNumber, title: s.title, description: s.description, furthestOpportunityId: null };
  }

  // Active opportunities (excluding closed_lost and disqualified)
  const activeOpps = (opportunities || []).filter(
    (o) => !o.isClosedOrLost && o.stage !== "closed_lost" && o.stage !== "disqualified",
  );

  let highestStage = 2;
  let furthestId: string | null = null;

  for (const opp of activeOpps) {
    let oppJourneyStage = 2;

    switch (opp.stage) {
      case "lead_discovered":
      case "contact_established":
      case "initial_pitch_made":
      case "lead_verified":
        oppJourneyStage = 3;
        break;
      case "needs_assessed":
      case "commercial_fit_confirmed":
      case "rfq_received":
      case "quote_submitted":
      case "samples_requested":
        oppJourneyStage = 4;
        break;
      case "samples_dispatched":
        oppJourneyStage = 5;
        break;
      case "sample_approved":
        oppJourneyStage = 6;
        break;
      case "contract_negotiated":
      case "firm_order_secured":
        oppJourneyStage = 7;
        break;
    }

    if (oppJourneyStage > highestStage) {
      highestStage = oppJourneyStage;
      furthestId = opp.id;
    }
  }

  const stageMeta = EXPORT_JOURNEY_STAGES.find((s) => s.stageNumber === highestStage) || EXPORT_JOURNEY_STAGES[1]!;

  return {
    stageNumber: stageMeta.stageNumber,
    title: stageMeta.title,
    description: stageMeta.description,
    furthestOpportunityId: furthestId,
  };
}

/**
 * M05 activity follow-up cadence (Day 1, 4, 8, 14) (#68).
 */
export function calculateFollowUpCadence(baseDateIso: string): {
  day1: string;
  day4: string;
  day8: string;
  day14: string;
} {
  const baseTime = new Date(baseDateIso).getTime();
  const format = (days: number) => new Date(baseTime + days * DAY_MS).toISOString().slice(0, 10);

  return {
    day1: format(1),
    day4: format(4),
    day8: format(8),
    day14: format(14),
  };
}

/**
 * Validates M05 deliverable requirement:
 * The pipeline must contain at least five verified leads (#68).
 */
export function validateM05Deliverable(opportunities: readonly { verificationStatus: VerificationLadderStatus }[]): {
  isEligible: boolean;
  verifiedCount: number;
  missingCount: number;
} {
  const verifiedCount = (opportunities || []).filter((o) => o.verificationStatus !== "unverified").length;
  const isEligible = verifiedCount >= 5;
  const missingCount = Math.max(0, 5 - verifiedCount);

  return {
    isEligible,
    verifiedCount,
    missingCount,
  };
}
