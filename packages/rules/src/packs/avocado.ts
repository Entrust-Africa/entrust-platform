import type { PackRequirement } from "../types";
import { awaiting, checked, cite } from "./common";
import { ET } from "./sources";

// The Ethiopian side of exporting fresh Hass avocado, shared by the avocado packs. Read on 24 and
// 25 October 2026.

export const AVOCADO_COVERED: PackRequirement = {
  code: "CASE-02",
  name: "Product covered by this pack",
  description:
    "This pack was researched for fresh Hass avocado. Other fresh produce has its own plant health requirements, marketing standards and residue limits.",
  action: "Confirm the product is fresh avocado. For other fresh produce, ask Entrust to check its rules before relying on this pack.",
  whyItMatters: "Plant health and marketing rules for fresh produce are set crop by crop.",
  responsible: "CLEAR facilitator",
  trigger: "When the product is identified.",
  evidence: "The product's botanical name and variety.",
  jurisdiction: null,
  authority: "Entrust (the pack's scope)",
  basis: "transaction",
  verification: checked("The pack's scope."),
  sources: [],
  steps: ["STEP-005"],
};

export const HORTICULTURE_EXPORTER: PackRequirement = {
  code: "ELG-05",
  name: "Horticulture exporter: certificate of competence and Ministry of Agriculture rules",
  description:
    "Fruit and vegetable exporters may need a certificate of competence. The Ethiopian Agricultural Authority may issue certificates of competence to exporters of agricultural products \"as may be necessary\", and the 2019 licensing categories name a horticulture body as the competence verifier for fruit and vegetable exports. A Ministry of Agriculture draft directive would require the certificate, bar immature fruit, and call for a quality and quarantine check before export. No instrument in force was found that makes the certificate a condition of exporting avocados.",
  action: "Ask the Ethiopian Agricultural Authority whether the exporter needs a certificate of competence to export avocados, and record it if one is issued.",
  whyItMatters: "Where a sector body's certificate is required, the business licence and the bank permit depend on it.",
  responsible: "Exporter",
  trigger: "Before the first export.",
  evidence: "Certificate of competence, or the Authority's answer that none is needed.",
  jurisdiction: "ET",
  authority: "Ethiopian Agricultural Authority, under the Ministry of Agriculture",
  basis: "awaiting_verification",
  verification: awaiting(
    "Regulation 509/2022 Art. 2(2) and 5(1), (3), (6), (10) and (11) (the Authority's powers: certificates of competence, quality certificates, export permits, health certificates); Regulation 457/2019 Art. 2(1) (horticulture marketing moved to the Ministry of Agriculture); the 2019 categories directive, category 66115 (the horticulture authority as verifier). The Ministry's fruit, vegetable and root crop marketing directive is an unnumbered 2015 EC draft (Art. 13(2), 20(6), 22 and 47): it takes effect only once registered with the Ministry of Justice, and it isn't registered. Entrust's answer named MoTRI and the Ethiopian Agricultural Authority without sources. Trade press reports an avocado export guide by the Authority and the horticulture exporters' association; its text wasn't found. No Ethiopian dry-matter or maturity rule was found.",
  ),
  sources: [
    cite(ET.regulation509, "Art. 2(2) and 5: the Authority's powers."),
    cite(ET.regulation457, "Art. 2(1): horticulture marketing to the Ministry of Agriculture."),
    cite(ET.licenceCategories, "Category 66115: fruits and vegetables."),
    cite(ET.moaHorticultureDraft, "Draft directive, not registered: certificate, maturity, pre-export checks."),
  ],
  steps: ["STEP-004"],
};

export const AVOCADO_STANDARD: PackRequirement = {
  code: "QLT-09",
  name: "Compulsory Ethiopian Standard for avocado and the export permit",
  description:
    "Avocado is under a compulsory Ethiopian Standard, CES 193:2021 (Avocado, specification). A producer or exporter of a product under a compulsory standard holds a conformity certificate and uses the mandatory mark, and MoTRI issues a permit before such products leave the country, inspects exports on a risk basis, and may refuse the permit for goods that don't comply.",
  action: "Record the conformity certificate for the lot against CES 193:2021 and MoTRI's export permit.",
  whyItMatters: "MoTRI can stop an export that doesn't meet a compulsory standard.",
  responsible: "Exporter (certificate from a recognised conformity assessment body)",
  trigger: "Lot graded and packed, before export.",
  evidence: "Conformity certificate; MoTRI export permit.",
  jurisdiction: "ET",
  authority: "Ministry of Trade and Regional Integration (MoTRI); Institute of Ethiopian Standards",
  basis: "confirmed",
  verification: awaiting(
    "Proclamation 1343/2024 Art. 2(5) and (15), 25(3), 30(2)(c) and (d), 31(c) and (e), 36(1)(c), 40(1) and 43(1); the 2025 compulsory standards catalogue lists CES 193:2021 Avocado, specification (ICS 67.080.01). Open: the standard's content (the Institute sells it; any maturity or dry-matter criterion is unknown), and how MoTRI applies the permit to export avocados in practice and through which inspection body. ECAE's site couldn't be reached.",
  ),
  sources: [
    cite(ET.standards1343, "Art. 2, 25, 30, 31, 36, 40 and 43."),
    cite(ET.compulsoryStandards, "CES 193:2021 Avocado, specification."),
  ],
  steps: ["STEP-044", "STEP-068"],
};
