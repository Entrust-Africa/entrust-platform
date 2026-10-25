import type { PackRequirement } from "../types";
import { awaiting, checked, cite } from "./common";
import { ET, EU } from "./sources";

// EU requirements the EU-bound packs share. Read on 24 and 25 October 2026; EU acts are linked on
// EUR-Lex (see sources.ts for how they were read).

export const EU_IMPORTER: PackRequirement = {
  code: "EUE-01",
  name: "EU importer: EORI, customs declaration and food business registration",
  description:
    "The EU importer releases the goods for free circulation, as a declarant established in the EU with an EORI number. As a food business operator it registers its establishments with the member state's food authority, answers for the imported food complying with EU food law, keeps traceability one step back (the exporter) and one step forward, and withdraws food that turns out unsafe.",
  action: "Confirm the importer's EORI number, who lodges the customs declaration, and that the importer is a registered food business operator.",
  whyItMatters: "Release and the import filings run on the importer's EORI number, and food is placed on the EU market only by a registered food business.",
  responsible: "EU importer",
  trigger: "Before shipment.",
  evidence: "Importer's EORI number and food business registration.",
  jurisdiction: "EU",
  authority: "Member state customs and food control authorities",
  basis: "confirmed",
  verification: checked(
    "Regulation (EU) No 952/2013 Art. 9 (EORI), 170(2) (the declarant is established in the EU) and 201 (release for free circulation); Regulation (EC) No 178/2002 Art. 11 (imported food complies), 18 (traceability) and 19 (withdrawal), consolidated 1 January 2026; Regulation (EC) No 852/2004 Art. 6(2) (registration of establishments). The new Union Customs Code, Regulation (EU) 2026/2108, applies from 21 September 2027; until then 952/2013 governs.",
  ),
  sources: [
    cite(EU.ucc, "Art. 9, 170 and 201."),
    EU.eori,
    cite(EU.generalFoodLaw, "Art. 11, 18 and 19."),
    cite(EU.hygiene, "Art. 6(2): registration."),
    cite(EU.ucc2026, "Applies from 21 September 2027 (Art. 287)."),
  ],
  steps: ["STEP-037"],
};

export const ENTRY_SUMMARY: PackRequirement = {
  code: "EUE-04",
  name: "EU entry summary declaration (ICS2)",
  description:
    "Every consignment entering the EU needs an entry summary declaration in ICS2, lodged by the carrier, and by forwarders for the house bills they issue: for containers by sea, at the latest 24 hours before loading on the vessel that brings them to the EU; for air, the pre-loading data before loading and the full declaration before arrival. The exporter's shipping instructions supply the shipper, consignee, goods description and HS code.",
  action: "Give the carrier and the forwarder an accurate shipper, consignee, goods description and HS code, and confirm the declaration was lodged before loading.",
  whyItMatters: "Cargo without a valid declaration can be refused loading or held on arrival.",
  responsible: "Carrier and forwarder (the exporter supplies the data)",
  trigger: "Before loading: 24 hours ahead for containers by sea.",
  evidence: "Carrier's or forwarder's confirmation that the declaration was lodged.",
  jurisdiction: "EU",
  authority: "Customs of the member state of first entry (ICS2)",
  basis: "confirmed",
  verification: checked(
    "Regulation (EU) No 952/2013 Art. 127; Delegated Regulation (EU) 2015/2446 Art. 105(a) (containers: 24 hours before loading), 106 (air), 112 and 113 (house filers), consolidated 1 July 2026; Implementing Decision (EU) 2023/2879 (release 3: maritime carriers from 4 December 2024, house filers from 1 April 2025). DG TAXUD: every consignment needs an entry summary declaration from 1 June 2026. Not read: the data elements in Annex B.",
  ),
  sources: [
    cite(EU.ucc, "Art. 127: entry summary declaration."),
    cite(EU.uccDelegated, "Art. 105, 106, 112 and 113: time limits and filers."),
    cite(EU.ics2Dates, "The ICS2 release dates."),
    cite(EU.ics2, "Every consignment from 1 June 2026."),
  ],
  steps: ["STEP-092"],
};

/** The REX statement on origin for the Everything But Arms preference, with the product's own wording. */
export const statementOnOrigin = (
  product: { description: string; whyItMatters: string },
  appliesWhen?: PackRequirement["appliesWhen"],
): PackRequirement => ({
  code: "ORG-01",
  name: "Statement on origin for the Everything But Arms preference (REX)",
  description: `To enter without duty under Everything But Arms, originating goods need a statement on origin, made out by the exporter on the invoice or another commercial document. Above EUR 6,000 of originating goods in a consignment, the exporter must be registered in the EU's Registered Exporter system (REX). ${product.description}`,
  action: "Confirm the exporter's REX number, and put the statement on origin on the commercial invoice.",
  whyItMatters: product.whyItMatters,
  responsible: "Exporter",
  trigger: "When the commercial invoice is finalised.",
  evidence: "Statement on origin with the exporter's REX number.",
  jurisdiction: "EU",
  authority: "European Commission and member state customs; the Ethiopian authority that registers exporters in REX",
  basis: appliesWhen ? "conditional" : "confirmed",
  ...(appliesWhen && { appliesWhen }),
  verification: awaiting(
    "Confirmed: Regulation (EU) No 978/2012 Art. 18 and Annex IV (Ethiopia, EBA), and from 1 January 2027 Regulation (EU) 2026/1395 Art. 18 and Annex I; Delegated Regulation (EU) 2015/2446 Art. 43 (non-alteration), 44(1)(b) (wholly obtained), 47 and Annex 22-03; Implementing Regulation (EU) 2015/2447 Art. 78, 79(3) (EUR 6,000), 92 (the statement) and 99 (valid 12 months). DG TAXUD doesn't list Ethiopia among the GSP countries that can't use REX yet. Open: which Ethiopian body registers exporters in REX. The Customs Commission is the likeliest (Swiss and Japanese customs name it as the issuer of Ethiopia's former Form A certificates), but no official text names it.",
  ),
  sources: [
    cite(EU.gsp, "Art. 18 and Annex IV."),
    cite(EU.gsp2027, "Art. 18 and Annex I, from 1 January 2027."),
    cite(EU.uccDelegated, "Art. 43, 44, 47 and Annex 22-03: origin."),
    cite(EU.uccImplementing, "Art. 78, 79, 92 and 99: REX and the statement on origin."),
    cite(EU.rex, "The REX system; the countries not yet using it."),
    cite(ET.japanFormA, "The Ethiopian Customs Commission certified Ethiopia's Form A."),
  ],
  steps: ["STEP-050", "STEP-100"],
});
