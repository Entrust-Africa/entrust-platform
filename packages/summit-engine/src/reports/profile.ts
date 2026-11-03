import { countryName, opportunityClassification, selectionId } from "./catalogue";
import type { ReportApplication } from "./types";

// The one-page profile of a selected SME (#80, specification section 9), for Entrust's own use in preparing the business
// meetings. It holds what the business told us about itself and what it is looking for, and none of the assessment: no
// score, no rationale, no verification finding, no committee reason and no internal note. That keeps it fit to hand to a
// buyer or an investor once the business has authorised that, which is for the consent model of #70 to decide.
//
// The specification's list of fields isn't available to us, so the fields below are chosen from the application: who the
// business is, what it does, what it offers abroad, what it asks for and who to talk to. A field the application has no
// answer for is left out rather than shown empty.

export interface ProfileField {
  label: string;
  value: string;
}

export interface ProfileSection {
  heading: string;
  fields: ProfileField[];
}

export interface OpportunityProfile {
  businessName: string;
  /** Selection number, SME ID and application ID. */
  reference: string;
  /** Whether the committee's final list is approved, so a profile made before that says so. */
  confirmation: string;
  sections: ProfileSection[];
}

const joined = (values: readonly string[]): string | null => (values.length ? values.join("; ") : null);

export function opportunityProfile(a: ReportApplication): OpportunityProfile {
  const answers = a.answers;
  const owned = [answers.yesNo("womanOwned") ? "Woman-owned or woman-led" : null, answers.yesNo("youthOwned") ? "Youth-owned or youth-led" : null].filter(
    (v): v is string => v !== null,
  );
  const exported = answers.yesNo("exported");
  const markets = joined(answers.list("exportMarkets"));
  const employees = answers.text("employees");

  const sections: { heading: string; fields: [string, string | null][] }[] = [
    {
      heading: "The business",
      fields: [
        ["Country", countryName(a.country)],
        ["City or region", answers.text("city")],
        ["Industry", answers.text("sector")],
        ["Main products or services", joined(answers.list("activities"))],
        ["About the business", answers.text("description")],
        ["Annual revenue", answers.text("revenue")],
        ["Employees", employees],
        ["Production or service capacity", answers.text("capacity")],
        ["Ownership", joined(owned)],
      ],
    },
    {
      heading: "Trade",
      fields: [
        ["Export experience", exported === null ? null : exported ? (markets ? `Yes: ${markets}` : "Yes") : "No"],
        ["Markets it wants to reach", joined(answers.list("targetMarkets"))],
        ["Certifications and standards", answers.text("requirements")],
      ],
    },
    {
      heading: "What it is looking for",
      fields: [
        ["Opportunity", opportunityClassification(a.recommendation?.suitable, a.pathway)],
        ["Commercial ask", answers.text("commercialAsk")],
        ["Country or market", joined(answers.list("askMarkets"))],
        ["Looking to meet", joined(answers.list("partnersSought"))],
        ["Estimated transaction value", answers.text("askValue")],
        ["Investment sought", a.seeksInvestment ? answers.text("investmentAmount") : null],
        ["Intended use of funds", a.seeksInvestment ? answers.text("investmentUse") : null],
        ["Hopes to achieve at the Summit", answers.text("summitGoal")],
      ],
    },
    {
      heading: "Contact",
      fields: [
        ["Representative", answers.text("representativeName") ?? answers.text("contactName")],
        ["Position", answers.text("representativePosition") ?? answers.text("contactPosition")],
        ["Email", answers.text("contactEmail")],
        ["Telephone", answers.text("contactPhone")],
      ],
    },
  ];

  return {
    businessName: a.businessName,
    reference: [selectionId(a), a.smeId, a.number].filter((v): v is string => v !== null).join(" | "),
    confirmation: a.finalListApprovedAt
      ? `Selection confirmed ${a.finalListApprovedAt.toISOString().slice(0, 10)}`
      : "Selection pending the committee's final list approval",
    sections: sections
      .map(({ heading, fields }) => ({
        heading,
        fields: fields.flatMap(([label, value]) => (value ? [{ label, value }] : [])),
      }))
      .filter((section) => section.fields.length > 0),
  };
}
