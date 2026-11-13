import { STEPS, PHASES } from "@entrust/rules";
import type { PurchaseOrderData, SimulationGap, SimulationStepDefinition, SimulationLogEntry } from "./types";

export const SIMULATION_PO: PurchaseOrderData = {
  poNumber: "US-2026-0048",
  poDate: "12 November 2026",
  orderType: "International Purchase Order",
  currency: "USD",
  buyer: {
    company: "Atlantic Specialty Foods LLC",
    address: "1250 NW 23rd Avenue, Miami, Florida 33125, USA",
    country: "United States",
    contactPerson: "Daniel Morgan",
    email: "procurement@atlanticspecialtyfoods.example",
    telephone: "+1 305 555 0184",
  },
  seller: {
    company: "Momentous Trading PLC (YAD Coffee)",
    country: "Ethiopia",
    businessAddress: "Addis Ababa, Ethiopia",
    contactPerson: "Export Sales Manager",
    email: "export@yadcoffee.example",
  },
  product: {
    name: "Ethiopian Roasted Coffee",
    origin: "Ethiopia",
    productForm: "Roasted whole coffee beans",
    roast: "Medium roast",
    packaging: "250 g sealed retail bags (nitrogen flushed, degassing valve)",
    quantity: "2,000 bags",
    totalNetWeight: "500 kg",
    intendedUse: "Retail sale",
    hsCode: "To be confirmed by exporter and customs authority", // Deliberately unconfirmed in initial PO
  },
  orderValue: {
    quantity: 2000,
    unitPrice: 3.5,
    totalAmount: 7000.0,
    currency: "USD",
  },
  deliveryTerms: {
    incoterm: "FCA",
    namedPlace: "Exporter's designated handover location, Addis Ababa, Ethiopia", // Deliberately unconfirmed
    incotermsVersion: "2020",
    handoverNote: "The parties must confirm the precise handover location before shipment.",
  },
  paymentTerms: [
    "30% advance payment upon order confirmation ($2,100.00 USD).",
    "70% balance against agreed shipping documents ($4,900.00 USD).",
    "Payment by international bank transfer (T/T / CAD).",
    "Seller to confirm applicable Ethiopian banking and foreign-exchange procedures before accepting payment.",
  ],
  packagingAndMarking: [
    "Each 250 g bag must be food-grade and hermetically sealed.",
    "Display product name, origin (Ethiopia), roast level, and net weight.",
    "Include batch / lot identification and harvest year.",
    "Include production and best-before dates (12 months from packing).",
    "Carry FDA-compliant US nutrition & ingredient labeling.",
    "Final labeling requirements must be confirmed before production and dispatch.",
  ],
  qualityRequirements: [
    "Product must be roasted coffee beans of Ethiopian origin (Single Origin Arabica).",
    "No visible foreign matter, insect damage, or contamination.",
    "Consistent medium roast profile (Agtron 55-60).",
    "Packaging must protect the product during international transport.",
    "Buyer may request a pre-shipment product sample.",
    "Compliance with Ethiopian MoA plant health & US FDA food safety requirements.",
  ],
  deliverySchedule: {
    confirmation: "Within 3 business days from receipt of PO.",
    production: "Within 21 calendar days after advance payment receipt.",
    targetDispatch: "Within 30 calendar days after order confirmation.",
    finalDelivery: "To be agreed after freight arrangements.",
  },
  requiredDocuments: [
    "Commercial Invoice (showing 30% advance credited, 70% balance payable).",
    "Packing List (2,000 bags across 50 master export cartons, 500 kg net, 540 kg gross).",
    "Export Customs Declaration and Release Evidence (Ethiopian Customs Commission).",
    "Certificate of Origin (Ethiopian Chamber of Commerce / MoTRI).",
    "Applicable food safety & phytosanitary release documentation.",
    "Air Waybill (AWB) issued by carrier / freight forwarder.",
  ],
};

export const SIMULATION_GAPS: Record<string, SimulationGap> = {
  "gap-hs-code": {
    id: "gap-hs-code",
    stepId: "STEP-008",
    title: "HS Tariff Code Unconfirmed in Purchase Order",
    triggerCondition: "PO US-2026-0048 specifies HS Code: 'To be confirmed by exporter and customs authority'",
    impact:
      "Halts Phase 1 customs schedule lookup (STEP-009), official ECC tariff sign-off (STEP-010), and US FDA admissibility pre-checks (STEP-017).",
    policyReason:
      "CLEAR Non-Assumption Policy: The product is roasted coffee beans (retail-packed), distinct from raw/green coffee (0901.11). CLEAR refuses to assume classification without formal exporter designation, preventing misdeclaration penalties under US 19 CFR §148 and Ethiopian Customs tariff schedule discrepancies.",
    noticeHeading: "CLEAR Compliance Notice — Classification Gap Detected",
    noticeMessage:
      "Purchase Order US-2026-0048 leaves the HS Tariff Code unconfirmed. CLEAR identified that the product is roasted whole coffee beans (not raw/green coffee beans). To ensure proper tariff assignment and US FDA prior admissibility verification, the SME must confirm the 6-digit HS code (0901.21) and Ethiopian 8-digit tariff code (0901.21.00).",
    resolutionLabel: "Resolve Gap: SME Confirms HS Code 0901.21.00 (Roasted Coffee)",
    resolvedMessage:
      "Momentous Trading PLC confirmed HS Code 0901.21.00 (Coffee, roasted, not decaffeinated). Ethiopian Customs Tariff schedule matched with 0% export tariff. Gate unlocked.",
  },
  "gap-handover-location": {
    id: "gap-handover-location",
    stepId: "STEP-022",
    title: "Indeterminate Handover Location under Incoterms 2020 FCA",
    triggerCondition:
      "PO US-2026-0048 specifies FCA Addis Ababa with 'Exporter's designated handover location... The parties must confirm the precise handover location before shipment.'",
    impact:
      "Blocks Commercial Readiness Milestone (STEP-035), carrier booking approval (STEP-074), and equipment receipt (STEP-077).",
    policyReason:
      "Under Incoterms 2020 FCA (Free Carrier), risk of loss transfers at the exact moment goods are placed at the disposal of the buyer's carrier at the named point. An ambiguous location ('Exporter's designated handover location') creates legal liability gaps, insurance ambiguities, and carrier delivery disputes.",
    noticeHeading: "CLEAR Contract Audit — Handover Location Ambiguity",
    noticeMessage:
      "Delivery term is agreed as Incoterms 2020 FCA Addis Ababa, but the precise named place is unconfirmed in PO US-2026-0048. CLEAR identified this gap. Rather than assuming the exporter's registered address, airport cargo terminal, or inland dry port, CLEAR requires the SME and buyer to specify the exact facility address for carrier custody transfer.",
    resolutionLabel: "Resolve Gap: Confirm Handover Location (Momentous Roastery, Bole Lemi Industrial Zone)",
    resolvedMessage:
      "Handover location confirmed: Momentous Trading Roastery & Export Facility, Plot 14, Bole Lemi Industrial Zone, Addis Ababa. Carrier handover designated to Ethiopian Airlines Cargo (ET Cargo). Incoterms audit passed.",
  },
};

/** Narrative execution details tailored specifically to PO US-2026-0048 */
const STEP_NARRATIVES: Record<string, { summary: string; detail: string; actor: string }> = {
  "STEP-001": {
    summary: "Momentous Trading PLC account authenticated and verified.",
    detail: "Momentous Trading PLC (YAD Coffee) logged into CLEAR; verified exporter profile and corporate credentials.",
    actor: "Momentous Trading PLC",
  },
  "STEP-002": {
    summary: "MoTRI TIN & Business Registration 0048192837 verified.",
    detail: "Tax Identification Number (TIN 0048192837) and active commercial register status confirmed with Ministry of Revenues.",
    actor: "Entrust Compliance / MoTRI",
  },
  "STEP-003": {
    summary: "Active coffee export trade license confirmed.",
    detail: "MoTRI commercial register confirms current, unrestricted export license for agricultural commodities and roasted coffee.",
    actor: "Entrust Compliance / MoTRI",
  },
  "STEP-004": {
    summary: "ECTA coffee processing & export competence certificate validated.",
    detail: "Ethiopian Coffee & Tea Authority (ECTA) roastery competence certificate #ECTA-RC-2026-441 validated in good standing.",
    actor: "Ethiopian Coffee & Tea Authority",
  },
  "STEP-005": {
    summary: "Product Profile: Ethiopian Roasted Coffee (250g retail pouches).",
    detail: "Captured product profile: Medium roast Arabica, roasted whole bean, packed in 250 g retail foil pouches with degassing valves.",
    actor: "Momentous Trading PLC",
  },
  "STEP-006": {
    summary: "Roast specification, moisture target & cupping profile logged.",
    detail: "Target roast Agtron 55-60, finished moisture <= 2.5%, defect count zero, roast batch sizing 50 kg/batch logged.",
    actor: "Momentous Trading PLC",
  },
  "STEP-007": {
    summary: "Barrier packaging & labeling specifications recorded.",
    detail: "Food-grade triple-laminated foil pouches, one-way degassing valve, nitrogen flushing target <1% residual O2 logged.",
    actor: "Momentous Trading PLC",
  },
  "STEP-008": {
    summary: "Proposed HS Code assignment evaluated against PO.",
    detail: "PO US-2026-0048 leaves HS Code 'To be confirmed'. CLEAR identifies gap and requires exporter classification.",
    actor: "Momentous Trading PLC",
  },
  "STEP-009": {
    summary: "Customs Tariff Schedule lookup for 0901.21.00 completed.",
    detail: "Automated lookup against Ethiopian Customs Tariff matches 0901.21.00 with 0% export tariff and valid export schedule.",
    actor: "CLEAR Gate Engine",
  },
  "STEP-010": {
    summary: "ECC HS Code classification sign-off verified.",
    detail: "Ethiopian Customs Commission customs tariff verifier code matched and signed off for roasted coffee whole beans.",
    actor: "Ethiopian Customs Commission",
  },
  "STEP-011": {
    summary: "Momentous roastery physical facility profile locked.",
    detail: "Facility: Bole Lemi Industrial Park Roastery, Addis Ababa. Capacity: 15,000 kg/month. Clean room packaging verified.",
    actor: "Momentous Trading PLC",
  },
  "STEP-012": {
    summary: "Food safety & QMS management system audit passed.",
    detail: "HACCP & ISO 22000 compliant roasting procedures and clean storage audited and approved on record.",
    actor: "Entrust Reviewer",
  },
  "STEP-013": {
    summary: "Lot tracking & green bean origin traceability verified.",
    detail: "Batch numbering LOT-2026-RC048 links forward to individual 250g pouches and backward to Sidama washing station green lots.",
    actor: "Entrust Reviewer",
  },
  "STEP-014": {
    summary: "Ministry of Revenues Tax Clearance Certificate verified.",
    detail: "Ministry of Revenues electronic tax clearance #TAX-2026-9011 verified active through Q4 2026.",
    actor: "Ministry of Revenues",
  },
  "STEP-015": {
    summary: "Commercial Bank FX registration verified (Awash Bank).",
    detail: "Awash Bank corporate FX account #01349028148 verified for international trade proceeds repatriation.",
    actor: "Awash Bank",
  },
  "STEP-016": {
    summary: "Permanent SME ID ETH-EXP-048 & Product ID PRD-COF-001 issued.",
    detail: "CLEAR permanently registers Momentous Trading PLC and Ethiopian Roasted Coffee in central registry.",
    actor: "CLEAR Gate Engine",
  },
  "STEP-017": {
    summary: "Initial US admissibility & FDA food safety pre-check passed.",
    detail: "Roasted whole coffee beans identified as admissible to the US under 21 CFR Part 117 without raw quarantine restrictions.",
    actor: "Entrust Admissibility Reviewer",
  },
  "STEP-018": {
    summary: "Phase 1 Milestone Signed: Product Identity Locked.",
    detail: "Exporter identity, roastery credentials, product specs, and HS classification officially verified and sealed.",
    actor: "Entrust Facilitator",
  },
  "STEP-019": {
    summary: "Buyer captured: Atlantic Specialty Foods LLC (Miami, FL, USA).",
    detail: "Buyer Atlantic Specialty Foods LLC, 1250 NW 23rd Ave, Miami, FL 33125 USA registered; contact Daniel Morgan verified.",
    actor: "Momentous Trading PLC",
  },
  "STEP-020": {
    summary: "Purchase Order US-2026-0048 uploaded and parsed.",
    detail: "PO US-2026-0048 ($7,000.00 USD, 2,000 bags @ $3.50, FCA delivery terms, 30% advance) ingested and indexed.",
    actor: "Momentous Trading PLC",
  },
  "STEP-021": {
    summary: "Proforma Invoice PI-2026-048 generated & locked.",
    detail: "Proforma Invoice generated exactly matching PO specifications, unit price, quantity, and payment terms.",
    actor: "Momentous Trading PLC",
  },
  "STEP-022": {
    summary: "Incoterms 2020 selection and named place audit.",
    detail: "PO specifies FCA Addis Ababa with unconfirmed handover location. CLEAR identifies gap and requires exact facility address.",
    actor: "Entrust Compliance",
  },
  "STEP-023": {
    summary: "Currency (USD) and unit price ($3.50/bag = $14.00/kg) verified.",
    detail: "Unit price of $14.00/kg well exceeds green coffee benchmark and reflects specialty roasted value addition.",
    actor: "Entrust Compliance",
  },
  "STEP-024": {
    summary: "ECTA Minimum Export Price floor check validated.",
    detail: "Weekly ECTA minimum export price check validated for roasted value-added coffee export corridor.",
    actor: "Ethiopian Coffee & Tea Authority",
  },
  "STEP-025": {
    summary: "Payment terms verified: 30% advance T/T, 70% CAD balance.",
    detail: "Payment split of $2,100.00 USD advance and $4,900.00 USD cash against documents approved under FX Directive FXD/01/2024.",
    actor: "Entrust Compliance / Bank",
  },
  "STEP-026": {
    summary: "Commercial contract signed by Momentous & Atlantic Specialty Foods.",
    detail: "Contract executed by Daniel Morgan (Atlantic Specialty Foods) and Export Sales Manager (Momentous Trading PLC).",
    actor: "Momentous & Atlantic Specialty",
  },
  "STEP-027": {
    summary: "Advance payment ($2,100.00 USD) SWIFT MT103 advice recorded.",
    detail: "Awash Bank confirms receipt of 30% advance deposit from Atlantic Specialty Foods LLC via correspondent bank.",
    actor: "Awash Bank",
  },
  "STEP-028": {
    summary: "Bank advance retention and FX account credit registered.",
    detail: "30% advance credited into exporter retention account according to NBE foreign exchange allocation rules.",
    actor: "Awash Bank",
  },
  "STEP-029": {
    summary: "Sales contract registration submitted to ECTA.",
    detail: "Sales contract, proforma invoice, and buyer profile submitted to Ethiopian Coffee & Tea Authority portal.",
    actor: "Momentous Trading PLC",
  },
  "STEP-030": {
    summary: "ECTA contract approval and validation certificate issued.",
    detail: "ECTA issues contract registration approval #ECTA-CR-2026-8802 confirming compliant commercial terms.",
    actor: "Ethiopian Coffee & Tea Authority",
  },
  "STEP-031": {
    summary: "Electronic commercial contract registered on NBE e-Trade.",
    detail: "Contract registered in National Bank of Ethiopia foreign trade database for subsequent export permit issuance.",
    actor: "CLEAR Gate Engine",
  },
  "STEP-032": {
    summary: "Buyer import broker & cargo consignee instructions confirmed.",
    detail: "Atlantic Specialty Foods nominates US customs broker (Miami Logistics Services) and forwarder contact.",
    actor: "Atlantic Specialty Foods LLC",
  },
  "STEP-033": {
    summary: "Commercial terms alignment & risk assessment sign-off.",
    detail: "Entrust facilitator conducts final audit of incoterm, payment structure, currency, and counterparty sanctions checks.",
    actor: "Entrust Facilitator",
  },
  "STEP-034": {
    summary: "Pre-shipment insurance terms review.",
    detail: "Under FCA terms, buyer's transit insurance confirmed effective upon carrier handover at Addis Ababa roastery.",
    actor: "Momentous Trading PLC",
  },
  "STEP-035": {
    summary: "Phase 2 Milestone Signed: Commercial Readiness Locked.",
    detail: "Contract, proforma invoice, 30% advance receipt, and Incoterms 2020 FCA terms officially locked.",
    actor: "Entrust Facilitator",
  },
  "STEP-036": {
    summary: "US FDA Food Safety Modernization Act (FSMA) scope confirmed.",
    detail: "Applicable US regulatory regime confirmed: 21 CFR Part 117 (Current Good Manufacturing Practice and Preventive Controls).",
    actor: "Entrust Regulatory Specialist",
  },
  "STEP-037": {
    summary: "US Admissibility verification based on HS 0901.21.00.",
    detail: "Admissibility verified: Roasted coffee whole beans are free from USDA-APHIS quarantine restrictions; FDA regulated.",
    actor: "CLEAR Gate Engine",
  },
  "STEP-038": {
    summary: "US FDA Food Facility Registration (FFR) verified.",
    detail: "Momentous Roastery facility registered with US FDA (#19482019482) with valid US Agent on file.",
    actor: "US Food & Drug Administration",
  },
  "STEP-039": {
    summary: "US Foreign Supplier Verification Program (FSVP) packet validated.",
    detail: "Atlantic Specialty Foods LLC FSVP documentation packet verified: hazard analysis, allergen controls, sanitation SOPs.",
    actor: "Atlantic Specialty Foods LLC",
  },
  "STEP-040": {
    summary: "Hazard Analysis & Preventive Controls (HARPC) food safety plan verified.",
    detail: "Roasting critical control point (thermal process kill step for pathogen reduction) validated by food scientist.",
    actor: "Entrust Quality Specialist",
  },
  "STEP-041": {
    summary: "FDA 21 CFR Part 101 retail labeling compliance verified.",
    detail: "Retail bags verified for English text, net weight in metric (250g) and US customary (8.8 oz), and origin declaration.",
    actor: "Entrust Regulatory Specialist",
  },
  "STEP-042": {
    summary: "Labeling artwork sign-off for US distribution.",
    detail: "Atlantic Specialty Foods and Momentous sign off on finalized 250g packaging bag print proof.",
    actor: "Momentous & Atlantic Specialty",
  },
  "STEP-043": {
    summary: "Commercial Bank export permit dossier prepared.",
    detail: "Application dossier assembled: ECTA contract approval, Proforma Invoice, Tax Clearance, and 30% advance advice.",
    actor: "Momentous Trading PLC",
  },
  "STEP-044": {
    summary: "Electronic Export Permit Application lodged with Awash Bank.",
    detail: "Application submitted through commercial bank trade portal under NBE FX Directive FXD/01/2024.",
    actor: "Momentous Trading PLC",
  },
  "STEP-045": {
    summary: "Commercial Bank trade compliance & anti-money laundering check passed.",
    detail: "Awash Bank AML & trade compliance unit clears Atlantic Specialty Foods LLC and payment channel.",
    actor: "Awash Bank",
  },
  "STEP-046": {
    summary: "Commercial Bank foreign exchange commitment recorded.",
    detail: "Awash Bank commits to 70% balance document handling under CAD instructions.",
    actor: "Awash Bank",
  },
  "STEP-047": {
    summary: "Commercial Bank review of export permit terms.",
    detail: "Senior trade officer confirms compliance with NBE repatriation guidelines and validates unit pricing.",
    actor: "Awash Bank",
  },
  "STEP-048": {
    summary: "Electronic Export Permit #EXP-2026-8812 issued.",
    detail: "Awash Bank issues electronic export permit #EXP-2026-8812 approved in the central customs database.",
    actor: "Awash Bank",
  },
  "STEP-049": {
    summary: "Ministry of Agriculture plant health inspection notice lodged.",
    detail: "Inspection request lodged with MoA Plant Health Regulatory Directorate for roasted commodity certification.",
    actor: "Momentous Trading PLC",
  },
  "STEP-050": {
    summary: "MoA Phytosanitary inspection conducted at roastery.",
    detail: "Inspector verifies roasted beans free from living insects, storage pests, or foreign botanical matter.",
    actor: "Ministry of Agriculture",
  },
  "STEP-051": {
    summary: "MoA Plant Health Export Clearance memo issued.",
    detail: "MoA issues official plant health clearance confirming roasted product meets US destination sanitary standards.",
    actor: "Ministry of Agriculture",
  },
  "STEP-052": {
    summary: "Ethiopian Chamber of Commerce Certificate of Origin application.",
    detail: "Certificate of Origin application lodged confirming 100% Ethiopian harvested and processed Arabica coffee.",
    actor: "Momentous Trading PLC",
  },
  "STEP-053": {
    summary: "Certificate of Origin #COO-ET-2026-3091 issued.",
    detail: "Ethiopian Chamber of Commerce issues certified Certificate of Origin for US customs duty assessment.",
    actor: "Ethiopian Chamber of Commerce",
  },
  "STEP-054": {
    summary: "Phase 3 Milestone Signed: Regulatory & Market Pathway Approved.",
    detail: "US FDA admissibility, export permit #EXP-2026-8812, MoA health clearance, and COO officially approved.",
    actor: "Entrust Facilitator",
  },
  "STEP-055": {
    summary: "Green coffee bean batch sourcing validation.",
    detail: "550 kg Grade 1 Sidama specialty green coffee allocated from certified farm washing station lot #SID-2026-10.",
    actor: "Momentous Trading PLC",
  },
  "STEP-056": {
    summary: "Green coffee moisture (<11.0%) & water activity verified.",
    detail: "Benchtop moisture analyzer reads 10.4% moisture, water activity 0.58 aw. Free from mould or off-odour.",
    actor: "Momentous Quality Lab",
  },
  "STEP-057": {
    summary: "ECTA green bean export grading certificate verified.",
    detail: "National Coffee Liquoring Unit confirms Grade 1 Specialty cup profile: jasmine aroma, citrus acidity, 86.5 SCA.",
    actor: "Ethiopian Coffee & Tea Authority",
  },
  "STEP-058": {
    summary: "Roasting schedule & temperature profile locked.",
    detail: "11 roast batches (50 kg green input per batch), medium roast curve, drop temp 208°C, roast duration 11.5 minutes.",
    actor: "Momentous Master Roaster",
  },
  "STEP-059": {
    summary: "Roasting run executed & cooling cycle completed.",
    detail: "Total roasted output: 504.2 kg net roasted whole coffee beans. Agtron color test reading: 57.2 (Medium Roast).",
    actor: "Momentous Production Team",
  },
  "STEP-060": {
    summary: "Destoning, magnetic separation & optical sorting completed.",
    detail: "Gravity destoner and rare-earth magnetic separator clear 100% of physical impurities; optical sorter removes quakers.",
    actor: "Momentous Production Team",
  },
  "STEP-061": {
    summary: "Degassing bin storage & volatile aroma preservation.",
    detail: "Roasted whole beans rested for 24 hours under nitrogen blanket to reach optimal packaging equilibrium.",
    actor: "Momentous Production Team",
  },
  "STEP-062": {
    summary: "Roasted coffee moisture test: 2.1% (Compliant).",
    detail: "Moisture content verified at 2.1% (well below the maximum 5.0% threshold mandated by food safety specs).",
    actor: "Momentous Quality Lab",
  },
  "STEP-063": {
    summary: "Pesticide residue & ochratoxin A lab test passed.",
    detail: "Accredited third-party lab testing confirms zero detectable ochratoxin A and no pesticide residues above US EPA MRLs.",
    actor: "Accredited Food Safety Lab",
  },
  "STEP-064": {
    summary: "Export Batch Allocation & Lot Numbering (LOT-2026-RC048).",
    detail: "Official export lot #LOT-2026-RC048 assigned to the 500 kg shipment (2,000 bags x 250 g).",
    actor: "Momentous Quality Lab",
  },
  "STEP-065": {
    summary: "Automated bagging & nitrogen flush sealing run.",
    detail: "2,000 bags hermetically sealed with one-way degassing valves. Residual oxygen verified <0.8%.",
    actor: "Momentous Packaging Line",
  },
  "STEP-066": {
    summary: "Checkweigher verification of individual 250g bags.",
    detail: "100% checkweigher audit confirms each pouch is within 250.5g - 252.0g net weight; no underfilled bags.",
    actor: "Momentous Packaging Line",
  },
  "STEP-067": {
    summary: "Master export carton packing (50 cartons x 40 bags = 2,000 bags).",
    detail: "Packaged into 50 heavy-duty 5-ply corrugated export cartons; 10 kg net weight per carton; strapped and sealed.",
    actor: "Momentous Packaging Line",
  },
  "STEP-068": {
    summary: "Carton labeling & shipping marks applied.",
    detail: "Marks: ATLANTIC SPECIALTY FOODS / MIAMI / PO US-2026-0048 / CARTON 1-50 / ETHIOPIAN ROASTED COFFEE / NET 10KG.",
    actor: "Momentous Packaging Line",
  },
  "STEP-069": {
    summary: "Palletization & shrink-wrapping completed.",
    detail: "2 Euro-pallets stacked 25 cartons per pallet, corner board protected, stretch-wrapped with security seals.",
    actor: "Momentous Warehouse",
  },
  "STEP-070": {
    summary: "Certificate of Analysis & Quality Certificate issued.",
    detail: "Momentous Quality Assurance issues Certificate of Quality verifying full compliance with PO specifications.",
    actor: "Momentous Quality Director",
  },
  "STEP-071": {
    summary: "Pre-Shipment Inspection (PSI) conducted by Entrust inspector.",
    detail: "Physical count: exactly 50 cartons / 2,000 bags / 500 kg net / 540 kg gross. Packaging integrity certified intact.",
    actor: "Entrust Quality Inspector",
  },
  "STEP-072": {
    summary: "Phase 4 Milestone Signed: Cargo Packed & Quality Certified.",
    detail: "Roasting, packaging, lab analysis, and final PSI successfully completed. Cargo staged for carrier handover.",
    actor: "Entrust Facilitator",
  },
  "STEP-073": {
    summary: "Air freight transport mode confirmed (Bole ADD to Miami MIA).",
    detail: "High-value roasted coffee allocated for expedited international air freight to preserve roast freshness.",
    actor: "Momentous & Atlantic Specialty",
  },
  "STEP-074": {
    summary: "Air cargo booking confirmed with Ethiopian Airlines Cargo.",
    detail: "Booking confirmed on flight ET-500 (Addis Ababa to Miami via Washington Dulles); space reserved for 540 kg gross.",
    actor: "Ethiopian Airlines Cargo",
  },
  "STEP-075": {
    summary: "Air cargo ULD container allocation.",
    detail: "Cargo booked as loose palletized freight within temperature-controlled aircraft lower deck hold.",
    actor: "Ethiopian Airlines Cargo",
  },
  "STEP-076": {
    summary: "Pick-up transport dispatched to Momentous roastery.",
    detail: "Licensed secure cargo truck dispatched to Bole Lemi Industrial Zone roastery facility (confirmed handover point).",
    actor: "Expeditors International Forwarder",
  },
  "STEP-077": {
    summary: "Handover executed & Cargo Transfer Receipt issued.",
    detail: "Goods transferred to carrier at confirmed handover location. Risk transferred under Incoterms 2020 FCA.",
    actor: "Momentous & Carrier",
  },
  "STEP-078": {
    summary: "Airport cargo terminal intake & security screening at ADD.",
    detail: "Cargo arrives at Bole International Airport Cargo Terminal; X-ray security screening passed; intake receipt issued.",
    actor: "Bole Airport Cargo Terminal",
  },
  "STEP-079": {
    summary: "Ethiopian Customs Commission ASYCUDA e-declaration filed.",
    detail: "Electronic Export Customs Declaration submitted under Export Permit #EXP-2026-8812, HS 0901.21.00.",
    actor: "Licensed Customs Broker",
  },
  "STEP-080": {
    summary: "Commercial Invoice & Packing List submitted to ECC.",
    detail: "Documents uploaded into Ethiopian Customs single window matching declaration particulars.",
    actor: "Licensed Customs Broker",
  },
  "STEP-081": {
    summary: "Customs valuation verification against ECTA contract approval.",
    detail: "Customs valuation officer validates declared value of $7,000.00 USD against approved proforma & contract.",
    actor: "Ethiopian Customs Commission",
  },
  "STEP-082": {
    summary: "ASYCUDA automated risk profiling: Green Channel Assigned.",
    detail: "Authorized Economic Operator / compliant record awards Green Channel status (immediate documentary release).",
    actor: "Ethiopian Customs Commission",
  },
  "STEP-083": {
    summary: "Customs export assessment notice issued.",
    detail: "Assessment notice confirmed with zero export duty, zero export surcharge, and nil customs withholding.",
    actor: "Ethiopian Customs Commission",
  },
  "STEP-084": {
    summary: "Customs electronic release order generated.",
    detail: "Customs system transmits electronic release authorization to Bole Airport air cargo terminal dispatch.",
    actor: "Ethiopian Customs Commission",
  },
  "STEP-085": {
    summary: "Customs stamp & export declaration clearance signed off.",
    detail: "Declaration #CD-2026-90214 endorsed with official export release seal.",
    actor: "Ethiopian Customs Commission",
  },
  "STEP-086": {
    summary: "Terminal handling charges & air freight airway bill fees settled.",
    detail: "Airport ground handling and terminal documentation fees paid by nominated freight forwarder.",
    actor: "Freight Forwarder",
  },
  "STEP-087": {
    summary: "Cargo pallet build-up and air net securing.",
    detail: "50 cartons securely strapped on air cargo skid, weather-proof protective tarped, ready for aircraft loading.",
    actor: "Ethiopian Airlines Ground Handling",
  },
  "STEP-088": {
    summary: "Carrier flight manifest insertion.",
    detail: "Shipment manifest entry #ET-500-MIA-048 added to aircraft master load plan.",
    actor: "Ethiopian Airlines Cargo",
  },
  "STEP-089": {
    summary: "Final pre-boarding customs gate check at tarmac.",
    detail: "Customs apron officer verifies pallet security seal numbers before cargo hold loading.",
    actor: "Ethiopian Customs Apron Unit",
  },
  "STEP-090": {
    summary: "Ramp loading completed aboard flight ET-500.",
    detail: "Cargo loaded into forward hold position 21R; weight and balance sheet signed by aircraft captain.",
    actor: "Ethiopian Airlines Flight Ops",
  },
  "STEP-091": {
    summary: "Phase 5 Milestone Signed: Cargo Cleared & Released for Export.",
    detail: "Export customs clearance granted, air cargo manifest locked, cargo aboard aircraft awaiting departure.",
    actor: "Entrust Facilitator",
  },
  "STEP-092": {
    summary: "Original Air Waybill AWB #071-84920184 issued.",
    detail: "Ethiopian Airlines Cargo issues Master Air Waybill AWB #071-84920184 showing consignee Atlantic Specialty Foods LLC.",
    actor: "Ethiopian Airlines Cargo",
  },
  "STEP-093": {
    summary: "Final Commercial Invoice issued with flight & AWB details.",
    detail: "Final Commercial Invoice #INV-2026-048 reflects shipped weight (500 kg net / 540 kg gross) and AWB reference.",
    actor: "Momentous Trading PLC",
  },
  "STEP-094": {
    summary: "Final Packing List signed and certified.",
    detail: "Detailed packing breakdown confirmed against cargo intake manifest.",
    actor: "Momentous Trading PLC",
  },
  "STEP-095": {
    summary: "Electronic shipping dossier transmitted to US buyer & broker.",
    detail: "Complete digital document set (Invoice, Packing List, AWB, COO, Health Clearance) dispatched to Atlantic Specialty.",
    actor: "CLEAR Gate Engine",
  },
  "STEP-096": {
    summary: "US FDA Prior Notice prepared under 21 CFR §1.279.",
    detail: "Prior Notice data compiled: FFR #19482019482, HS 0901.21.00, flight ET-500, scheduled arrival Miami International.",
    actor: "US Customs Broker",
  },
  "STEP-097": {
    summary: "US FDA Prior Notice confirmation #PN-8910482910 issued.",
    detail: "FDA electronic system issues Prior Notice Confirmation Number; cargo cleared for US border entry.",
    actor: "US Food & Drug Administration",
  },
  "STEP-098": {
    summary: "US Customs & Border Protection (CBP) Entry 7501 filed.",
    detail: "Broker submits electronic formal consumption entry with US CBP at Port of Miami (Port Code 5201).",
    actor: "US Customs Broker",
  },
  "STEP-099": {
    summary: "Automated CLEAR Document Reconciliation executed.",
    detail: "CLEAR cross-checks PO, Commercial Invoice, Packing List, AWB, and COO: 100% data consistency confirmed.",
    actor: "CLEAR Gate Engine",
  },
  "STEP-100": {
    summary: "Flight departure from Addis Ababa (Bole International Airport).",
    detail: "Flight ET-500 departs ADD en route to MIA. Real-time air cargo tracking activated.",
    actor: "Ethiopian Airlines Cargo",
  },
  "STEP-101": {
    summary: "In-flight tracking & transit monitoring.",
    detail: "Shipment transit status monitored; temperature-controlled environment maintained throughout transit.",
    actor: "CLEAR Gate Engine",
  },
  "STEP-102": {
    summary: "Pre-arrival clearance notification received from US CBP.",
    detail: "CBP automated targeting system issues preliminary release order subject to physical cargo arrival.",
    actor: "US Customs & Border Protection",
  },
  "STEP-103": {
    summary: "Flight touchdown at Miami International Airport (MIA).",
    detail: "Flight ET-500 lands at MIA. Cargo offloaded to cargo handling warehouse.",
    actor: "MIA Airport Cargo Operations",
  },
  "STEP-104": {
    summary: "Cargo warehouse intake & breakdown at Miami.",
    detail: "Pallet seals inspected intact; all 50 cartons accounted for without damage or discrepancy.",
    actor: "MIA Ground Handling",
  },
  "STEP-105": {
    summary: "US FDA electronic hold release confirmed.",
    detail: "FDA reviews Prior Notice confirmation #PN-8910482910 and issues 21 CFR 801 May Proceed notice.",
    actor: "US Food & Drug Administration",
  },
  "STEP-106": {
    summary: "US CBP official customs release granted (1C Green Release).",
    detail: "US Customs issues Entry Summary release authorization; goods released into US commerce.",
    actor: "US Customs & Border Protection",
  },
  "STEP-107": {
    summary: "Delivery to Atlantic Specialty Foods LLC Miami facility.",
    detail: "Local drayage carrier delivers 50 cartons to 1250 NW 23rd Ave, Miami; receiving report signed by Daniel Morgan.",
    actor: "Atlantic Specialty Foods LLC",
  },
  "STEP-108": {
    summary: "Phase 6 Milestone Signed: Cargo Shipped & Delivered.",
    detail: "Goods received in full and flawless condition by buyer in Miami, USA. Delivery milestone closed.",
    actor: "Entrust Facilitator",
  },
  "STEP-109": {
    summary: "CAD banking document package assembled.",
    detail: "Original Commercial Invoice, Packing List, Original Air Waybill, Certificate of Origin, and Bank Collection Order prepared.",
    actor: "Momentous Trading PLC",
  },
  "STEP-110": {
    summary: "Presentation of shipping documents to Awash Bank.",
    detail: "Dossier presented to Awash Bank International Banking Department for 70% balance collection ($4,900.00 USD).",
    actor: "Momentous Trading PLC",
  },
  "STEP-111": {
    summary: "Awash Bank document examination under UCP / URC rules.",
    detail: "Awash Bank documentary trade specialists verify clean presentation against Export Permit #EXP-2026-8812.",
    actor: "Awash Bank",
  },
  "STEP-112": {
    summary: "Bank schedule and collection instruction dispatched to US bank.",
    detail: "Awash Bank dispatches electronic CAD collection advice to buyer's bank (Bank of America Miami).",
    actor: "Awash Bank",
  },
  "STEP-113": {
    summary: "Buyer bank presents documents to Atlantic Specialty Foods.",
    detail: "Bank of America notifies Atlantic Specialty Foods of clean document presentation for $4,900.00 USD balance.",
    actor: "Bank of America Miami",
  },
  "STEP-114": {
    summary: "Atlantic Specialty Foods approves document release & payment.",
    detail: "Buyer Daniel Morgan authorizes immediate debit of $4,900.00 USD to settle final contract balance.",
    actor: "Atlantic Specialty Foods LLC",
  },
  "STEP-115": {
    summary: "International SWIFT payment wire generated (MT202).",
    detail: "Bank of America initiates SWIFT wire for $4,900.00 USD to Awash Bank Addis Ababa reference PO US-2026-0048.",
    actor: "Bank of America Miami",
  },
  "STEP-116": {
    summary: "SWIFT wire receipt & Nostro account credit confirmed.",
    detail: "Awash Bank Treasury Department confirms incoming credit of $4,900.00 USD in international Nostro account.",
    actor: "Awash Bank Treasury",
  },
  "STEP-117": {
    summary: "Foreign exchange repatriation credited to Momentous account.",
    detail: "Awash Bank credits 70% balance to Momentous Trading PLC corporate retention account (100% payment achieved: $7,000 USD).",
    actor: "Awash Bank",
  },
  "STEP-118": {
    summary: "Bank FX purchase & transaction advice issued.",
    detail: "Bank issues official Foreign Exchange Purchase Ticket and confirmation of full export proceeds received.",
    actor: "Awash Bank",
  },
  "STEP-119": {
    summary: "National Bank of Ethiopia export permit reconciliation.",
    detail: "NBE electronic platform links Export Permit #EXP-2026-8812 with incoming SWIFT credits ($2,100 advance + $4,900 CAD).",
    actor: "National Bank of Ethiopia",
  },
  "STEP-120": {
    summary: "Customs declaration export acquittal recorded.",
    detail: "Ethiopian Customs Commission ASYCUDA marks Declaration #CD-2026-90214 as fully reconciled with bank repatriation.",
    actor: "Ethiopian Customs Commission",
  },
  "STEP-121": {
    summary: "Official NBE Export Permit Discharge Certificate issued.",
    detail: "Export permit closed with zero outstanding liability; exporter compliance record updated with honors.",
    actor: "National Bank of Ethiopia",
  },
  "STEP-122": {
    summary: "Comprehensive CLEAR compliance audit report generated.",
    detail: "Audit engine verifies all 125 steps executed with zero unresolved flags, zero defects, and 100% evidence compliance.",
    actor: "CLEAR Gate Engine",
  },
  "STEP-123": {
    summary: "Exporter & Buyer performance ratings recorded.",
    detail: "Momentous Trading PLC awarded 5-star export fulfillment rating on CLEAR and AfriConnect platforms.",
    actor: "CLEAR Platform Registry",
  },
  "STEP-124": {
    summary: "AfriConnect trade passport and case history archived.",
    detail: "Verified proof-of-trade digital credential added to Momentous Trading's permanent export passport.",
    actor: "AfriConnect Trade Network",
  },
  "STEP-125": {
    summary: "Phase 7 Milestone Signed: Payment Reconciled & Case Closed.",
    detail: "Case US-2026-0048 officially marked CLOSED. All commercial, regulatory, logistics, and banking obligations satisfied.",
    actor: "Entrust Facilitator",
  },
};

export function buildSimulationSteps(): SimulationStepDefinition[] {
  return STEPS.map((s) => {
    const narrative = STEP_NARRATIVES[s.id];
    let gapId: "gap-hs-code" | "gap-handover-location" | undefined;
    if (s.id === "STEP-008") gapId = "gap-hs-code";
    if (s.id === "STEP-022") gapId = "gap-handover-location";

    return {
      id: s.id,
      phase: s.phase,
      name: s.name,
      owner: s.owner,
      authority: s.authority,
      prerequisites: [...s.prerequisites],
      masterControl: s.masterControl,
      milestone: Boolean(s.milestone),
      evidenceType: s.evidence?.[0]?.type,
      summary: narrative?.summary ?? `${s.name} processed and verified.`,
      executionDetail: narrative?.detail ?? `${s.name} completed under canonical CLEAR protocol.`,
      gapId,
    };
  });
}

export function buildPhaseSummaries() {
  return PHASES.map((p) => {
    return {
      id: p.id,
      name: p.name,
      milestone: p.milestone,
      firstStep: p.firstStep,
      lastStep: p.lastStep,
    };
  });
}
