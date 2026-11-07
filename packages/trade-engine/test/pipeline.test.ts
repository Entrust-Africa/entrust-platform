import { describe, expect, it } from "vitest";
import {
  calculateFollowUpCadence,
  evaluateMarketSelectionScorecard,
  evaluateQualificationScorecard,
  mapExportJourneyStage,
  validateM05Deliverable,
} from "../src";

describe("M05 Buyer Pipeline & Export Journey Stage (#68)", () => {
  describe("Lead Qualification Scorecard", () => {
    it("computes total score and assigns correct bands (low, medium, high)", () => {
      // Low band: total <= 14
      const lowResult = evaluateQualificationScorecard({
        productFit: 2,
        purchasingPowerOrVolume: 2,
        paymentTerms: 2,
        accessToDecisionMaker: 1,
        importExperience: 2,
        timeline: 2,
      });
      expect(lowResult.total).toBe(11);
      expect(lowResult.band).toBe("low");

      // Medium band: 15 <= total <= 22
      const medResult = evaluateQualificationScorecard({
        productFit: 4,
        purchasingPowerOrVolume: 3,
        paymentTerms: 3,
        accessToDecisionMaker: 3,
        importExperience: 3,
        timeline: 3,
      });
      expect(medResult.total).toBe(19);
      expect(medResult.band).toBe("medium");

      // High band: total >= 23
      const highResult = evaluateQualificationScorecard({
        productFit: 5,
        purchasingPowerOrVolume: 4,
        paymentTerms: 5,
        accessToDecisionMaker: 4,
        importExperience: 4,
        timeline: 4,
      });
      expect(highResult.total).toBe(26);
      expect(highResult.band).toBe("high");
    });

    it("clamps criterion inputs between 0 and 5", () => {
      const clamped = evaluateQualificationScorecard({
        productFit: 10, // should clamp to 5
        purchasingPowerOrVolume: -3, // should clamp to 0
        paymentTerms: 5,
        accessToDecisionMaker: 5,
        importExperience: 5,
        timeline: 5,
      });
      expect(clamped.scores.productFit).toBe(5);
      expect(clamped.scores.purchasingPowerOrVolume).toBe(0);
      expect(clamped.total).toBe(25);
      expect(clamped.band).toBe("high");
    });
  });

  describe("Market Selection Scorecard", () => {
    it("calculates weighted scores across 10 criteria and ranks candidate markets", () => {
      const results = evaluateMarketSelectionScorecard([
        {
          country: "Germany",
          scores: {
            marketSizeAndGrowth: 5,
            tariffAndTradePreference: 5,
            logisticsAndFreight: 4,
            regulatoryAndStandards: 4,
            paymentAndCurrencyRisk: 5,
            buyerDemandAndConcentration: 4,
            priceRealizationMargin: 5,
            easeOfDoingBusiness: 5,
            culturalAndLanguageFit: 4,
            competitiveIntensity: 3,
          },
        },
        {
          country: "UAE",
          scores: {
            marketSizeAndGrowth: 4,
            tariffAndTradePreference: 4,
            logisticsAndFreight: 5,
            regulatoryAndStandards: 4,
            paymentAndCurrencyRisk: 4,
            buyerDemandAndConcentration: 3,
            priceRealizationMargin: 4,
            easeOfDoingBusiness: 4,
            culturalAndLanguageFit: 3,
            competitiveIntensity: 2,
          },
        },
      ]);

      expect(results).toHaveLength(2);
      expect(results[0]?.country).toBe("Germany");
      expect(results[0]?.rank).toBe(1);
      expect(results[0]?.weightedScore).toBeGreaterThan(results[1]?.weightedScore ?? 0);
      expect(results[1]?.rank).toBe(2);
    });
  });

  describe("Export Journey Stage Mapper", () => {
    it("maps pipeline stages 1 to 4 to Journey Stage 3 (Buyer Leads & Outreach)", () => {
      const r1 = mapExportJourneyStage([
        { id: "opp-1", stage: "lead_discovered", verificationStatus: "unverified" },
      ]);
      expect(r1.stageNumber).toBe(3);

      const r2 = mapExportJourneyStage([
        { id: "opp-1", stage: "lead_verified", verificationStatus: "identity_checked" },
      ]);
      expect(r2.stageNumber).toBe(3);
    });

    it("maps pipeline stages 5 to 8 and 9 to Journey Stage 4 (Inquiry & Quotation)", () => {
      const res = mapExportJourneyStage([
        { id: "opp-1", stage: "quote_submitted", verificationStatus: "commercially_relevant" },
      ]);
      expect(res.stageNumber).toBe(4);
    });

    it("maps samples_dispatched to Stage 5, sample_approved to Stage 6, contract_negotiated to Stage 7", () => {
      expect(
        mapExportJourneyStage([{ id: "o1", stage: "samples_dispatched", verificationStatus: "qualified_opportunity" }])
          .stageNumber,
      ).toBe(5);

      expect(
        mapExportJourneyStage([{ id: "o1", stage: "sample_approved", verificationStatus: "qualified_opportunity" }])
          .stageNumber,
      ).toBe(6);

      expect(
        mapExportJourneyStage([{ id: "o1", stage: "contract_negotiated", verificationStatus: "qualified_opportunity" }])
          .stageNumber,
      ).toBe(7);

      expect(
        mapExportJourneyStage([{ id: "o1", stage: "firm_order_secured", verificationStatus: "qualified_opportunity" }])
          .stageNumber,
      ).toBe(7);
    });

    it("maps outcomes to Journey Stages 8 to 10", () => {
      expect(mapExportJourneyStage([], { hasShipmentUnderway: true }).stageNumber).toBe(8);
      expect(mapExportJourneyStage([], { hasDelivered: true }).stageNumber).toBe(9);
      expect(mapExportJourneyStage([], { hasPaymentReceived: true }).stageNumber).toBe(10);
    });

    it("picks the furthest active opportunity and ignores closed/lost ones", () => {
      const res = mapExportJourneyStage([
        { id: "opp-early", stage: "lead_discovered", verificationStatus: "unverified" },
        { id: "opp-advanced", stage: "samples_dispatched", verificationStatus: "qualified_opportunity" },
        { id: "opp-lost", stage: "closed_lost", verificationStatus: "qualified_opportunity", isClosedOrLost: true },
      ]);
      expect(res.stageNumber).toBe(5);
      expect(res.furthestOpportunityId).toBe("opp-advanced");
    });
  });

  describe("Follow-up Cadence & M05 Deliverable Validation", () => {
    it("generates follow-up dates for Day 1, 4, 8, and 14", () => {
      const cadence = calculateFollowUpCadence("2026-11-01T10:00:00Z");
      expect(cadence.day1).toBe("2026-11-02");
      expect(cadence.day4).toBe("2026-11-05");
      expect(cadence.day8).toBe("2026-11-09");
      expect(cadence.day14).toBe("2026-11-15");
    });

    it("enforces at least five verified leads for M05 deliverable eligibility", () => {
      const notEligible = validateM05Deliverable([
        { verificationStatus: "identity_checked" },
        { verificationStatus: "commercially_relevant" },
        { verificationStatus: "unverified" },
        { verificationStatus: "unverified" },
      ]);
      expect(notEligible.isEligible).toBe(false);
      expect(notEligible.verifiedCount).toBe(2);
      expect(notEligible.missingCount).toBe(3);

      const eligible = validateM05Deliverable([
        { verificationStatus: "identity_checked" },
        { verificationStatus: "identity_checked" },
        { verificationStatus: "commercially_relevant" },
        { verificationStatus: "qualified_opportunity" },
        { verificationStatus: "qualified_opportunity" },
      ]);
      expect(eligible.isEligible).toBe(true);
      expect(eligible.verifiedCount).toBe(5);
      expect(eligible.missingCount).toBe(0);
    });
  });
});
