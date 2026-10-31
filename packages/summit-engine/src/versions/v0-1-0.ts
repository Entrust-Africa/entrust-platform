import type { Category, CategoryId, SummitRules } from "../types";

// Version 0.1.0 is a DRAFT with placeholder criteria. The specification gives the seven categories, their
// maximums and what each assesses, but says "each category must have defined scoring criteria and
// evidence requirements" without defining them, and it names no alternative rule for category D or
// criteria for the four pathways. Until Entrust sends them, each category is one criterion worth all
// of its points and carries no evidence requirement, and officers can't score against it. The real
// criteria go in a new, approved version, which then never changes.

const placeholder = (
  id: CategoryId,
  title: string,
  maxPoints: number,
  assess: readonly string[],
  investmentOnly?: true,
): Category => ({
  id,
  title,
  maxPoints,
  assess,
  ...(investmentOnly ? { investmentOnly } : {}),
  criteria: [{ id: `${id}1`, text: `Placeholder: ${title}. Entrust hasn't yet supplied the criteria.`, maxPoints, evidence: [] }],
});

export const SUMMIT_RULES_0_1_0: SummitRules = {
  version: "0.1.0",
  status: "draft",
  eligibility: {
    // Section 7 gives the registration certificate as the evidence for registration. Entrust sets the rest.
    requiredDocuments: {
      trade_and_market_access: ["registration_certificate"],
      investment: ["registration_certificate"],
      strategic_partnership: ["registration_certificate"],
      combined_trade_and_investment: ["registration_certificate"],
    },
  },
  rubric: {
    notApplicable: "rescale",
    categories: [
      placeholder("A", "Business legitimacy and operating activity", 10, [
        "Registration and legal status",
        "Actual business operations",
        "Business history",
        "Ownership and management information",
        "Supporting evidence",
      ]),
      placeholder("B", "Commercial offering and market potential", 15, [
        "Product or service clarity",
        "Market demand",
        "Competitive positioning",
        "Pricing and product information",
        "Production or service delivery capability",
      ]),
      placeholder("C", "Trade opportunity and market access potential", 20, [
        "Export history or realistic export potential",
        "Identified target markets",
        "Buyer relationships",
        "Existing enquiries, contracts, or purchase orders",
        "Ability to meet buyer requirements",
      ]),
      placeholder(
        "D",
        "Investment opportunity and potential",
        20,
        [
          "Clarity of investment requirement",
          "Defined use of funds",
          "Commercial justification",
          "Financial information",
          "Implementation plan and expected results",
        ],
        true,
      ),
      placeholder("E", "Financial and operational readiness", 15, [
        "Financial recordkeeping",
        "Revenue evidence",
        "Operational capacity",
        "Management structure",
        "Ability to fulfill commercial commitments",
      ]),
      placeholder("F", "Diaspora partnership potential", 10, [
        "Potential for diaspora engagement",
        "Identified partnership opportunities",
        "Commercial value to a prospective partner",
        "Ability to sustain a long-term relationship",
      ]),
      placeholder("G", "Summit participation readiness", 10, [
        "Clear participation objectives",
        "Quality of business presentation",
        "Availability of supporting documents",
        "Readiness for B2B meetings",
        "Ability to follow up on opportunities",
      ]),
    ],
  },
};
