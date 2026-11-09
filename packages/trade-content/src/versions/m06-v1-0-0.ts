import type { ModuleContent } from "../schema";

// Loaded from Entrust's M06 document. Sample documents and case materials are the platform team's, marked as fictional.
export const M06_V1_0_0: ModuleContent = {
  module: "M06",
  version: "1.0.0",
  title: "Export Costing and Margin Control",
  deliverable: "Export Costing Sheet and Commercial Quotation",
  objectives: [
    "Identify the direct and indirect costs associated with an export order.",
    "Distinguish production cost, export transaction cost and selling price.",
    "Calculate total order cost and unit cost.",
    "Calculate gross profit, gross margin and markup correctly.",
    "Understand how delivery terms affect the costs and responsibilities of the seller.",
    "Prepare an export quotation using documented assumptions.",
    "Assess the impact of currency movements, payment charges and unexpected costs.",
    "Identify the minimum acceptable selling price for an export order.",
    "Monitor actual transaction costs against the original quotation.",
    "Make a commercially informed proceed, renegotiate or decline decision.",
  ],
  status: "approved",
  approval: {
    by: "Minase Fikadu, TRADE platform team",
    at: "2026-11-09",
  },
  lessons: [
    {
      id: "introduction",
      title: "Module introduction",
      body: "## Purpose\n\nMany SMEs calculate export prices by adding a profit margin to their domestic selling price. This can lead to underpricing because export transactions involve additional costs, different delivery responsibilities, foreign currency exposure, payment charges and unexpected expenses.\n\nThis module teaches SMEs to calculate the full cost of an export transaction, determine a commercially viable selling price, understand the effect of Incoterms® on cost responsibility and protect their margins throughout the transaction.\n\nThe module uses practical costing exercises. Participants must work with their own business figures wherever possible.\n\nImportant: Export costing is a commercial calculation. It does not replace professional tax, customs, accounting or legal advice. Applicable duties, taxes, fees and regulatory charges must be verified for the specific product, transaction and destination.\n\n## Entry conditions\n\nThe SME should have:\n\n- A defined product or service.\n- An estimated production or procurement cost.\n- An intended export market or buyer opportunity.\n- Basic knowledge of its production capacity.\n- Available cost information, even if incomplete.\n\nIf the SME does not have reliable cost records, the module should identify this as a business improvement requirement rather than encourage invented figures.\n\n## Required outputs\n\nEach SME must submit:\n\n1. Export Cost Inventory.\n2. Export Order Costing Sheet.\n3. Unit Cost Calculation.\n4. Pricing and Margin Comparison.\n5. Incoterms® Cost Responsibility Matrix.\n6. Currency and Payment Cost Assessment.\n7. Export Quotation.\n8. Transaction Margin Control Sheet.\n9. Individual Costing Improvement Actions.\n\nThe SME should use actual business figures where available. Estimates must be labelled and supported by stated assumptions.\n\n## Completing this module\n\n### Passing requirements\n\n- Minimum practical assessment score: 24/36.\n- Knowledge check: at least 80%.\n- No critical failure.\n\nAn SME completes M06 when it has:\n\n- Completed all required lessons.\n- Achieved at least 80% in the knowledge check.\n- Submitted the required costing and quotation outputs.\n- Achieved at least 24/36 in the practical assessment.\n- Passed all critical-failure checks.\n- Submitted its individual learning plan.\n\n### Completion statement\n\nSuccessful completion demonstrates that the SME has completed the TRADE™ export costing and margin-control learning requirements. It does not certify that a particular export transaction is profitable, that a quotation is legally compliant, or that a buyer will accept the price.",
    },
    {
      id: "lesson-1",
      title: "Understanding the full export cost",
      body: "**Objective:** Identify all costs that may affect an export transaction.\n\nExport costing begins with the product, but it does not end at the factory gate.\n\nCosts may include:\n\n## A. Product costs\n\n- Raw materials and inputs.\n- Direct labour.\n- Manufacturing or processing.\n- Packaging.\n- Quality control.\n- Production overhead.\n- Product-specific certification or testing, where applicable.\n\n## B. Export preparation costs\n\n- Export packaging and labelling.\n- Inspection and testing.\n- Documentation preparation.\n- Handling and loading.\n- Inland transport.\n- Customs clearance and other applicable export charges.\n\n## C. International delivery costs\n\n- Freight.\n- Cargo insurance.\n- Port or terminal handling.\n- Other logistics charges.\n- Destination-side costs where the seller is responsible under the agreed delivery term.\n\n## D. Financial and commercial costs\n\n- Bank transfer charges.\n- Letter of credit charges, where applicable.\n- Currency conversion costs.\n- Financing and working capital costs.\n- Credit insurance, where applicable.\n- Agent or commission fees.\n- Expected transaction-related losses or contingencies.\n\nThe applicable costs depend on the product, route, destination, delivery term and contract.\n\n### Worked example: Addis Workwear PLC\n\nA fictional Ethiopian manufacturer receives an enquiry for 1,000 workwear uniforms.\n\n| Cost item | ETB |\n| --- | --- |\n| Fabric and materials | 450,000 |\n| Direct labour | 180,000 |\n| Manufacturing overhead | 90,000 |\n| Packaging | 35,000 |\n| Quality inspection | 15,000 |\n| Inland transport | 25,000 |\n| Export handling and documentation estimate | 20,000 |\n| Total estimated cost | 815,000 |\n\nThe estimated cost per uniform is:\n\nETB 815,000 ÷ 1,000 = ETB 815.\n\nThis is not yet the final export selling price. Freight, insurance, financing, bank charges, commissions and other applicable costs still need to be assessed according to the transaction.\n\n## Practical exercise\n\nAsk the SME to list every cost associated with producing and delivering one export order. Classify each cost as:\n\n- Product cost.\n- Export preparation cost.\n- Delivery cost.\n- Financial or commercial cost.\n\n**Output:** Export Cost Inventory.",
    },
    {
      id: "lesson-2",
      title: "Calculating unit cost and total order cost",
      body: "**Objective:** Calculate the actual cost of fulfilling an order.\n\nThe SME must distinguish between:\n\n- Fixed costs.\n- Variable costs.\n- One-time transaction costs.\n- Costs that change with order quantity.\n\nFor example, some inspection, documentation or handling charges may apply to the entire shipment rather than each individual unit.\n\nFormula:\n\nTotal order cost = Total production cost + Export transaction costs + Other seller-responsible costs.\n\nUnit cost = Total order cost ÷ Quantity.\n\n## Worked example\n\nThe Addis Workwear order has:\n\n- Production and packaging: ETB 770,000.\n- Inland transport: ETB 25,000.\n- Export handling and documentation estimate: ETB 20,000.\n- Other seller-responsible costs identified for the quotation: ETB 40,000.\n\nTotal estimated order cost = ETB 855,000.\n\nUnit cost = ETB 855,000 ÷ 1,000 = ETB 855.\n\nThe SME should document which charges are confirmed, estimated or still unknown.\n\n## Practical exercise\n\nParticipants calculate:\n\n1. Total production cost.\n2. Total export-related cost.\n3. Total order cost.\n4. Unit cost.\n5. Cost per unit if order quantity changes.\n\n**Output:** Export Order Costing Sheet.",
    },
    {
      id: "lesson-3",
      title: "Markup, gross profit and gross margin",
      body: "**Objective:** Understand the difference between markup and margin.\n\nThese terms are often confused, resulting in quotations that do not generate the intended profit.\n\nGross profit:\n\nSelling price − Cost of sales = Gross profit.\n\nGross margin:\n\nGross profit ÷ Selling price × 100.\n\nMarkup:\n\nGross profit ÷ Cost of sales × 100.\n\n## Worked example\n\nAssume the total cost of an order is ETB 855,000.\n\nIf the SME applies a 25% markup:\n\nSelling price = ETB 855,000 × 1.25 = ETB 1,068,750.\n\nGross profit = ETB 213,750.\n\nGross margin = ETB 213,750 ÷ ETB 1,068,750 × 100 = 20%.\n\nA 25% markup does not produce a 25% gross margin.\n\nIf the SME wants a 25% gross margin:\n\nSelling price = Total cost ÷ (1 − Target margin).\n\nETB 855,000 ÷ 0.75 = ETB 1,140,000.\n\nGross profit = ETB 285,000.\n\n## Practical exercise\n\nParticipants calculate selling prices using:\n\n- 15% markup.\n- 25% markup.\n- 20% gross margin.\n- 25% gross margin.\n\nThey compare the resulting profit and margin.\n\n**Output:** Pricing and Margin Comparison.",
    },
    {
      id: "lesson-4",
      title: "Incoterms® and seller cost responsibility",
      body: "**Objective:** Understand how the agreed delivery term affects the seller’s costing obligations.\n\nIncoterms® rules define important responsibilities between buyers and sellers, including delivery, risk transfer and allocation of certain costs.\n\nThe SME must not prepare an export quotation without understanding the delivery term requested by the buyer.\n\nExamples include:\n\n- EXW: The seller makes the goods available at the agreed place. The buyer generally takes responsibility for collection and subsequent arrangements. Export clearance responsibilities require careful consideration, particularly in cross-border transactions.\n- FCA: The seller delivers the goods to the carrier or other nominated person at the agreed place, with the relevant delivery obligations.\n- FOB: Used for sea and inland waterway transport. The seller delivers the goods on board the vessel at the agreed port of shipment.\n- CFR: The seller pays the cost and freight necessary to bring the goods to the named port of destination, while risk transfers when the goods are on board the vessel at the port of shipment.\n- CIF: Similar to CFR, with the seller also arranging the required insurance cover.\n- DAP: The seller delivers the goods to the named destination, ready for unloading.\n- DPU: The seller delivers and unloads the goods at the named destination.\n- DDP: The seller has extensive delivery obligations, including import clearance and applicable import duties and taxes, subject to the contractual and legal requirements.\n\nThe examples above are summaries, not substitutes for the full ICC rules.\n\n## Key control\n\nAlways identify:\n\n1. The selected Incoterms® rule.\n2. The precise named place or port.\n3. The applicable version, normally Incoterms® 2020 unless otherwise agreed.\n4. Which costs are included in the seller’s price.\n5. Which costs remain the buyer’s responsibility.\n\nDo not use FOB, CFR or CIF for containerized cargo without checking whether FCA, CPT or CIP is more appropriate.\n\n## Sample order for the exercise\n\nThis is a fictional training document. The businesses, people and figures are made up.\n\nAddis Workwear has an enquiry for 1,000 uniforms in a container, moving by road from Addis Ababa to the port of Djibouti and by sea to Mombasa.\n\n| Cost item | ETB |\n| --- | --- |\n| Inland transport, Addis Ababa to Djibouti | 60,000 |\n| Port and terminal handling at Djibouti | 15,000 |\n| Ocean freight, Djibouti to Mombasa | 45,000 |\n| Cargo insurance | 6,000 |\n\n## Practical exercise\n\nGive participants one order and ask them to compare the seller’s cost responsibilities under FCA, FOB and CIF where the transport mode and transaction make those terms appropriate.\n\n**Output:** Incoterms® Cost Responsibility Matrix.",
    },
    {
      id: "lesson-5",
      title: "Currency, payment and financial exposure",
      body: "**Objective:** Include financial risks in export pricing.\n\nAn export quotation may be issued in USD, EUR or another foreign currency while production costs are incurred in ETB.\n\nThis creates exposure between the date of quotation, order confirmation, payment and conversion.\n\nSMEs should consider:\n\n- Exchange-rate movements.\n- Bank conversion spreads.\n- International transfer fees.\n- Payment processing charges.\n- Letter of credit costs.\n- Financing costs during production and delivery.\n- Payment delays.\n- Unpaid or disputed invoices.\n- The time between paying suppliers and receiving buyer funds.\n\n## Worked example\n\nAn SME quotes USD 12,000 for an order.\n\nIts estimated ETB cost is ETB 1,200,000.\n\nAt an assumed exchange rate of ETB 120 per USD, the expected ETB revenue is ETB 1,440,000.\n\nIf the effective conversion rate changes to ETB 110 per USD, the ETB revenue becomes ETB 1,320,000.\n\nThe difference is ETB 120,000 before any additional fees or costs.\n\nThis is an illustrative calculation, not a statement of current exchange rates.\n\n## Practical exercise\n\nParticipants identify:\n\n- Quotation currency.\n- Cost currency.\n- Expected payment date.\n- Expected conversion date.\n- Bank and transfer charges.\n- Potential currency exposure.\n- Possible contractual or banking measures to manage the exposure.\n\n**Output:** Currency and Payment Cost Assessment.",
    },
    {
      id: "lesson-6",
      title: "Preparing a commercially viable export quotation",
      body: "**Objective:** Prepare a quotation that reflects the transaction’s costs and commercial requirements.\n\nA quotation should clearly identify:\n\n- Seller and buyer.\n- Product description and specifications.\n- Quantity and unit of measure.\n- Unit price and total price.\n- Currency.\n- Delivery term and named place.\n- Quotation validity period.\n- Production or delivery lead time.\n- Payment terms.\n- Packaging requirements.\n- Quality requirements.\n- Applicable taxes and charges, where relevant.\n- Exclusions and assumptions.\n\nThe quotation must distinguish confirmed costs from estimates.\n\nAn SME should not promise a delivery date, certification, quality standard or shipping arrangement that it has not verified.\n\n## Practical exercise\n\nParticipants prepare an export quotation using their own product and cost data. Where they do not have a live buyer, they use a clearly labelled practice scenario.\n\n**Output:** Export Quotation and Pricing Assumptions Sheet.",
    },
    {
      id: "lesson-7",
      title: "Protecting the margin after the order is confirmed",
      body: "**Objective:** Monitor actual costs and prevent margin erosion.\n\nA profitable quotation can become an unprofitable transaction when costs increase or assumptions change.\n\nCommon causes include:\n\n- Material price increases.\n- Production waste.\n- Rework and rejected products.\n- Freight changes.\n- Delayed shipment.\n- Storage and demurrage.\n- Unexpected inspection costs.\n- Currency movements.\n- Additional buyer requirements.\n- Payment delays and financing costs.\n\nSMEs should compare the original quotation against actual transaction costs.\n\n## Scenario: costs change after the quotation\n\nThis is a fictional training document. The businesses, people and figures are made up.\n\nAddis Workwear quoted ETB 1,068,750 for 1,000 uniforms against a total cost of ETB 855,000, a 20% gross margin. Its minimum acceptable gross margin is 15%. Before shipment:\n\n| Change | ETB |\n| --- | --- |\n| Freight increases | 30,000 |\n| Production costs rise by 5% of the ETB 770,000 production and packaging cost | 38,500 |\n| The shipment is delayed, and storage is charged | 12,000 |\n\n## Practical exercise\n\nParticipants receive a scenario in which freight increases, production costs rise and shipment is delayed. They must calculate the revised margin and decide whether to:\n\n- Proceed.\n- Renegotiate.\n- Reduce or change scope.\n- Hold the transaction.\n- Decline the order.\n\n**Output:** Transaction Margin Control Sheet.",
    },
  ],
  workedExample: {
    title: "Addis Workwear PLC",
    body: "This is a fictional training case.\n\nAddis Workwear receives an enquiry from a regional distributor for 1,000 industrial uniforms.\n\nThe buyer requests:\n\n- A specified fabric composition.\n- Consistent sizing.\n- Individual packaging.\n- Delivery to a named destination.\n- A quotation in USD.\n- A defined delivery timeline.\n\nThe SME estimates its production and packaging cost at ETB 770,000. It identifies ETB 25,000 for inland transport and ETB 20,000 for export handling and documentation. It also estimates ETB 40,000 in other seller-responsible costs, subject to confirmation.\n\n## Learner tasks\n\n1. Calculate the estimated total order cost.\n2. Calculate the unit cost.\n3. Determine the selling price for a 20% gross margin.\n4. Identify the delivery term and named place that need to be agreed.\n5. Identify which costs remain unconfirmed.\n6. Identify currency and payment exposure.\n7. Prepare a quotation.\n8. Explain what would cause the SME to renegotiate or decline the order.\n\n## Expected calculation\n\nTotal estimated cost: ETB 855,000.\n\nSelling price at 20% gross margin:\n\nETB 855,000 ÷ 0.80 = ETB 1,068,750.\n\nThe learner must still establish the correct foreign currency price using a documented exchange-rate assumption and account for applicable conversion costs.",
  },
  worksheets: [
    {
      id: "cost_inventory",
      title: "Export Cost Inventory",
      fields: [],
      tables: [
        {
          id: "costs",
          label: "Every cost of producing and delivering one export order",
          columns: [
            {
              id: "cost",
              label: "Cost",
              kind: "text",
              required: true,
            },
            {
              id: "classification",
              label: "Classification",
              kind: "choice",
              required: true,
              options: [
                {
                  value: "product_cost",
                  label: "Product cost",
                },
                {
                  value: "export_preparation_cost",
                  label: "Export preparation cost",
                },
                {
                  value: "delivery_cost",
                  label: "Delivery cost",
                },
                {
                  value: "financial_or_commercial_cost",
                  label: "Financial or commercial cost",
                },
              ],
            },
            {
              id: "amount",
              label: "Amount",
              kind: "money",
            },
            {
              id: "status",
              label: "Status",
              kind: "choice",
              options: [
                {
                  value: "confirmed",
                  label: "Confirmed",
                },
                {
                  value: "estimated",
                  label: "Estimated",
                },
                {
                  value: "unknown",
                  label: "Unknown",
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
      id: "order_costing",
      title: "Export Order Costing Sheet",
      fields: [
        {
          id: "product",
          label: "Product",
          kind: "text",
          required: true,
        },
        {
          id: "quantity",
          label: "Order quantity",
          kind: "number",
          required: true,
        },
        {
          id: "currency",
          label: "Currency",
          kind: "text",
          required: true,
        },
        {
          id: "production_cost",
          label: "Total production cost",
          kind: "money",
          required: true,
        },
        {
          id: "export_cost",
          label: "Total export-related cost",
          kind: "money",
          required: true,
        },
        {
          id: "other_cost",
          label: "Other seller-responsible costs",
          kind: "money",
        },
        {
          id: "total_cost",
          label: "Total order cost",
          kind: "money",
          required: true,
        },
        {
          id: "unconfirmed",
          label: "Which charges are confirmed, estimated or still unknown",
          kind: "long_text",
          required: true,
        },
      ],
      tables: [],
      computed: [],
    },
    {
      id: "unit_cost",
      title: "Unit Cost Calculation",
      fields: [
        {
          id: "total_cost",
          label: "Total order cost",
          kind: "money",
          required: true,
        },
        {
          id: "quantity",
          label: "Quantity",
          kind: "number",
          required: true,
        },
        {
          id: "unit_cost",
          label: "Unit cost",
          kind: "money",
          required: true,
        },
        {
          id: "changed_quantity",
          label: "A different order quantity",
          kind: "number",
        },
        {
          id: "changed_unit_cost",
          label: "Cost per unit at that quantity",
          kind: "money",
        },
        {
          id: "fixed_variable",
          label: "Which costs are fixed, variable, one-time, or change with quantity",
          kind: "long_text",
        },
      ],
      tables: [],
      computed: [],
    },
    {
      id: "pricing_comparison",
      title: "Pricing and Margin Comparison",
      fields: [],
      tables: [
        {
          id: "scenarios",
          label: "Selling prices compared",
          columns: [
            {
              id: "scenario",
              label: "Pricing basis",
              kind: "choice",
              required: true,
              options: [
                {
                  value: "15_markup",
                  label: "15% markup",
                },
                {
                  value: "25_markup",
                  label: "25% markup",
                },
                {
                  value: "20_gross_margin",
                  label: "20% gross margin",
                },
                {
                  value: "25_gross_margin",
                  label: "25% gross margin",
                },
              ],
            },
            {
              id: "selling_price",
              label: "Selling price",
              kind: "money",
              required: true,
            },
            {
              id: "gross_profit",
              label: "Gross profit",
              kind: "money",
              required: true,
            },
            {
              id: "gross_margin",
              label: "Gross margin",
              kind: "percent",
              required: true,
            },
            {
              id: "markup",
              label: "Markup",
              kind: "percent",
              required: true,
            },
          ],
          minRows: 4,
        },
      ],
      computed: [],
    },
    {
      id: "incoterms_matrix",
      title: "Incoterms® Cost Responsibility Matrix",
      fields: [
        {
          id: "named_place",
          label: "The precise named place or port",
          kind: "text",
          required: true,
        },
        {
          id: "version",
          label: "The applicable version",
          kind: "text",
        },
        {
          id: "transport_mode",
          label: "Transport mode",
          kind: "text",
        },
      ],
      tables: [
        {
          id: "responsibilities",
          label: "Cost responsibilities",
          columns: [
            {
              id: "cost",
              label: "Cost",
              kind: "text",
              required: true,
            },
            {
              id: "fca",
              label: "Under FCA",
              kind: "text",
            },
            {
              id: "fob",
              label: "Under FOB",
              kind: "text",
            },
            {
              id: "cif",
              label: "Under CIF",
              kind: "text",
            },
            {
              id: "notes",
              label: "Whether the term suits the transport mode and transaction",
              kind: "long_text",
            },
          ],
          minRows: 1,
        },
      ],
      computed: [],
    },
    {
      id: "currency_assessment",
      title: "Currency and Payment Cost Assessment",
      fields: [
        {
          id: "quotation_currency",
          label: "Quotation currency",
          kind: "text",
          required: true,
        },
        {
          id: "cost_currency",
          label: "Cost currency",
          kind: "text",
          required: true,
        },
        {
          id: "payment_date",
          label: "Expected payment date",
          kind: "date",
        },
        {
          id: "conversion_date",
          label: "Expected conversion date",
          kind: "date",
        },
        {
          id: "charges",
          label: "Bank and transfer charges",
          kind: "long_text",
          required: true,
        },
        {
          id: "exposure",
          label: "Potential currency exposure",
          kind: "long_text",
          required: true,
        },
        {
          id: "measures",
          label: "Possible contractual or banking measures to manage the exposure",
          kind: "long_text",
        },
      ],
      tables: [],
      computed: [],
    },
    {
      id: "export_quotation",
      title: "Export Quotation and Pricing Assumptions Sheet",
      fields: [
        {
          id: "practice",
          label: "Is this a practice scenario?",
          kind: "choice",
          required: true,
          options: [
            {
              value: "live_buyer",
              label: "Live buyer",
            },
            {
              value: "clearly_labelled_practice_scenario",
              label: "Clearly labelled practice scenario",
            },
          ],
        },
        {
          id: "seller",
          label: "Seller",
          kind: "text",
          required: true,
        },
        {
          id: "buyer",
          label: "Buyer",
          kind: "text",
          required: true,
        },
        {
          id: "product",
          label: "Product description and specifications",
          kind: "long_text",
          required: true,
        },
        {
          id: "quantity",
          label: "Quantity and unit of measure",
          kind: "text",
          required: true,
        },
        {
          id: "unit_price",
          label: "Unit price",
          kind: "money",
          required: true,
        },
        {
          id: "total_price",
          label: "Total price",
          kind: "money",
          required: true,
        },
        {
          id: "currency",
          label: "Currency",
          kind: "text",
          required: true,
        },
        {
          id: "delivery_term",
          label: "Delivery term and named place",
          kind: "text",
          required: true,
        },
        {
          id: "validity",
          label: "Quotation validity period",
          kind: "text",
        },
        {
          id: "lead_time",
          label: "Production or delivery lead time",
          kind: "text",
        },
        {
          id: "payment_terms",
          label: "Payment terms",
          kind: "text",
        },
        {
          id: "packaging",
          label: "Packaging requirements",
          kind: "text",
        },
        {
          id: "quality",
          label: "Quality requirements",
          kind: "text",
        },
        {
          id: "charges",
          label: "Applicable taxes and charges, where relevant",
          kind: "long_text",
        },
        {
          id: "assumptions",
          label: "Exclusions and assumptions, separating confirmed costs from estimates",
          kind: "long_text",
          required: true,
        },
      ],
      tables: [],
      computed: [],
    },
    {
      id: "margin_control",
      title: "Transaction Margin Control Sheet",
      fields: [
        {
          id: "quoted_margin",
          label: "Margin in the original quotation",
          kind: "percent",
        },
        {
          id: "changes",
          label: "What changed: freight, production costs, delay",
          kind: "long_text",
          required: true,
        },
        {
          id: "revised_margin",
          label: "Revised margin",
          kind: "percent",
          required: true,
        },
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
              value: "renegotiate",
              label: "Renegotiate",
            },
            {
              value: "reduce_or_change_scope",
              label: "Reduce or change scope",
            },
            {
              value: "hold_the_transaction",
              label: "Hold the transaction",
            },
            {
              value: "decline_the_order",
              label: "Decline the order",
            },
          ],
        },
        {
          id: "reasoning",
          label: "Why",
          kind: "long_text",
          required: true,
        },
      ],
      tables: [],
      computed: [],
    },
    {
      id: "individual_learning_plan",
      title: "Individual Costing Improvement Actions",
      description: "Three actions. Cost records: what cost information is missing or unreliable? Pricing control: what pricing or margin calculation must be improved? Transaction control: what process will the SME use to compare quoted and actual costs?",
      fields: [],
      tables: [
        {
          id: "actions",
          label: "Actions",
          columns: [
            {
              id: "area",
              label: "Action",
              kind: "choice",
              required: true,
              options: [
                {
                  value: "cost_records",
                  label: "Cost records",
                },
                {
                  value: "pricing_control",
                  label: "Pricing control",
                },
                {
                  value: "transaction_control",
                  label: "Transaction control",
                },
              ],
            },
            {
              id: "improvement",
              label: "What you will do",
              kind: "long_text",
              required: true,
            },
            {
              id: "responsible",
              label: "Responsible person",
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
              id: "resources",
              label: "Required resources",
              kind: "text",
            },
            {
              id: "evidence",
              label: "Evidence of completion",
              kind: "text",
            },
            {
              id: "success_measure",
              label: "Success measure",
              kind: "text",
            },
          ],
          minRows: 3,
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
        text: "What is the most complete basis for an export selling price?",
        options: [
          {
            id: "a",
            text: "Domestic selling price plus 10%.",
          },
          {
            id: "b",
            text: "Production cost only.",
          },
          {
            id: "c",
            text: "Total relevant transaction cost plus the required commercial return.",
          },
          {
            id: "d",
            text: "Competitor price only.",
          },
        ],
        correct: [
          "c",
        ],
        lessonId: "lesson-1",
      },
      {
        id: "q2",
        text: "An order costs ETB 800,000 and the SME applies a 20% markup. What is the selling price?",
        options: [
          {
            id: "a",
            text: "ETB 960,000.",
          },
          {
            id: "b",
            text: "ETB 1,000,000.",
          },
          {
            id: "c",
            text: "ETB 820,000.",
          },
          {
            id: "d",
            text: "ETB 1,200,000.",
          },
        ],
        correct: [
          "a",
        ],
        lessonId: "lesson-3",
      },
      {
        id: "q3",
        text: "An order costs ETB 800,000. What selling price is required to achieve a 20% gross margin?",
        options: [
          {
            id: "a",
            text: "ETB 960,000.",
          },
          {
            id: "b",
            text: "ETB 1,000,000.",
          },
          {
            id: "c",
            text: "ETB 820,000.",
          },
          {
            id: "d",
            text: "ETB 1,200,000.",
          },
        ],
        correct: [
          "b",
        ],
        lessonId: "lesson-3",
      },
      {
        id: "q4",
        text: "Which statement correctly distinguishes markup from gross margin?",
        options: [
          {
            id: "a",
            text: "They are always equal.",
          },
          {
            id: "b",
            text: "Markup is calculated on cost; gross margin is calculated on selling price.",
          },
          {
            id: "c",
            text: "Gross margin is calculated on cost.",
          },
          {
            id: "d",
            text: "Markup is calculated on selling price.",
          },
        ],
        correct: [
          "b",
        ],
        lessonId: "lesson-3",
      },
      {
        id: "q5",
        text: "Why must an SME identify the Incoterms® rule before preparing a quotation?",
        options: [
          {
            id: "a",
            text: "It determines the buyer’s product preferences.",
          },
          {
            id: "b",
            text: "It establishes the seller’s and buyer’s relevant delivery obligations, costs and risk allocation.",
          },
          {
            id: "c",
            text: "It guarantees payment.",
          },
          {
            id: "d",
            text: "It removes all export documentation requirements.",
          },
        ],
        correct: [
          "b",
        ],
        lessonId: "lesson-4",
      },
      {
        id: "q6",
        text: "Which Incoterms® rules are specifically for sea and inland waterway transport?",
        options: [
          {
            id: "a",
            text: "EXW and FCA.",
          },
          {
            id: "b",
            text: "DAP and DDP.",
          },
          {
            id: "c",
            text: "FOB, CFR and CIF.",
          },
          {
            id: "d",
            text: "CPT and CIP.",
          },
        ],
        correct: [
          "c",
        ],
        lessonId: "lesson-4",
      },
      {
        id: "q7",
        text: "What should an SME do when a material export cost is not confirmed?",
        options: [
          {
            id: "a",
            text: "Ignore it.",
          },
          {
            id: "b",
            text: "Use an unsupported estimate without disclosure.",
          },
          {
            id: "c",
            text: "Record it as an assumption or pending cost and verify it before committing.",
          },
          {
            id: "d",
            text: "Automatically charge the buyer twice.",
          },
        ],
        correct: [
          "c",
        ],
        lessonId: "lesson-6",
      },
      {
        id: "q8",
        text: "What is foreign exchange exposure?",
        options: [
          {
            id: "a",
            text: "The risk that currency movements change the value of expected receipts or costs.",
          },
          {
            id: "b",
            text: "The risk of a product being damaged.",
          },
          {
            id: "c",
            text: "A customs inspection.",
          },
          {
            id: "d",
            text: "A production delay.",
          },
        ],
        correct: [
          "a",
        ],
        lessonId: "lesson-5",
      },
      {
        id: "q9",
        text: "Why should actual transaction costs be compared with the original quotation?",
        options: [
          {
            id: "a",
            text: "To identify margin erosion and improve future pricing.",
          },
          {
            id: "b",
            text: "To avoid keeping business records.",
          },
          {
            id: "c",
            text: "To guarantee a higher selling price.",
          },
          {
            id: "d",
            text: "To eliminate all unexpected costs.",
          },
        ],
        correct: [
          "a",
        ],
        lessonId: "lesson-7",
      },
      {
        id: "q10",
        text: "A buyer requests a lower price that would put the order below the SME’s minimum acceptable margin. What should the SME do?",
        options: [
          {
            id: "a",
            text: "Accept immediately.",
          },
          {
            id: "b",
            text: "Hide the additional costs.",
          },
          {
            id: "c",
            text: "Reassess the transaction, renegotiate or decline if it is commercially unviable.",
          },
          {
            id: "d",
            text: "Ship first and calculate later.",
          },
        ],
        correct: [
          "c",
        ],
        lessonId: "lesson-7",
      },
    ],
  },
  rubric: {
    criteria: [
      {
        id: "cost_identification",
        title: "Cost identification",
        description: "Relevant costs identified and classified",
        maxPoints: 6,
        mustHave: false,
      },
      {
        id: "cost_calculation",
        title: "Cost calculation",
        description: "Correct total order cost and unit cost",
        maxPoints: 6,
        mustHave: false,
      },
      {
        id: "pricing_and_margin",
        title: "Pricing and margin",
        description: "Correct markup, gross margin and selling price calculations",
        maxPoints: 6,
        mustHave: false,
      },
      {
        id: "delivery_responsibilities",
        title: "Delivery responsibilities",
        description: "Appropriate understanding of Incoterms® and cost allocation",
        maxPoints: 6,
        mustHave: false,
      },
      {
        id: "financial_exposure",
        title: "Financial exposure",
        description: "Currency, payment and financing costs considered",
        maxPoints: 6,
        mustHave: false,
      },
      {
        id: "commercial_control",
        title: "Commercial control",
        description: "Quotation quality, assumptions and margin monitoring",
        maxPoints: 6,
        mustHave: false,
      },
    ],
    passMark: 24,
    mustHaveMinimum: 0,
    bands: [
      {
        label: "No evidence",
        from: 0,
      },
      {
        label: "Significant gaps",
        from: 1,
      },
      {
        label: "Adequate",
        from: 50,
      },
      {
        label: "Strong",
        from: 83,
      },
      {
        label: "Complete",
        from: 100,
      },
    ],
    criticalFailures: [
      {
        id: "cf1",
        text: "Presenting fabricated or unsupported cost figures as confirmed.",
      },
      {
        id: "cf2",
        text: "Confusing markup and gross margin in a material pricing decision.",
      },
      {
        id: "cf3",
        text: "Preparing a quotation without identifying the delivery term and named place where these are required.",
      },
      {
        id: "cf4",
        text: "Knowingly excluding a material seller-responsible cost.",
      },
      {
        id: "cf5",
        text: "Committing to a transaction that is demonstrably below the SME’s minimum acceptable commercial threshold without escalation or approval.",
      },
      {
        id: "cf6",
        text: "Misrepresenting currency, payment or delivery assumptions to the buyer.",
      },
    ],
  },
  aiPrompts: [],
  staff: {
    facilitatorGuide: "Facilitators should use the Addis Workwear case, then require participants to apply the calculations to their own products.\n\n## Assessor scoring guide\n\n- 0: No evidence.\n- 1–2: Significant gaps or incorrect work.\n- 3–4: Adequate work with some gaps.\n- 5: Strong work with minor gaps.\n- 6: Complete, accurate and supported work.\n\n## Case material notes\n\nWritten by the platform team, not Entrust.\n\n**Lesson 4:** FCA Addis Ababa leaves inland transport, port handling, freight and insurance with the buyer. FOB Djibouti adds inland transport and port handling for the seller. CIF Mombasa adds freight and insurance too. The goods are in a container, so a learner should ask whether FCA, CPT or CIP fits better.\n\n**Lesson 7:** revised cost ETB 935,500, gross profit ETB 133,250, margin 12.47%, below the 15% minimum. Holding 15% needs about ETB 1,100,588.",
    liveSessionPlan: "Recommended duration: 150 minutes\n\n| Session | Duration |\n| --- | --- |\n| Introduction and export-cost discussion | 10 minutes |\n| Lesson 1: Full export cost | 20 minutes |\n| Lesson 2: Unit and order costing | 20 minutes |\n| Lesson 3: Markup and margin | 25 minutes |\n| Lesson 4: Incoterms® and cost responsibility | 20 minutes |\n| Lesson 5: Currency and payment exposure | 15 minutes |\n| Lesson 6: Quotation exercise | 20 minutes |\n| Lesson 7: Margin-control scenario | 10 minutes |\n| Knowledge check and close | 10 minutes |\n| Total | 150 minutes |",
    hybridSequence: "The platform should present M06 in the following sequence:\n\n1. Module introduction and learning outcomes.\n2. Lesson 1 video and Export Cost Inventory.\n3. Lesson 2 video and Costing Sheet.\n4. Lesson 3 video and interactive pricing calculator.\n5. Lesson 4 video and Incoterms® responsibility exercise.\n6. Lesson 5 video and Currency Exposure Worksheet.\n7. Lesson 6 video and quotation template.\n8. Lesson 7 video and margin-control scenario.\n9. Knowledge check.\n10. Practical assessment submission.\n11. Assessor review and feedback.\n12. Individual learning plan.\n13. Module completion record.",
  },
};
