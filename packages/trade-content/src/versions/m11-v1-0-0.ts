import type { ModuleContent } from "../schema";

// Loaded from Entrust's M11 document. Sample documents and case materials are the platform team's, marked as fictional.
export const M11_V1_0_0: ModuleContent = {
  module: "M11",
  version: "1.0.0",
  title: "Practical Transaction Simulation",
  deliverable: "Practical Transaction Simulation Report",
  objectives: [
    "Assess whether a buyer enquiry or order represents a credible commercial opportunity.",
    "Identify missing information and distinguish verified facts from assumptions.",
    "Evaluate product specifications, quality requirements and buyer expectations.",
    "Assess production capacity, delivery commitments and operational constraints.",
    "Prepare or review export costing and determine whether the transaction is commercially viable.",
    "Identify payment, financing, compliance, logistics and insurance risks requiring attention.",
    "Build a practical transaction execution plan with responsibilities and decision points.",
    "Make and justify a proceed, hold, renegotiate or no-go recommendation.",
  ],
  status: "draft",
  lessons: [
    {
      id: "introduction",
      title: "Simulation introduction",
      body: "## Purpose\n\nM11 brings together the commercial, financial, operational and export-execution capabilities developed throughout TRADE.\n\nLearners work through a simulated export transaction involving Addis Workwear PLC, an Ethiopian workwear manufacturer, and Eastland Industrial Supplies, a prospective international buyer.\n\nThe learner is placed in the role of the SME’s export transaction lead. The task is to assess the opportunity, test whether the business can fulfil it, identify the information and resources required, manage transaction risks, and make a defensible commercial decision.\n\nThe exercise does not reward a decision to export at all costs. A well-supported decision to pause, renegotiate or decline an unsuitable transaction can demonstrate stronger capability than proceeding with an unverified order.\n\n## Entry conditions\n\nLearners should have completed the relevant TRADE modules and have access to the M11 case materials.\n\nM11 draws particularly on:\n\n- M01: Diagnostic and Deal Selection\n- M02: Digital Operations and Business Records\n- M03: Financial Performance and Bankability\n- M04: Trade Finance and Payment Risk\n- M05: Buyer Development and Conversion\n- M06: Export Costing and Margin Control\n- M07: Operational Planning and Fulfillment\n- M08: Export Execution and Requirements\n- M09: AI and Digital Productivity\n- M10: Buyer Relationships and Repeat Business\n\nThe platform should not prevent a learner from completing M11 solely because a particular earlier module has not been marked complete. However, the learner should be directed to any relevant knowledge gaps before the final assessment.\n\n## Required outputs\n\nThe learner must submit the following nine outputs to the platform.\n\n| No. | Required output | Minimum content |\n| --- | --- | --- |\n| 1 | Buyer Opportunity Assessment | Buyer profile, enquiry summary, verification needs, opportunity status and outstanding questions |\n| 2 | Buyer Requirements and Specification Sheet | Product, quantity, technical requirements, quality, packaging, delivery and payment expectations |\n| 3 | Product and Quality Assessment | Product suitability, modifications, quality controls, samples and unresolved requirements |\n| 4 | Export Costing and Quotation Worksheet | Cost categories, assumptions, currency, delivery term, selling price and margin |\n| 5 | Production and Fulfilment Plan | Capacity, inputs, production schedule, quality milestones and delivery plan |\n| 6 | Export Requirements and Document Checklist | Requirements, source or verification status, responsible party and outstanding actions |\n| 7 | Transaction Finance and Risk Assessment | Payment terms, working capital, financial exposure, risks and proposed controls |\n| 8 | Transaction Action and Responsibility Plan | Actions, owners, deadlines, dependencies and completion evidence |\n| 9 | Final Transaction Decision Report | Proceed/hold/renegotiate/no-go decision, justification, conditions and next steps |\n\nEach output should be saved as a separate file or structured platform record. The platform should retain the submission date, learner identity, assessor feedback and revision history.\n\nA learner should not receive full credit for a document that merely repeats the case information. The learner must demonstrate analysis and make a decision based on the evidence.\n\n### The gates\n\nLearners must complete all eight gates in sequence. A gate may be marked complete only when the learner has recorded the evidence, decision or outstanding action required.\n\n### Individual learning plan\n\nAfter assessment, the learner should receive an individual improvement plan based on the gaps identified.\n\n| Identified gap | Required improvement | Suggested owner | Target date | Evidence of completion |\n| --- | --- | --- | --- | --- |\n| Buyer verification | Complete buyer due diligence and update buyer record | SME |  | Verified buyer information |\n| Product specification | Confirm all technical and quality requirements | SME / buyer |  | Approved specification |\n| Costing | Review missing costs and recalculate margin | SME finance lead |  | Revised costing sheet |\n| Production capacity | Confirm capacity, inputs and delivery schedule | SME production lead |  | Approved production plan |\n| Export requirements | Verify applicable requirements with authoritative sources | SME / export specialist |  | Updated compliance checklist |\n| Payment risk | Review terms and agree suitable protections | SME / bank |  | Documented payment arrangement |\n| Insurance exposure | Identify relevant risks and obtain insurer assessment where appropriate | SME / insurer |  | Risk assessment or insurance enquiry |\n| Transaction management | Assign actions and establish follow-up controls | SME transaction lead |  | Updated action plan |\n\nThe learning plan should be personalized to the learner’s actual assessment results. The platform should not automatically recommend a bank, insurer or service provider as though approval or coverage is guaranteed.\n\n## Completing this module\n\n## Pass requirements\n\nA learner must meet all three conditions:\n\n1. Score at least 24 out of 36.\n2. Achieve at least 80% in the knowledge checks.\n3. Have no critical failure.\n\n## Resubmission\n\nA learner who does not pass should receive:\n\n- The assessment result.\n- The criteria not yet met.\n- Specific corrective feedback.\n- Required revisions.\n- A resubmission deadline.\n- A reassessment record.\n\nThe platform must retain the original score and the resubmission score separately.\n\nM11 is complete only when the learner has:\n\n- Completed all eight transaction gates.\n- Submitted all nine required outputs.\n- Achieved at least 80% in the knowledge checks.\n- Achieved at least 24/36 in the practical assessment.\n- Avoided all critical failures.\n- Completed any required reassessment.\n\nThe platform should distinguish:\n\n- In progress: The learner has started but has not submitted all required work.\n- Submitted: All required outputs have been submitted and await assessment.\n- Revisions required: The assessor has returned work for correction.\n- Passed: All completion and assessment requirements have been met.\n- Not passed: The learner has not met the required standard.\n\nCompletion of M11 demonstrates the learner’s ability to assess a simulated export transaction. It does not certify that the learner’s business is legally approved to export, that a buyer is creditworthy, that financing is available or that a real transaction will succeed.\n\nM11 final learner output: A complete transaction assessment file and a justified commercial decision on whether to proceed, hold, renegotiate or decline the simulated opportunity.",
    },
    {
      id: "gate-1",
      title: "Opportunity validation",
      body: "**Question:** Is this a credible buyer opportunity worth pursuing?\n\nLearners must:\n\n- Review the buyer enquiry and available business information.\n- Identify the buyer’s legal identity and contact details requiring verification.\n- Establish whether the buyer is an importer, distributor, wholesaler, retailer or another type of customer.\n- Identify the actual products of interest.\n- Clarify estimated or confirmed quantities.\n- Identify the intended destination market and delivery location.\n- Establish the buyer’s intended purchasing timeline.\n- Identify the next commercial action required.\n\n**Required decision:** Proceed with qualification, request more information or stop engagement.\n\n**Evidence:** Buyer information, enquiry record and a list of unresolved questions.\n\n## Case file: documents for this gate\n\nThis is a fictional training document. The businesses, people and figures are made up.\n\n### Document A: the enquiry\n\n> From: eastland.procurement@webmail.example\n\n> Dear Sir, we are Eastland, a leading supplier of industrial goods across East Africa. We have a confirmed order for 2,000 work suits if your price is right. Send your best price this week so we can issue the purchase order. Regards, J. Mwangi, Purchasing.\n\n### Document B: what Addis Workwear's sales officer found\n\n| Source | Finding |\n| --- | --- |\n| A trade directory | \"Eastland Industrial Supply Ltd\", Mombasa, listed in 2022, no website |\n| The email signature on a later message | \"Eastland Industrial Supplies\", Nairobi |\n| Company registration | Not requested yet |\n| Trade references | None supplied |\n| J. Mwangi's authority to buy | Not known |",
    },
    {
      id: "gate-2",
      title: "Buyer requirements and order validation",
      body: "**Question:** Does the SME understand what the buyer is asking it to supply?\n\nLearners must identify and record:\n\n- Product type and description.\n- Product specifications and technical requirements.\n- Sizes, dimensions, materials or other relevant characteristics.\n- Branding, labelling and packaging expectations.\n- Quality standards and inspection requirements.\n- Quantity and order structure.\n- Delivery location and expected delivery date.\n- Required documents and buyer-specific conditions.\n- Payment expectations and proposed commercial terms.\n\nLearners must distinguish between confirmed requirements and assumptions.\n\n**Required decision:** Confirm that the specification is sufficiently clear to prepare a reliable quotation, or request clarification.\n\n**Evidence:** Buyer requirements and specification checklist.\n\n## Case file: documents for this gate\n\n### Document C: the buyer's follow-up message\n\n> We need 2,000 two-piece work suits in navy, fabric 65% polyester and 35% cotton at 240 gsm, in a standard size mix. Add reflective tape to safety standards and our logo embroidered on the chest. Pack each suit in a bag, with 20 in a carton.\n\n> Price CIF Nairobi, target USD 9.00 per suit. Delivery to our Nairobi warehouse within 45 days of order. Our agent will inspect the goods. Payment 30 days after we receive the goods. Send the invoice, packing list, certificate of origin and whatever else is needed.",
    },
    {
      id: "gate-3",
      title: "Product, quality and fulfilment assessment",
      body: "**Question:** Can the SME produce and supply what the buyer requires?\n\nLearners must:\n\n- Compare the buyer’s specifications with the SME’s current products.\n- Identify product changes or customization required.\n- Assess material availability.\n- Identify production processes and quality controls.\n- Establish whether samples or pre-production approval are required.\n- Identify inspection, testing or certification requirements requiring verification.\n- Record any production or quality limitations.\n- Identify the consequences of failing to meet the buyer’s specifications.\n\n**Required decision:** Confirm product suitability, identify modifications or determine that the product cannot currently meet the requirement.\n\n**Evidence:** Product suitability and quality assessment.\n\n## Case file: documents for this gate\n\n### Document D: Addis Workwear's product and quality file\n\n| Item | What the file shows |\n| --- | --- |\n| Standard product | Two-piece work suit, navy, 65/35 poly-cotton at 210 gsm |\n| 240 gsm fabric | Not used before. One supplier has offered it, and no sample has been received |\n| Reflective tape | Not used before. Which safety standard the buyer means isn't known |\n| Embroidery | Done by a subcontractor, ETB 40 per piece, not tried on this fabric |\n| Quality control | In-line checks and a final check, recorded on paper. Rejects ran at 3% last quarter |\n| Testing or certificates | None held for this product |\n| Pre-production sample | The buyer hasn't said whether it wants one |",
    },
    {
      id: "gate-4",
      title: "Costing and commercial viability",
      body: "**Question:** Can the SME supply the order at a commercially acceptable margin?\n\nLearners must review or prepare the transaction costing, including applicable cost categories:\n\n- Raw materials and inputs.\n- Direct labour.\n- Production overhead.\n- Packaging and labelling.\n- Quality inspection and testing.\n- Inland transport and handling.\n- Export documentation and processing costs.\n- Customs-related charges where applicable.\n- Freight and insurance, depending on the agreed delivery term.\n- Bank charges and payment-related costs.\n- Other transaction-specific costs.\n\nLearners must:\n\n1. Identify the applicable currency.\n2. Confirm the quotation basis and delivery term.\n3. Separate known costs from estimates.\n4. Calculate the total estimated transaction cost.\n5. Determine the proposed selling price.\n6. Calculate the expected gross contribution or margin using the supplied figures.\n7. Identify costs that could change before shipment.\n8. Record the minimum commercial conditions under which the SME would accept the order.\n\n**Required decision:** Proceed with a quotation, revise the price, renegotiate the terms or decline the opportunity.\n\n**Evidence:** Completed export costing worksheet and quotation assumptions.\n\n## Case file: documents for this gate\n\n### Document E: the finance manager's draft cost sheet\n\nFor 2,000 suits. Figures are the finance manager's, and some aren't confirmed.\n\n| Cost item | ETB | Basis |\n| --- | --- | --- |\n| Fabric and materials | 900,000 | Supplier quotation, valid 14 days |\n| Reflective tape and embroidery | 120,000 | Estimate |\n| Direct labour | 360,000 | Internal figure |\n| Production overhead | 180,000 | Internal figure |\n| Packaging and labelling | 70,000 | Internal figure |\n| Quality inspection | 30,000 | Internal figure |\n| Inland transport and handling | 50,000 | Estimate |\n| Export documentation and processing | 40,000 | Estimate |\n| Total on the sheet | 1,750,000 | |\n\nSeparate notes in the file:\n\n- A forwarder quoted USD 3,200 for road transport to Nairobi. It excludes border charges and cargo insurance, and it is not on the sheet.\n- The bank's charges are about 1% of the transaction value. They are not on the sheet.\n- Assume ETB 120 per USD for this exercise. It is illustrative, not a current rate.\n- The finance manager's note says: \"At USD 9.00 we make about 19%, so this looks fine.\"",
    },
    {
      id: "gate-5",
      title: "Production capacity and delivery planning",
      body: "**Question:** Can the SME fulfil the order within the buyer’s required timeframe?\n\nLearners must:\n\n- Compare order requirements with available production capacity.\n- Identify current production commitments.\n- Review availability of raw materials and other inputs.\n- Identify equipment, labour or infrastructure constraints.\n- Establish the production lead time.\n- Identify quality-control and inspection milestones.\n- Determine packaging and dispatch requirements.\n- Build a delivery schedule.\n- Identify contingency measures for delays or shortages.\n\n**Required decision:** Confirm achievable capacity and timeline, propose an alternative schedule or identify the investment or operational changes required.\n\n**Evidence:** Production and fulfilment plan.\n\n## Case file: documents for this gate\n\n### Document F: the production manager's note\n\n| Item | Position |\n| --- | --- |\n| Normal output | 50 suits a working day, 6 working days a week |\n| Output with overtime | 55 suits a working day |\n| Existing commitment | A domestic order of 600 suits, taking the next 12 working days |\n| Fabric | 21 days from order to arrival, and the supplier wants a 50% advance |\n| Final inspection and packing | 3 working days after production ends |\n| Road transit to Nairobi | 7 to 10 days, according to the forwarder |\n| Spare capacity for a subcontractor | None arranged |",
    },
    {
      id: "gate-6",
      title: "Export requirements and shipment preparation",
      body: "**Question:** What must be verified and completed before the goods can legally and practically be shipped?\n\nLearners must identify the requirements relevant to the specific product, origin, destination and transaction.\n\nThe learner should consider:\n\n- Exporter eligibility and applicable registration.\n- Product-specific export controls or restrictions.\n- Destination-market import requirements.\n- Product standards, testing or certification.\n- Labelling and packaging requirements.\n- Customs declarations and supporting documents.\n- Commercial invoice and packing list.\n- Certificate of origin, where required.\n- Transport and insurance documentation.\n- Buyer-specific documentation.\n- Customs broker, freight forwarder and other service-provider responsibilities.\n\nLearners must not assume that a document or certification is required simply because it is common in another transaction. Requirements must be checked against authoritative and current sources.\n\n**Required decision:** Identify the requirements that are confirmed, those requiring verification and any unresolved issue that could prevent shipment.\n\n**Evidence:** Export requirements and document checklist.\n\n## Case file: documents for this gate\n\n### Document G: the export officer's file note\n\n| Item | Status in the file |\n| --- | --- |\n| Export registration | The licence on file covers manufacturing. Export registration not confirmed |\n| Product classification (HS code) | A colleague suggested one. Not verified |\n| Kenyan import requirements for workwear | Not checked |\n| Reflective tape standard | Not known |\n| Certificate of origin | The buyer asks for one. Whether preferential treatment applies isn't checked |\n| Buyer's statement | \"It enters duty-free, no problem.\" No evidence supplied |\n| Customs broker | Used once before, not contacted for this order |\n| Delivery term | The buyer wrote CIF Nairobi. Nairobi has no sea port |",
    },
    {
      id: "gate-7",
      title: "Finance, payment and risk assessment",
      body: "**Question:** Can the SME manage the financial exposure and transaction risks?\n\nLearners must examine:\n\n- Payment method proposed by the buyer.\n- Payment timing and conditions.\n- Buyer creditworthiness and verification.\n- Currency and foreign-exchange exposure.\n- Working capital required before payment is received.\n- Cash-flow implications of production and shipment.\n- Potential financing requirements.\n- Bank documentation and transaction requirements.\n- Cargo, property, machinery or other relevant insurance exposures.\n- Transport, quality, delivery and non-payment risks.\n\nLearners must identify risk controls appropriate to the transaction. These may include payment advances, staged payments, documentary arrangements, buyer verification, credit limits, inspection, cargo insurance or revised contractual terms.\n\nThe learner must not assume that a bank will approve finance or that an insurer will cover a risk. Those decisions require the relevant institution’s assessment.\n\n**Required decision:** Confirm whether the financial and risk conditions are acceptable, identify conditions that must be negotiated or recommend holding the transaction.\n\n**Evidence:** Transaction finance and risk assessment.\n\n## Case file: documents for this gate\n\n### Document H: the finance manager's note\n\n| Item | Position |\n| --- | --- |\n| Cash available | ETB 650,000 |\n| Working capital facility | An informal talk with the bank. No application, no approval |\n| Payment proposed by the buyer | 30 days after receiving the goods |\n| Payment protection offered | None |\n| Buyer's credit information | None |\n| Quotation currency and cost currency | USD and ETB |\n| Insurance | Fire cover on the factory and machinery. No cargo cover. No insurer approached about this order |",
    },
    {
      id: "gate-8",
      title: "Final transaction decision and execution plan",
      body: "**Question:** Should the SME proceed, hold, renegotiate or decline?\n\nLearners must consolidate the findings from Gates 1–7 and prepare a final recommendation.\n\nThe recommendation must include:\n\n- Summary of the opportunity.\n- Buyer and order status.\n- Product and specification status.\n- Costing and commercial viability.\n- Production and delivery feasibility.\n- Export requirements and outstanding verification.\n- Payment and financing position.\n- Key risks and proposed controls.\n- Outstanding information.\n- Action owners and deadlines.\n- Conditions that must be satisfied before the next transaction stage.\n\nThe learner must select one of four decisions:\n\nPROCEED: Sufficient evidence exists to advance the transaction to the next agreed stage, subject to any stated routine controls.\n\nHOLD: A material information or verification gap must be resolved before the transaction advances.\n\nRENEGOTIATE: The opportunity may be viable if price, quantity, specification, delivery, payment or other terms are changed.\n\nNO-GO: The opportunity is commercially, operationally or otherwise unsuitable under the available conditions.\n\n**Evidence:** Final transaction decision and execution plan.\n\n## Case file: the buyer's last message\n\n> Our customer is waiting. Confirm today and start production so we don't lose this. We will send the purchase order when your price is agreed. Do not worry about the paperwork, our agent handles everything.",
    },
  ],
  workedExample: {
    title: "Addis Workwear PLC and Eastland Industrial Supplies",
    body: "Addis Workwear PLC is an Ethiopian manufacturer of workwear and uniforms. The business has received a commercial enquiry from Eastland Industrial Supplies, a prospective international buyer interested in sourcing workwear.\n\nThe buyer has expressed interest in purchasing products from the manufacturer. The SME must determine whether the opportunity is sufficiently clear, commercially viable and operationally achievable to proceed.\n\nThe learner acts as the SME’s transaction lead.\n\nThe case materials supplied through the platform should contain the available buyer communication, product information, business records, costing information and operational details. Some information may be incomplete or require verification.\n\nImportant simulation rule: Learners must not invent missing transaction facts. They must identify what is missing, explain why it matters, assign responsibility for obtaining it and determine whether the transaction can proceed before the gap is resolved.\n\n### Roles in the simulation\n\n| Role | Responsibility |\n| --- | --- |\n| SME transaction lead | Coordinates the transaction assessment and recommendation |\n| Buyer representative | Clarifies product requirements, quantities, delivery expectations and commercial terms |\n| Production manager | Confirms capacity, materials, production schedule and quality controls |\n| Finance manager | Reviews costs, cash flow, working capital and payment exposure |\n| Export/compliance officer | Identifies requirements that must be verified for the product and destination |\n| Logistics provider | Provides shipment options, documentation requirements and cost information |\n| Assessor/facilitator | Introduces case information, evaluates decisions and records performance |\n\nOne learner may perform several roles in a small group. Each learner must still demonstrate individual understanding during the final assessment.",
  },
  worksheets: [
    {
      id: "buyer_opportunity",
      title: "Buyer Opportunity Assessment",
      description: "Gate 1: Opportunity validation.",
      fields: [
        {
          id: "buyer_profile",
          label: "Buyer profile",
          kind: "long_text",
          required: true,
        },
        {
          id: "enquiry_summary",
          label: "Enquiry summary",
          kind: "long_text",
          required: true,
        },
        {
          id: "verification_needs",
          label: "Verification needs",
          kind: "long_text",
          required: true,
        },
        {
          id: "opportunity_status",
          label: "Opportunity status",
          kind: "text",
        },
        {
          id: "outstanding_questions",
          label: "Outstanding questions",
          kind: "long_text",
          required: true,
        },
        {
          id: "decision",
          label: "Gate 1 decision",
          kind: "choice",
          required: true,
          options: [
            {
              value: "proceed_with_qualification",
              label: "Proceed with qualification",
            },
            {
              value: "request_more_information",
              label: "Request more information",
            },
            {
              value: "stop_engagement",
              label: "Stop engagement",
            },
          ],
        },
      ],
      tables: [],
      computed: [],
    },
    {
      id: "requirements_sheet",
      title: "Buyer Requirements and Specification Sheet",
      description: "Gate 2: Buyer requirements and order validation.",
      fields: [
        {
          id: "product",
          label: "Product",
          kind: "long_text",
          required: true,
        },
        {
          id: "quantity",
          label: "Quantity",
          kind: "long_text",
          required: true,
        },
        {
          id: "technical",
          label: "Technical requirements",
          kind: "long_text",
          required: true,
        },
        {
          id: "quality",
          label: "Quality",
          kind: "long_text",
        },
        {
          id: "packaging",
          label: "Packaging",
          kind: "long_text",
        },
        {
          id: "delivery",
          label: "Delivery",
          kind: "long_text",
        },
        {
          id: "payment",
          label: "Payment expectations",
          kind: "long_text",
        },
        {
          id: "assumptions",
          label: "Which requirements are confirmed, and which are assumptions",
          kind: "long_text",
          required: true,
        },
        {
          id: "decision",
          label: "Gate 2 decision",
          kind: "choice",
          required: true,
          options: [
            {
              value: "specification_clear_enough_to_prepare_a_reliable_quotation",
              label: "Specification clear enough to prepare a reliable quotation",
            },
            {
              value: "request_clarification",
              label: "Request clarification",
            },
          ],
        },
      ],
      tables: [],
      computed: [],
    },
    {
      id: "product_quality",
      title: "Product and Quality Assessment",
      description: "Gate 3: Product, quality and fulfilment assessment.",
      fields: [
        {
          id: "suitability",
          label: "Product suitability",
          kind: "long_text",
          required: true,
        },
        {
          id: "modifications",
          label: "Modifications",
          kind: "long_text",
        },
        {
          id: "quality_controls",
          label: "Quality controls",
          kind: "long_text",
          required: true,
        },
        {
          id: "samples",
          label: "Samples",
          kind: "long_text",
        },
        {
          id: "unresolved",
          label: "Unresolved requirements",
          kind: "long_text",
        },
        {
          id: "decision",
          label: "Gate 3 decision",
          kind: "choice",
          required: true,
          options: [
            {
              value: "product_suitable",
              label: "Product suitable",
            },
            {
              value: "modifications_identified",
              label: "Modifications identified",
            },
            {
              value: "product_cannot_currently_meet_the_requirement",
              label: "Product cannot currently meet the requirement",
            },
          ],
        },
      ],
      tables: [],
      computed: [],
    },
    {
      id: "costing_quotation",
      title: "Export Costing and Quotation Worksheet",
      description: "Gate 4: Costing and commercial viability.",
      fields: [
        {
          id: "currency",
          label: "Currency",
          kind: "text",
          required: true,
        },
        {
          id: "delivery_term",
          label: "Quotation basis and delivery term",
          kind: "text",
          required: true,
        },
        {
          id: "total_cost",
          label: "Total estimated transaction cost",
          kind: "money",
          required: true,
        },
        {
          id: "selling_price",
          label: "Proposed selling price",
          kind: "money",
          required: true,
        },
        {
          id: "margin",
          label: "Expected gross contribution or margin",
          kind: "text",
          required: true,
        },
        {
          id: "assumptions",
          label: "Quotation assumptions",
          kind: "long_text",
          required: true,
        },
        {
          id: "changing_costs",
          label: "Costs that could change before shipment",
          kind: "long_text",
        },
        {
          id: "minimum_conditions",
          label: "The minimum commercial conditions under which the SME would accept the order",
          kind: "long_text",
          required: true,
        },
        {
          id: "decision",
          label: "Gate 4 decision",
          kind: "choice",
          required: true,
          options: [
            {
              value: "proceed_with_a_quotation",
              label: "Proceed with a quotation",
            },
            {
              value: "revise_the_price",
              label: "Revise the price",
            },
            {
              value: "renegotiate_the_terms",
              label: "Renegotiate the terms",
            },
            {
              value: "decline_the_opportunity",
              label: "Decline the opportunity",
            },
          ],
        },
      ],
      tables: [
        {
          id: "costs",
          label: "Cost categories",
          columns: [
            {
              id: "category",
              label: "Cost category",
              kind: "text",
              required: true,
            },
            {
              id: "amount",
              label: "Amount",
              kind: "money",
            },
            {
              id: "basis",
              label: "Known or estimate",
              kind: "choice",
              required: true,
              options: [
                {
                  value: "known",
                  label: "Known",
                },
                {
                  value: "estimate",
                  label: "Estimate",
                },
              ],
            },
          ],
          minRows: 1,
        },
      ],
      computed: [],
    },
    {
      id: "fulfilment_plan",
      title: "Production and Fulfilment Plan",
      description: "Gate 5: Production capacity and delivery planning.",
      fields: [
        {
          id: "capacity",
          label: "Capacity",
          kind: "long_text",
          required: true,
        },
        {
          id: "inputs",
          label: "Inputs",
          kind: "long_text",
          required: true,
        },
        {
          id: "schedule",
          label: "Production schedule",
          kind: "long_text",
          required: true,
        },
        {
          id: "quality_milestones",
          label: "Quality milestones",
          kind: "long_text",
        },
        {
          id: "delivery_plan",
          label: "Delivery plan",
          kind: "long_text",
          required: true,
        },
        {
          id: "contingency",
          label: "Contingency measures for delays or shortages",
          kind: "long_text",
        },
        {
          id: "decision",
          label: "Gate 5 decision",
          kind: "choice",
          required: true,
          options: [
            {
              value: "capacity_and_timeline_achievable",
              label: "Capacity and timeline achievable",
            },
            {
              value: "propose_an_alternative_schedule",
              label: "Propose an alternative schedule",
            },
            {
              value: "investment_or_operational_changes_required",
              label: "Investment or operational changes required",
            },
          ],
        },
      ],
      tables: [],
      computed: [],
    },
    {
      id: "requirements_checklist",
      title: "Export Requirements and Document Checklist",
      description: "Gate 6: Export requirements and shipment preparation.",
      fields: [
        {
          id: "decision",
          label: "Gate 6 decision: what is confirmed, what requires verification, and any issue that could prevent shipment",
          kind: "long_text",
          required: true,
        },
      ],
      tables: [
        {
          id: "requirements",
          label: "Requirements",
          columns: [
            {
              id: "requirement",
              label: "Requirement",
              kind: "text",
              required: true,
            },
            {
              id: "source",
              label: "Source",
              kind: "text",
            },
            {
              id: "status",
              label: "Verification status",
              kind: "choice",
              required: true,
              options: [
                {
                  value: "confirmed",
                  label: "Confirmed",
                },
                {
                  value: "requires_verification",
                  label: "Requires verification",
                },
                {
                  value: "unresolved",
                  label: "Unresolved",
                },
              ],
            },
            {
              id: "responsible",
              label: "Responsible party",
              kind: "text",
            },
            {
              id: "outstanding",
              label: "Outstanding action",
              kind: "text",
            },
          ],
          minRows: 1,
        },
      ],
      computed: [],
    },
    {
      id: "finance_risk",
      title: "Transaction Finance and Risk Assessment",
      description: "Gate 7: Finance, payment and risk assessment.",
      fields: [
        {
          id: "payment_terms",
          label: "Payment terms",
          kind: "long_text",
          required: true,
        },
        {
          id: "working_capital",
          label: "Working capital",
          kind: "long_text",
          required: true,
        },
        {
          id: "exposure",
          label: "Financial exposure",
          kind: "long_text",
          required: true,
        },
        {
          id: "decision",
          label: "Gate 7 decision",
          kind: "choice",
          required: true,
          options: [
            {
              value: "financial_and_risk_conditions_acceptable",
              label: "Financial and risk conditions acceptable",
            },
            {
              value: "conditions_must_be_negotiated",
              label: "Conditions must be negotiated",
            },
            {
              value: "hold_the_transaction",
              label: "Hold the transaction",
            },
          ],
        },
      ],
      tables: [
        {
          id: "risks",
          label: "Risks and proposed controls",
          columns: [
            {
              id: "risk",
              label: "Risk",
              kind: "text",
              required: true,
            },
            {
              id: "control",
              label: "Proposed control",
              kind: "long_text",
              required: true,
            },
          ],
          minRows: 1,
        },
      ],
      computed: [],
    },
    {
      id: "action_plan",
      title: "Transaction Action and Responsibility Plan",
      description: "Gate 8: Final transaction decision and execution plan.",
      fields: [],
      tables: [
        {
          id: "actions",
          label: "Actions",
          columns: [
            {
              id: "action",
              label: "Action",
              kind: "text",
              required: true,
            },
            {
              id: "owner",
              label: "Owner",
              kind: "text",
              required: true,
            },
            {
              id: "deadline",
              label: "Deadline",
              kind: "date",
              required: true,
            },
            {
              id: "dependencies",
              label: "Dependencies",
              kind: "text",
            },
            {
              id: "evidence",
              label: "Completion evidence",
              kind: "text",
            },
          ],
          minRows: 1,
        },
      ],
      computed: [],
    },
    {
      id: "decision_report",
      title: "Final Transaction Decision Report",
      description: "Gate 8: Final transaction decision and execution plan.",
      fields: [
        {
          id: "decision",
          label: "Your decision",
          kind: "choice",
          required: true,
          options: [
            {
              value: "proceed",
              label: "Proceed",
            },
            {
              value: "hold",
              label: "Hold",
            },
            {
              value: "renegotiate",
              label: "Renegotiate",
            },
            {
              value: "no_go",
              label: "No-go",
            },
          ],
        },
        {
          id: "justification",
          label: "Justification",
          kind: "long_text",
          required: true,
        },
        {
          id: "summary",
          label: "Summary of the opportunity, buyer and order status, product, costing, production, export requirements, payment and key risks",
          kind: "long_text",
          required: true,
        },
        {
          id: "outstanding",
          label: "Outstanding information",
          kind: "long_text",
        },
        {
          id: "conditions",
          label: "Conditions that must be satisfied before the next transaction stage",
          kind: "long_text",
          required: true,
        },
        {
          id: "next_steps",
          label: "Next steps",
          kind: "long_text",
          required: true,
        },
      ],
      tables: [],
      computed: [],
    },
    {
      id: "individual_learning_plan",
      title: "Individual Learning Plan",
      description: "An improvement plan based on your assessment results.",
      fields: [],
      tables: [
        {
          id: "gaps",
          label: "Improvements",
          columns: [
            {
              id: "gap",
              label: "Identified gap",
              kind: "long_text",
              required: true,
            },
            {
              id: "improvement",
              label: "Required improvement",
              kind: "long_text",
              required: true,
            },
            {
              id: "owner",
              label: "Suggested owner",
              kind: "text",
            },
            {
              id: "target_date",
              label: "Target date",
              kind: "date",
            },
            {
              id: "evidence",
              label: "Evidence of completion",
              kind: "text",
            },
          ],
          minRows: 1,
        },
      ],
      computed: [],
    },
  ],
  knowledgeCheck: {
    passMark: 80,
    questions: [
      {
        id: "q1",
        text: "A buyer sends an enquiry but has not provided a verified company identity or complete product requirements. What should the SME do first?",
        options: [
          {
            id: "a",
            text: "Begin production planning.",
          },
          {
            id: "b",
            text: "Issue a final quotation based on assumptions.",
          },
          {
            id: "c",
            text: "Qualify the buyer and clarify the missing requirements.",
          },
          {
            id: "d",
            text: "Accept the order.",
          },
        ],
        correct: [
          "c",
        ],
        explanation: "The SME should establish who the buyer is and clarify the commercial requirement before making commitments.",
        lessonId: "gate-1",
      },
      {
        id: "q2",
        text: "Which statement best describes an unverified buyer claim?",
        options: [
          {
            id: "a",
            text: "It can be treated as confirmed if the buyer sounds credible.",
          },
          {
            id: "b",
            text: "It should be recorded as an assumption until supporting evidence is obtained.",
          },
          {
            id: "c",
            text: "It can be omitted from the transaction record.",
          },
          {
            id: "d",
            text: "It should be treated as a confirmed order.",
          },
        ],
        correct: [
          "b",
        ],
        explanation: "The transaction record must distinguish verified information from assumptions.",
        lessonId: "gate-1",
      },
      {
        id: "q3",
        text: "The buyer requests a product specification that differs from the SME’s standard product. What should happen before a firm commitment?",
        options: [
          {
            id: "a",
            text: "The SME should assume the difference is minor.",
          },
          {
            id: "b",
            text: "The SME should assess the required modification, cost, quality implications and production feasibility.",
          },
          {
            id: "c",
            text: "The SME should promise delivery immediately.",
          },
          {
            id: "d",
            text: "The SME should ignore the specification.",
          },
        ],
        correct: [
          "b",
        ],
        lessonId: "gate-2",
      },
      {
        id: "q4",
        text: "Why should the SME record buyer requirements in a structured specification sheet?",
        options: [
          {
            id: "a",
            text: "To replace the sales agreement.",
          },
          {
            id: "b",
            text: "To avoid discussing requirements with the buyer.",
          },
          {
            id: "c",
            text: "To create a clear reference for costing, production, quality and fulfilment.",
          },
          {
            id: "d",
            text: "To guarantee payment.",
          },
        ],
        correct: [
          "c",
        ],
        lessonId: "gate-2",
      },
      {
        id: "q5",
        text: "A quotation excludes packaging and inland transport costs that the SME will have to pay. What is the likely consequence?",
        options: [
          {
            id: "a",
            text: "The transaction margin may be overstated.",
          },
          {
            id: "b",
            text: "The buyer automatically pays those costs.",
          },
          {
            id: "c",
            text: "The export requirements become simpler.",
          },
          {
            id: "d",
            text: "The production capacity increases.",
          },
        ],
        correct: [
          "a",
        ],
        lessonId: "gate-4",
      },
      {
        id: "q6",
        text: "The buyer requests delivery within a timeframe that exceeds the SME’s confirmed production capacity. What is the best response?",
        options: [
          {
            id: "a",
            text: "Accept the date and resolve the problem later.",
          },
          {
            id: "b",
            text: "Ignore existing production commitments.",
          },
          {
            id: "c",
            text: "Review capacity and propose a realistic alternative or renegotiate.",
          },
          {
            id: "d",
            text: "Ship incomplete goods.",
          },
        ],
        correct: [
          "c",
        ],
        lessonId: "gate-5",
      },
      {
        id: "q7",
        text: "Why should export requirements be checked for the specific product and destination?",
        options: [
          {
            id: "a",
            text: "All products have identical export requirements.",
          },
          {
            id: "b",
            text: "Requirements may vary by product, destination and transaction.",
          },
          {
            id: "c",
            text: "The buyer is always responsible for every requirement.",
          },
          {
            id: "d",
            text: "A previous shipment guarantees that the next shipment has identical requirements.",
          },
        ],
        correct: [
          "b",
        ],
        lessonId: "gate-6",
      },
      {
        id: "q8",
        text: "A buyer proposes payment after receiving the goods, but the SME cannot absorb the risk of non-payment. What should the SME do?",
        options: [
          {
            id: "a",
            text: "Accept the terms without assessment.",
          },
          {
            id: "b",
            text: "Review buyer risk and negotiate appropriate payment protections.",
          },
          {
            id: "c",
            text: "Ignore the payment condition.",
          },
          {
            id: "d",
            text: "Assume insurance will cover every loss.",
          },
        ],
        correct: [
          "b",
        ],
        lessonId: "gate-7",
      },
      {
        id: "q9",
        text: "The transaction appears commercially attractive, but the destination-market product requirements have not been verified. What is the most defensible decision?",
        options: [
          {
            id: "a",
            text: "Proceed without conditions.",
          },
          {
            id: "b",
            text: "Hold the transaction until the relevant requirements are verified.",
          },
          {
            id: "c",
            text: "Record the requirements as completed.",
          },
          {
            id: "d",
            text: "Start shipment preparation immediately.",
          },
        ],
        correct: [
          "b",
        ],
        lessonId: "gate-8",
      },
      {
        id: "q10",
        text: "Which of the following is an acceptable final transaction decision?",
        options: [
          {
            id: "a",
            text: "Proceed only.",
          },
          {
            id: "b",
            text: "Proceed or cancel only.",
          },
          {
            id: "c",
            text: "Proceed, hold, renegotiate or no-go, supported by evidence.",
          },
          {
            id: "d",
            text: "Accept every buyer order.",
          },
        ],
        correct: [
          "c",
        ],
        lessonId: "gate-8",
      },
    ],
  },
  rubric: {
    criteria: [
      {
        id: "opportunity_and_buyer_assessment",
        title: "Opportunity and buyer assessment",
        description: "Buyer qualification, opportunity clarity, verification and identification of missing information",
        maxPoints: 6,
        mustHave: false,
      },
      {
        id: "product_and_requirements_assessment",
        title: "Product and requirements assessment",
        description: "Understanding of buyer specifications, product suitability, quality and export requirements",
        maxPoints: 6,
        mustHave: false,
      },
      {
        id: "costing_and_commercial_judgement",
        title: "Costing and commercial judgement",
        description: "Cost completeness, assumptions, margin reasoning and commercial viability",
        maxPoints: 6,
        mustHave: false,
      },
      {
        id: "production_and_fulfilment_planning",
        title: "Production and fulfilment planning",
        description: "Capacity analysis, production schedule, inputs, quality controls and delivery feasibility",
        maxPoints: 6,
        mustHave: false,
      },
      {
        id: "finance_and_risk_management",
        title: "Finance and risk management",
        description: "Payment exposure, working capital, financing considerations, risk identification and controls",
        maxPoints: 6,
        mustHave: false,
      },
      {
        id: "final_decision_and_execution_planning",
        title: "Final decision and execution planning",
        description: "Evidence-based decision, action ownership, deadlines, dependencies and practical next steps",
        maxPoints: 6,
        mustHave: false,
      },
    ],
    passMark: 24,
    mustHaveMinimum: 0,
    bands: [
      {
        label: "No demonstrated capability",
        from: 0,
      },
      {
        label: "Very limited",
        from: 1,
      },
      {
        label: "Partial",
        from: 33,
      },
      {
        label: "Functional",
        from: 50,
      },
      {
        label: "Good",
        from: 67,
      },
      {
        label: "Strong",
        from: 83,
      },
      {
        label: "Excellent",
        from: 100,
      },
    ],
    criticalFailures: [
      {
        id: "cf1",
        text: "Knowingly treats an unverified buyer or order as confirmed.",
      },
      {
        id: "cf2",
        text: "Makes a material commercial commitment based on invented or unsupported information.",
      },
      {
        id: "cf3",
        text: "Ignores a known production constraint that makes fulfilment impossible.",
      },
      {
        id: "cf4",
        text: "Recommends shipment without addressing a material unresolved legal or regulatory requirement.",
      },
      {
        id: "cf5",
        text: "Ignores a material payment or financial risk that could make the transaction unviable.",
      },
      {
        id: "cf6",
        text: "Misrepresents the evidence or knowingly submits fabricated supporting information.",
      },
    ],
  },
  aiPrompts: [],
  staff: {
    facilitatorGuide: "## Facilitator instructions\n\nThe facilitator should not solve the transaction for the learner.\n\nInstead, introduce the case information in stages, ask questions and challenge unsupported conclusions.\n\nSuggested prompts:\n\n- What do we know, and what are we assuming?\n- What evidence would confirm the buyer is credible?\n- What exactly has the buyer agreed to purchase?\n- Can the SME produce this product to the required specification?\n- Which costs have not yet been included?\n- What would happen if production is delayed?\n- Which export requirements have been verified?\n- Can the SME finance production before receiving payment?\n- What would make you change your recommendation?\n- What must happen before the next transaction stage?\n\nThe facilitator should document significant decisions, reasoning and evidence. The final assessment must evaluate the learner’s own work, not the facilitator’s explanation.\n\n## Assessor scoring guide\n\n| Score | Performance description |\n| --- | --- |\n| 0 | No submission or no demonstrated capability |\n| 1 | Very limited understanding; major errors or unsupported assumptions |\n| 2 | Partial understanding; significant gaps remain |\n| 3 | Functional response; basic requirements addressed but important weaknesses remain |\n| 4 | Good response; sound analysis with minor gaps |\n| 5 | Strong response; well-supported decisions and practical controls |\n| 6 | Excellent response; complete, accurate, evidence-based and commercially practical |\n\nThe assessor must record the specific failure and explain the reason. A critical failure results in an unsuccessful assessment regardless of the numerical score.\n\n## Case material notes\n\nWritten by the platform team, not Entrust. Release one gate's documents at a time. The facilitator shouldn't solve it, and there's more than one defensible decision.\n\n**Gate 1:** webmail address, company name and city differ between sources, no registration, no references, \"confirmed order\" is unsupported.\n\n**Gate 2:** size mix, safety standard and logo details are unclear. CIF is a sea term, and Nairobi is inland. Agent inspection is undefined. \"Whatever else is needed\" is not a document list.\n\n**Gate 3:** the buyer's fabric is heavier than the standard product, and tape and embroidery are untested. Samples should be raised.\n\n**Gate 4:** the sheet's 19% is (2,160,000 - 1,750,000) / 2,160,000. Adding freight of ETB 384,000 and bank charges of about ETB 21,600 gives ETB 2,155,600, leaving about ETB 4,400, or 0.2%, before insurance, border charges and finance. The learner must not invent the missing figures.\n\n**Gate 5:** fabric arrives on day 21. At 55 a day, 2,000 suits take about 37 working days, about 43 calendar days, so production ends around day 64. Inspection and packing take it to about day 67, and transit to about day 74 to 77, against 45 days. Fabric timing means the domestic order is finished first.\n\n**Gate 6:** nothing here is verified, and the delivery term needs correcting.\n\n**Gate 7:** roughly ETB 2.1 million goes out before payment, against ETB 650,000 of cash, and payment arrives after about day 104 on open terms with an unverified buyer. The bank and insurer haven't assessed anything.\n\n**Gate 8:** the pressure to start without a purchase order is the test. HOLD or RENEGOTIATE are the likely defensible decisions, and NO-GO can be if well argued. PROCEED without conditions would point to a critical failure: treating an unverified buyer as confirmed, ignoring a known production constraint, or ignoring a material payment risk.",
    liveSessionPlan: "### Duration: 180 minutes\n\n| Time | Activity | Facilitator responsibility | Learner output |\n| --- | --- | --- | --- |\n| 0–10 min | Opening and simulation briefing | Explain objectives, case, roles and assessment rules | Understanding of the exercise |\n| 10–30 min | Gate 1: Opportunity validation | Introduce buyer enquiry and ask learners to identify missing information | Buyer Opportunity Assessment |\n| 30–50 min | Gate 2: Buyer requirements | Challenge unclear specifications and commercial terms | Requirements and Specification Sheet |\n| 50–70 min | Gate 3: Product and quality | Introduce product suitability and quality questions | Product and Quality Assessment |\n| 70–95 min | Gate 4: Costing | Ask learners to examine cost assumptions and commercial viability | Costing and Quotation Worksheet |\n| 95–105 min | Break |  |  |\n| 105–125 min | Gate 5: Production | Introduce capacity and delivery constraints from the case materials | Production and Fulfilment Plan |\n| 125–145 min | Gate 6: Export requirements | Ask learners to distinguish confirmed requirements from items requiring verification | Export Requirements Checklist |\n| 145–160 min | Gate 7: Finance and risk | Challenge payment, working capital and insurance assumptions | Finance and Risk Assessment |\n| 160–175 min | Gate 8: Final decision | Require each learner or team to defend its recommendation | Final Transaction Decision Report |\n| 175–180 min | Debrief and next steps | Explain assessment, feedback and resubmission process | Individual improvement priorities |",
    hybridSequence: "The online version should be divided into short, manageable learning segments.\n\n| Segment | Content | Required activity |\n| --- | --- | --- |\n| 1 | Introduction to the transaction simulation | Review the case and assigned role |\n| 2 | Opportunity and buyer validation | Complete Gate 1 |\n| 3 | Buyer requirements and product suitability | Complete Gates 2 and 3 |\n| 4 | Costing and commercial viability | Complete Gate 4 |\n| 5 | Production and fulfilment | Complete Gate 5 |\n| 6 | Export requirements and documentation | Complete Gate 6 |\n| 7 | Finance and risk | Complete Gate 7 |\n| 8 | Final decision and execution plan | Complete Gate 8 |\n| 9 | Knowledge checks and final submission | Complete checks and submit nine outputs |\n\nEach segment should contain:\n\n- A short lesson.\n- A worked example or case prompt.\n- A practical worksheet.\n- A knowledge check where relevant.\n- A submission or progress checkpoint.\n\nThe platform should allow learners to save progress and return later.",
  },
};
