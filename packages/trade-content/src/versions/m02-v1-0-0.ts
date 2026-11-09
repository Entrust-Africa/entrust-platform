import type { ModuleContent } from "../schema";

// Loaded from Entrust's M02 document. A draft until Entrust approves it; content fixes go back to them.
export const M02_V1_0_0: ModuleContent = {
  module: "M02",
  version: "1.0.0",
  title: "Digital Operations and Business Records",
  deliverable: "SME Digital Operations and Records System",
  objectives: [
    "Identify the business records required for effective management.",
    "Establish a consistent digital filing structure.",
    "Maintain basic sales, purchases, expenses, inventory and customer records.",
    "Organize supplier, buyer and transaction documentation.",
    "Use spreadsheets and basic digital tools to manage business information.",
    "Apply appropriate document naming, version control and backup practices.",
    "Understand basic data security and access-control principles.",
    "Prepare a digital business information file that can support financing and export activities.",
  ],
  status: "draft",
  lessons: [
    {
      id: "introduction",
      title: "Module introduction",
      body: "## Purpose\n\nMany SMEs operate with important business information scattered across notebooks, WhatsApp messages, spreadsheets, email accounts and individual employees’ devices.\n\nThis creates practical problems. Management may not know the true cost of a product, how much customers owe, which orders are pending, what inventory is available or whether the business can meet a buyer’s requirements.\n\nM02 helps SMEs establish simple, consistent digital systems for managing their business information.\n\nThe objective is not to introduce expensive software. It is to ensure that important business records are accurate, organized, accessible to authorized people and useful for decision-making.\n\n## Entry conditions\n\nLearners should have:\n\n- Access to a smartphone or computer.\n- Basic ability to use email or messaging applications.\n- Access to existing business records where available.\n\nA computer is recommended for spreadsheet exercises, but the module should remain accessible to learners using smartphones.\n\n## Required outputs\n\n### Individual learning plan\n\nAfter assessment, learners should receive an improvement plan.\n\n| Identified gap | Improvement action | Suggested owner | Target date | Evidence |\n| --- | --- | --- | --- | --- |\n| Incomplete customer records | Create and update a customer register | Sales lead |  | Completed register |\n| Missing financial records | Establish monthly sales and expense registers | Finance lead |  | Updated records |\n| Disorganized documents | Establish a central folder structure | Administrator |  | Folder structure |\n| Weak inventory controls | Create an inventory register and reconciliation process | Operations lead |  | Inventory records |\n| Missing export records | Establish a transaction folder template | Export lead |  | Transaction folder |\n| Poor backup practices | Implement secure backup procedures | Management/IT |  | Backup test record |\n| Limited digital systems | Evaluate one priority digitization opportunity | Management |  | Improvement recommendation |\n\nThe plan should reflect the SME’s actual assessment results.\n\n## Completing this module\n\n## Pass requirements\n\n- At least 24/36.\n- At least 80% in knowledge checks.\n- No critical failure.\n\n## Resubmission\n\nLearners may correct the relevant records or exercises and resubmit. The platform must retain the original and revised submissions and scores.\n\nM02 is complete when the learner has:\n\n- Completed all six lessons.\n- Submitted the required practical outputs.\n- Achieved at least 80% in knowledge checks.\n- Achieved at least 24/36 in the practical assessment.\n- Avoided all critical failures.\n- Completed any required reassessment.\n\n## Final learner output\n\nA functioning SME Digital Operations and Records System, including an organized digital filing structure, working business registers, a transaction information file, basic security practices and a practical digital improvement recommendation.\n\nCompletion demonstrates the learner’s ability to organize and manage basic business information. It does not certify compliance with accounting, tax, privacy or other legal requirements.",
    },
    {
      id: "lesson-1",
      title: "Understanding business records",
      body: "## Purpose\n\nLearners need to understand what information their businesses should record and why.\n\nBusiness records support management decisions, financial reporting, customer service, operational planning, financing and trade transactions.\n\n### Core business records\n\n## A. Business identity and governance\n\n- Business registration information.\n- Tax identification information.\n- Business licences and relevant permits.\n- Ownership and management information.\n- Official business contacts.\n- Bank account information, stored securely.\n\n## B. Sales and customer records\n\n- Customer name and contact details.\n- Product or service purchased.\n- Quantity.\n- Selling price.\n- Invoice number.\n- Order date.\n- Payment terms.\n- Amount paid and outstanding.\n- Delivery status.\n\n## C. Purchases and supplier records\n\n- Supplier details.\n- Materials or services purchased.\n- Quantity.\n- Purchase price.\n- Invoice or receipt reference.\n- Payment status.\n- Delivery date.\n\n## D. Financial records\n\n- Sales revenue.\n- Operating expenses.\n- Payroll and labour costs.\n- Production expenses.\n- Bank transactions.\n- Receivables and payables.\n- Loan obligations.\n- Cash-flow records.\n\n## E. Inventory and production records\n\n- Product or material description.\n- Opening stock.\n- Purchases.\n- Materials consumed.\n- Production quantities.\n- Finished goods.\n- Damaged or rejected items.\n- Closing stock.\n- Stock location.\n\n## F. Trade and export records\n\n- Buyer enquiries.\n- Quotations.\n- Purchase orders.\n- Sales contracts.\n- Product specifications.\n- Packing lists.\n- Commercial invoices.\n- Transport records.\n- Export documentation.\n- Payment records.\n- Shipment and delivery status.\n\n## Practical exercise\n\nAsk learners to identify where their business currently stores each type of information.\n\n| Record category | Current storage location | Available? | Improvement required |\n| --- | --- | --- | --- |\n| Business registration |  | Yes/No |  |\n| Customer records |  | Yes/No |  |\n| Sales records |  | Yes/No |  |\n| Purchase records |  | Yes/No |  |\n| Expense records |  | Yes/No |  |\n| Inventory records |  | Yes/No |  |\n| Employee records |  | Yes/No |  |\n| Buyer and export records |  | Yes/No |  |\n\n## Lesson output\n\nBusiness Records Inventory.",
    },
    {
      id: "lesson-2",
      title: "Organizing digital business information",
      body: "## Purpose\n\nLearners should establish a simple structure that allows authorized employees to locate documents without relying on one person’s phone or memory.\n\n## A. Digital filing structure\n\nThe SME should create a central business folder with clearly defined subfolders.\n\nRecommended structure:\n\n1. Business Registration and Legal\n2. Finance and Accounting\n3. Sales and Customers\n4. Suppliers and Purchases\n5. Inventory and Production\n6. Employees and Administration\n7. Products and Specifications\n8. Buyers and Export Opportunities\n9. Orders and Transactions\n10. Banking and Financing\n11. Insurance and Risk\n12. Reports and Management\n\nLearners should adapt the structure to their business size and activities.\n\n## B. File naming\n\nDocuments should follow a consistent naming convention.\n\nRecommended format:\n\nYYYY-MM-DD_DocumentType_CustomerOrSupplier_Reference\n\nExamples:\n\n- 2026-11-08_SalesInvoice_Buyer01_INV-001\n- 2026-11-08_PurchaseOrder_Supplier02_PO-004\n- 2026-11-08_ProductSpecification_Workwear_V1\n- 2026-11-08_ExportQuotation_Buyer01_QT-003\n\n## C. Version control\n\nWhen a document changes, the business should maintain a clear version history.\n\nFor example:\n\n- ProductSpecification_V1\n- ProductSpecification_V2\n- ProductSpecification_Approved\n\nThe business should identify which version is current and avoid sending outdated quotations, specifications or contracts to buyers.\n\n## D. Document access\n\nNot every employee needs access to every business record.\n\nFor example:\n\n- Sales employees may access customer and quotation records.\n- Finance employees may access financial records.\n- Production employees may access production schedules and product specifications.\n- Management may have broader access.\n- Sensitive employee, financial and banking records should be restricted.\n\n## Practical exercise\n\nLearners create the recommended folder structure on their device or in a digital storage system available to their business.\n\nThey should save at least five existing business documents using the agreed naming convention.\n\n## Lesson output\n\nA working digital business folder structure with correctly named documents.",
    },
    {
      id: "lesson-3",
      title: "Using spreadsheets for business management",
      body: "## Purpose\n\nSpreadsheets provide a practical starting point for SMEs that do not yet use an accounting or enterprise resource planning system.\n\nA spreadsheet is not a replacement for proper accounting software where such software is required. However, it can help businesses organize basic operational information.\n\n## A. Sales register\n\n| Date | Invoice No. | Customer | Product | Quantity | Unit price | Total | Paid | Balance |\n| --- | --- | --- | --- | --- | --- | --- | --- | --- |\n|  |  |  |  |  |  |  |  |  |\n\nFormula:\n\nTotal = Quantity × Unit Price\n\nBalance = Total - Paid\n\n## B. Expense register\n\n| Date | Reference | Expense category | Description | Amount | Payment method | Supporting document |\n| --- | --- | --- | --- | --- | --- | --- |\n\nPossible expense categories:\n\n- Raw materials.\n- Labour.\n- Rent.\n- Utilities.\n- Transport.\n- Packaging.\n- Marketing.\n- Administration.\n- Repairs and maintenance.\n- Other operating expenses.\n\n## C. Inventory register\n\n| Date | Product/material | Opening stock | Received | Used/sold | Closing stock | Unit |\n| --- | --- | --- | --- | --- | --- | --- |\n\nFormula:\n\nClosing Stock = Opening Stock + Received - Used/Sold\n\nThe business should investigate unexplained differences between recorded and physical inventory.\n\n## D. Customer register\n\n| Customer | Contact person | Country | Product interest | Last contact | Opportunity status | Next action |\n| --- | --- | --- | --- | --- | --- | --- |\n\n## E. Supplier register\n\n| Supplier | Contact | Materials supplied | Lead time | Payment terms | Reliability notes |\n| --- | --- | --- | --- | --- | --- |\n\n## F. Order tracking register\n\n| Order reference | Customer | Product | Quantity | Order date | Required delivery | Production status | Delivery status |\n| --- | --- | --- | --- | --- | --- | --- | --- |\n\n## Practical exercise\n\nLearners should create at least two of the registers relevant to their business.\n\nThe assessor should check whether the learner can:\n\n- Enter information consistently.\n- Calculate totals correctly.\n- Identify outstanding balances.\n- Update records.\n- Find a specific customer, order or transaction.\n- Identify missing information.\n\n## Lesson output\n\nAt least two working digital business registers.",
    },
    {
      id: "lesson-4",
      title: "Digital documentation for finance and export transactions",
      body: "## Purpose\n\nA business may have good products and commercial opportunities but still struggle to demonstrate its capacity because it cannot produce organized information.\n\nThis lesson connects digital recordkeeping to bankability and export execution.\n\n## A. Financial information file\n\nLearners should organize available records such as:\n\n- Business registration.\n- Tax information.\n- Financial statements, where available.\n- Sales records.\n- Purchase and expense records.\n- Bank statements.\n- Existing loan obligations.\n- Receivables and payables.\n- Cash-flow information.\n- Asset information.\n- Management accounts.\n\nThe exact requirements depend on the financial institution and the financing product. The SME should not assume that this list guarantees loan eligibility.\n\n## B. Buyer information file\n\nFor each serious buyer opportunity, maintain:\n\n- Buyer identity and contact details.\n- Buyer verification records.\n- Product enquiry.\n- Product specifications.\n- Quotation history.\n- Correspondence.\n- Purchase orders.\n- Contractual terms.\n- Payment arrangements.\n- Delivery requirements.\n- Follow-up actions.\n\n## C. Export transaction folder\n\nCreate a separate folder for every export opportunity or transaction.\n\nSuggested contents:\n\n1. Buyer profile.\n2. Buyer enquiry.\n3. Product specification.\n4. Quotation.\n5. Purchase order or contract.\n6. Costing worksheet.\n7. Production records.\n8. Quality inspection records.\n9. Export requirements checklist.\n10. Commercial invoice.\n11. Packing list.\n12. Relevant transport and insurance documents.\n13. Payment evidence.\n14. Shipment and delivery records.\n\nNot every transaction will require every document. The applicable requirements must be confirmed for the product and destination.\n\n## D. Document control\n\nLearners should establish a simple checklist:\n\n- Is the document current?\n- Is the information accurate?\n- Is the document complete?\n- Is the correct version being used?\n- Is it stored in the right folder?\n- Is access limited to authorized people?\n- Is there a backup?\n\n## Practical exercise\n\nLearners select one actual customer, order or export opportunity and create a digital transaction folder.\n\nThey should identify which documents are available and which remain outstanding.\n\n## Lesson output\n\nA Digital Finance and Transaction Information File.",
    },
    {
      id: "lesson-5",
      title: "Data protection, security and backups",
      body: "## Purpose\n\nDigital records create value, but poor security can expose an SME to fraud, data loss, unauthorized disclosure and operational disruption.\n\n## A. Basic security practices\n\nLearners should:\n\n- Use strong, unique passwords.\n- Enable multi-factor authentication where available.\n- Avoid sharing passwords through messaging applications.\n- Restrict access to sensitive information.\n- Remove access when employees leave.\n- Keep devices and software updated.\n- Avoid opening suspicious links or attachments.\n- Verify payment instructions independently.\n- Avoid storing sensitive financial information in publicly accessible folders.\n\n## B. Backup practices\n\nImportant records should not exist in only one location.\n\nA practical approach is to maintain:\n\n- A primary working copy.\n- A separate backup.\n- A secure additional copy where appropriate.\n\nBackups should be performed regularly and periodically tested to confirm that files can actually be restored.\n\n## C. Data confidentiality\n\nSMEs should be careful when sharing information with buyers, banks, insurers, service providers and other partners.\n\nOnly relevant information should be shared, with appropriate authorization.\n\nFor TRADE-related referrals, the SME should understand what information is being shared, with whom and for what purpose. Sensitive records should not be distributed automatically.\n\n## D. Business continuity\n\nLearners should consider what would happen if:\n\n- A phone is lost.\n- A computer fails.\n- An employee leaves.\n- Business files are accidentally deleted.\n- An email account is compromised.\n- A key person becomes unavailable.\n\nThe business should have a basic recovery procedure and ensure that more than one authorized person understands how important records are maintained.\n\n## Practical exercise\n\nLearners complete a basic digital security checklist and identify three improvements they can implement immediately.\n\n## Lesson output\n\nDigital Security and Backup Checklist.",
    },
    {
      id: "lesson-6",
      title: "Choosing and improving digital tools",
      body: "## Purpose\n\nSMEs should choose technology based on their actual business needs, not because a particular application is popular.\n\n## A. Digital tool categories\n\n| Business need | Possible tool category |\n| --- | --- |\n| Accounting | Accounting and bookkeeping software |\n| Sales tracking | Customer relationship management system |\n| Inventory | Inventory management software |\n| Production | Production planning tools |\n| Documents | Cloud document storage |\n| Communication | Business email and messaging |\n| Reporting | Spreadsheet and dashboard tools |\n| Online presence | Website and digital business profile |\n| Export management | Export documentation and transaction management tools |\n\n## B. Choosing a tool\n\nBefore adopting software, the SME should consider:\n\n1. What business problem does it solve?\n2. Who will use it?\n3. Is it suitable for the business’s size?\n4. What does it cost?\n5. Does it support the required language and currency?\n6. Can information be exported or backed up?\n7. Does it protect business information?\n8. Can it integrate with existing systems?\n9. What training or support is required?\n10. What happens if the business stops paying for the service?\n\n## C. Avoiding unnecessary digitization\n\nA business should not digitize a poorly understood process without first reviewing it.\n\nFor example, automating an unreliable inventory process may simply make inaccurate information available faster.\n\nThe correct sequence is:\n\n1. Understand the process.\n2. Identify the information required.\n3. Standardize the process.\n4. Select an appropriate tool.\n5. Train the people responsible.\n6. Review the quality of the information.\n\n## Practical exercise\n\nLearners identify one business process that would benefit from digitization and prepare a short implementation recommendation.\n\n## Lesson output\n\nDigital Improvement Recommendation.",
    },
  ],
  workedExample: {
    title: "File naming",
    body: "Documents should follow a consistent naming convention.\n\nRecommended format:\n\nYYYY-MM-DD_DocumentType_CustomerOrSupplier_Reference\n\nExamples:\n\n- 2026-11-08_SalesInvoice_Buyer01_INV-001\n- 2026-11-08_PurchaseOrder_Supplier02_PO-004\n- 2026-11-08_ProductSpecification_Workwear_V1\n- 2026-11-08_ExportQuotation_Buyer01_QT-003",
  },
  worksheets: [
    {
      id: "records_inventory",
      title: "Business Records Inventory",
      fields: [],
      tables: [
        {
          id: "records",
          label: "Where each type of record is kept",
          columns: [
            {
              id: "category",
              label: "Record category",
              kind: "choice",
              required: true,
              options: [
                {
                  value: "business_registration",
                  label: "Business registration",
                },
                {
                  value: "customer_records",
                  label: "Customer records",
                },
                {
                  value: "sales_records",
                  label: "Sales records",
                },
                {
                  value: "purchase_records",
                  label: "Purchase records",
                },
                {
                  value: "expense_records",
                  label: "Expense records",
                },
                {
                  value: "inventory_records",
                  label: "Inventory records",
                },
                {
                  value: "employee_records",
                  label: "Employee records",
                },
                {
                  value: "buyer_and_export_records",
                  label: "Buyer and export records",
                },
              ],
            },
            {
              id: "location",
              label: "Current storage location",
              kind: "text",
            },
            {
              id: "available",
              label: "Available?",
              kind: "choice",
              required: true,
              options: [
                {
                  value: "yes",
                  label: "Yes",
                },
                {
                  value: "no",
                  label: "No",
                },
              ],
            },
            {
              id: "improvement",
              label: "Improvement required",
              kind: "long_text",
            },
          ],
          minRows: 8,
        },
      ],
      computed: [],
    },
    {
      id: "digital_folders",
      title: "Digital Folder Structure",
      fields: [
        {
          id: "structure",
          label: "Your central business folder and its subfolders",
          kind: "long_text",
          required: true,
          help: "Adapt the recommended structure to your business.",
        },
        {
          id: "location",
          label: "Where the folder is kept",
          kind: "text",
        },
      ],
      tables: [
        {
          id: "documents",
          label: "Five existing documents, saved under the naming convention",
          columns: [
            {
              id: "file_name",
              label: "File name",
              kind: "text",
              required: true,
              help: "YYYY-MM-DD_DocumentType_CustomerOrSupplier_Reference",
            },
            {
              id: "folder",
              label: "Folder",
              kind: "text",
            },
            {
              id: "current_version",
              label: "Is this the current version?",
              kind: "choice",
              options: [
                {
                  value: "yes",
                  label: "Yes",
                },
                {
                  value: "no",
                  label: "No",
                },
              ],
            },
          ],
          minRows: 5,
        },
      ],
      computed: [],
    },
    {
      id: "business_registers",
      title: "Working Business Registers",
      description: "Keep at least two of these registers, the ones relevant to your business. Fill them in here, or keep them in your own spreadsheet and name it below.",
      fields: [
        {
          id: "spreadsheet",
          label: "Your spreadsheet file, if you keep your registers in one",
          kind: "text",
          help: "Name or link. The rows below are the structured alternative.",
        },
        {
          id: "two_registers",
          label: "Which registers you keep, and why those",
          kind: "long_text",
          required: true,
        },
      ],
      tables: [
        {
          id: "sales",
          label: "Sales register",
          columns: [
            {
              id: "date",
              label: "Date",
              kind: "date",
            },
            {
              id: "invoice",
              label: "Invoice No.",
              kind: "text",
            },
            {
              id: "customer",
              label: "Customer",
              kind: "text",
            },
            {
              id: "product",
              label: "Product",
              kind: "text",
            },
            {
              id: "quantity",
              label: "Quantity",
              kind: "number",
            },
            {
              id: "unit_price",
              label: "Unit price",
              kind: "money",
            },
            {
              id: "total",
              label: "Total",
              kind: "money",
            },
            {
              id: "paid",
              label: "Paid",
              kind: "money",
            },
            {
              id: "balance",
              label: "Balance",
              kind: "money",
            },
          ],
        },
        {
          id: "expenses",
          label: "Expense register",
          columns: [
            {
              id: "date",
              label: "Date",
              kind: "date",
            },
            {
              id: "reference",
              label: "Reference",
              kind: "text",
            },
            {
              id: "category",
              label: "Expense category",
              kind: "text",
            },
            {
              id: "description",
              label: "Description",
              kind: "text",
            },
            {
              id: "amount",
              label: "Amount",
              kind: "money",
            },
            {
              id: "method",
              label: "Payment method",
              kind: "text",
            },
            {
              id: "document",
              label: "Supporting document",
              kind: "text",
            },
          ],
        },
        {
          id: "inventory",
          label: "Inventory register",
          columns: [
            {
              id: "date",
              label: "Date",
              kind: "date",
            },
            {
              id: "item",
              label: "Product/material",
              kind: "text",
            },
            {
              id: "opening",
              label: "Opening stock",
              kind: "number",
            },
            {
              id: "received",
              label: "Received",
              kind: "number",
            },
            {
              id: "used",
              label: "Used/sold",
              kind: "number",
            },
            {
              id: "closing",
              label: "Closing stock",
              kind: "number",
            },
            {
              id: "unit",
              label: "Unit",
              kind: "text",
            },
          ],
        },
        {
          id: "customers",
          label: "Customer register",
          columns: [
            {
              id: "customer",
              label: "Customer",
              kind: "text",
            },
            {
              id: "contact",
              label: "Contact person",
              kind: "text",
            },
            {
              id: "country",
              label: "Country",
              kind: "text",
            },
            {
              id: "interest",
              label: "Product interest",
              kind: "text",
            },
            {
              id: "last_contact",
              label: "Last contact",
              kind: "date",
            },
            {
              id: "status",
              label: "Opportunity status",
              kind: "text",
            },
            {
              id: "next_action",
              label: "Next action",
              kind: "text",
            },
          ],
        },
        {
          id: "suppliers",
          label: "Supplier register",
          columns: [
            {
              id: "supplier",
              label: "Supplier",
              kind: "text",
            },
            {
              id: "contact",
              label: "Contact",
              kind: "text",
            },
            {
              id: "materials",
              label: "Materials supplied",
              kind: "text",
            },
            {
              id: "lead_time",
              label: "Lead time",
              kind: "text",
            },
            {
              id: "terms",
              label: "Payment terms",
              kind: "text",
            },
            {
              id: "notes",
              label: "Reliability notes",
              kind: "text",
            },
          ],
        },
        {
          id: "orders",
          label: "Order tracking register",
          columns: [
            {
              id: "reference",
              label: "Order reference",
              kind: "text",
            },
            {
              id: "customer",
              label: "Customer",
              kind: "text",
            },
            {
              id: "product",
              label: "Product",
              kind: "text",
            },
            {
              id: "quantity",
              label: "Quantity",
              kind: "number",
            },
            {
              id: "order_date",
              label: "Order date",
              kind: "date",
            },
            {
              id: "required",
              label: "Required delivery",
              kind: "date",
            },
            {
              id: "production",
              label: "Production status",
              kind: "text",
            },
            {
              id: "delivery",
              label: "Delivery status",
              kind: "text",
            },
          ],
        },
      ],
      computed: [],
    },
    {
      id: "transaction_file",
      title: "Digital Finance and Transaction Information File",
      fields: [
        {
          id: "transaction",
          label: "The customer, order or export opportunity you selected",
          kind: "text",
          required: true,
        },
      ],
      tables: [
        {
          id: "documents",
          label: "Documents",
          columns: [
            {
              id: "document",
              label: "Document",
              kind: "text",
              required: true,
            },
            {
              id: "available",
              label: "Available or outstanding",
              kind: "choice",
              required: true,
              options: [
                {
                  value: "available",
                  label: "Available",
                },
                {
                  value: "outstanding",
                  label: "Outstanding",
                },
                {
                  value: "not_required_for_this_transaction",
                  label: "Not required for this transaction",
                },
              ],
            },
            {
              id: "location",
              label: "Where it is stored",
              kind: "text",
            },
            {
              id: "current",
              label: "Current, accurate and complete?",
              kind: "choice",
              options: [
                {
                  value: "yes",
                  label: "Yes",
                },
                {
                  value: "no",
                  label: "No",
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
      id: "security_checklist",
      title: "Digital Security and Backup Checklist",
      fields: [
        {
          id: "passwords",
          label: "Use strong, unique passwords",
          kind: "checkbox",
        },
        {
          id: "mfa",
          label: "Enable multi-factor authentication where available",
          kind: "checkbox",
        },
        {
          id: "no_sharing",
          label: "Avoid sharing passwords through messaging applications",
          kind: "checkbox",
        },
        {
          id: "restrict",
          label: "Restrict access to sensitive information",
          kind: "checkbox",
        },
        {
          id: "leavers",
          label: "Remove access when employees leave",
          kind: "checkbox",
        },
        {
          id: "updates",
          label: "Keep devices and software updated",
          kind: "checkbox",
        },
        {
          id: "links",
          label: "Avoid opening suspicious links or attachments",
          kind: "checkbox",
        },
        {
          id: "payments",
          label: "Verify payment instructions independently",
          kind: "checkbox",
        },
        {
          id: "public",
          label: "Avoid storing sensitive financial information in publicly accessible folders",
          kind: "checkbox",
        },
        {
          id: "backup",
          label: "A separate backup exists and has been tested",
          kind: "checkbox",
        },
        {
          id: "improvements",
          label: "Three improvements you can implement immediately",
          kind: "long_text",
          required: true,
        },
      ],
      tables: [],
      computed: [],
    },
    {
      id: "digital_improvement",
      title: "Digital Improvement Recommendation",
      fields: [
        {
          id: "process",
          label: "The business process that would benefit from digitization",
          kind: "text",
          required: true,
        },
        {
          id: "problem",
          label: "What business problem does it solve?",
          kind: "long_text",
          required: true,
        },
        {
          id: "users",
          label: "Who will use it?",
          kind: "text",
        },
        {
          id: "tool_category",
          label: "Possible tool category",
          kind: "text",
        },
        {
          id: "cost",
          label: "What does it cost, and what training or support is required?",
          kind: "long_text",
        },
        {
          id: "recommendation",
          label: "Your implementation recommendation",
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
      description: "An improvement plan that reflects your assessment results.",
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
              label: "Improvement action",
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
              label: "Evidence",
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
        text: "Why should an SME maintain a sales register?",
        options: [
          {
            id: "a",
            text: "To replace all financial records.",
          },
          {
            id: "b",
            text: "To track customer transactions, sales and outstanding payments.",
          },
          {
            id: "c",
            text: "To avoid issuing invoices.",
          },
          {
            id: "d",
            text: "To eliminate the need for accounting.",
          },
        ],
        correct: [
          "b",
        ],
        lessonId: "lesson-1",
      },
      {
        id: "q2",
        text: "An SME keeps all customer information on one employee’s personal phone. What is the main risk?",
        options: [
          {
            id: "a",
            text: "The business may lose access to important customer information if the employee becomes unavailable.",
          },
          {
            id: "b",
            text: "Customer information becomes more accurate.",
          },
          {
            id: "c",
            text: "The business automatically improves its customer service.",
          },
          {
            id: "d",
            text: "The business no longer needs a customer register.",
          },
        ],
        correct: [
          "a",
        ],
        lessonId: "lesson-1",
      },
      {
        id: "q3",
        text: "What is the main purpose of a consistent file-naming convention?",
        options: [
          {
            id: "a",
            text: "To make files longer.",
          },
          {
            id: "b",
            text: "To make documents easier to identify, retrieve and manage.",
          },
          {
            id: "c",
            text: "To replace document verification.",
          },
          {
            id: "d",
            text: "To prevent employees from accessing files.",
          },
        ],
        correct: [
          "b",
        ],
        lessonId: "lesson-2",
      },
      {
        id: "q4",
        text: "Two versions of a product specification exist. Which should the SME send to the buyer?",
        options: [
          {
            id: "a",
            text: "The oldest version.",
          },
          {
            id: "b",
            text: "Both versions without explanation.",
          },
          {
            id: "c",
            text: "The current approved version.",
          },
          {
            id: "d",
            text: "Whichever version is easiest to find.",
          },
        ],
        correct: [
          "c",
        ],
        lessonId: "lesson-2",
      },
      {
        id: "q5",
        text: "An SME records 100 units sold at ETB 500 per unit. What is the total sales value?",
        options: [
          {
            id: "a",
            text: "ETB 5,000.",
          },
          {
            id: "b",
            text: "ETB 50,000.",
          },
          {
            id: "c",
            text: "ETB 100,500.",
          },
          {
            id: "d",
            text: "ETB 500.",
          },
        ],
        correct: [
          "b",
        ],
        lessonId: "lesson-3",
      },
      {
        id: "q6",
        text: "What should an SME do when its physical stock differs from its inventory register?",
        options: [
          {
            id: "a",
            text: "Ignore the difference.",
          },
          {
            id: "b",
            text: "Change the records without investigation.",
          },
          {
            id: "c",
            text: "Investigate and document the difference before correcting the records.",
          },
          {
            id: "d",
            text: "Delete the inventory register.",
          },
        ],
        correct: [
          "c",
        ],
        lessonId: "lesson-3",
      },
      {
        id: "q7",
        text: "Why should each serious export opportunity have an organized transaction folder?",
        options: [
          {
            id: "a",
            text: "To keep the buyer’s documents separate from all business records.",
          },
          {
            id: "b",
            text: "To make transaction information easier to retrieve, review and verify.",
          },
          {
            id: "c",
            text: "To guarantee customs clearance.",
          },
          {
            id: "d",
            text: "To replace the sales agreement.",
          },
        ],
        correct: [
          "b",
        ],
        lessonId: "lesson-4",
      },
      {
        id: "q8",
        text: "Does having an organized financial information file guarantee bank financing?",
        options: [
          {
            id: "a",
            text: "Yes.",
          },
          {
            id: "b",
            text: "Only for exporters.",
          },
          {
            id: "c",
            text: "No. It helps demonstrate the business’s position, but the lender makes its own assessment.",
          },
          {
            id: "d",
            text: "Yes, if the business uses spreadsheets.",
          },
        ],
        correct: [
          "c",
        ],
        lessonId: "lesson-4",
      },
      {
        id: "q9",
        text: "Which is an appropriate way to protect important business records?",
        options: [
          {
            id: "a",
            text: "Store every record on one phone.",
          },
          {
            id: "b",
            text: "Share passwords with all employees.",
          },
          {
            id: "c",
            text: "Maintain secure backups and restrict access to authorized users.",
          },
          {
            id: "d",
            text: "Avoid updating software.",
          },
        ],
        correct: [
          "c",
        ],
        lessonId: "lesson-5",
      },
      {
        id: "q10",
        text: "What should an SME do before purchasing new business software?",
        options: [
          {
            id: "a",
            text: "Buy the most expensive available option.",
          },
          {
            id: "b",
            text: "Identify the business problem, users, cost, security and suitability of the tool.",
          },
          {
            id: "c",
            text: "Replace all existing systems immediately.",
          },
          {
            id: "d",
            text: "Select a tool based only on popularity.",
          },
        ],
        correct: [
          "b",
        ],
        lessonId: "lesson-6",
      },
    ],
  },
  rubric: {
    criteria: [
      {
        id: "business_records_identification",
        title: "Business records identification",
        description: "Identification of relevant records and understanding of their purpose",
        maxPoints: 6,
        mustHave: false,
      },
      {
        id: "digital_organization",
        title: "Digital organization",
        description: "Folder structure, file naming, version control and document retrieval",
        maxPoints: 6,
        mustHave: false,
      },
      {
        id: "spreadsheet_and_register_capability",
        title: "Spreadsheet and register capability",
        description: "Accuracy and usability of business registers and calculations",
        maxPoints: 6,
        mustHave: false,
      },
      {
        id: "finance_and_transaction_documentation",
        title: "Finance and transaction documentation",
        description: "Ability to organize relevant financial, buyer and export information",
        maxPoints: 6,
        mustHave: false,
      },
      {
        id: "data_security_and_backup",
        title: "Data security and backup",
        description: "Appropriate access controls, backup practices and confidentiality",
        maxPoints: 6,
        mustHave: false,
      },
      {
        id: "digital_improvement_plan",
        title: "Digital improvement plan",
        description: "Ability to identify a business process and recommend an appropriate digital improvement",
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
        text: "Knowingly submitting fabricated business records.",
      },
      {
        id: "cf2",
        text: "Exposing sensitive business or customer information through an avoidable access-control failure in the exercise.",
      },
      {
        id: "cf3",
        text: "Being unable to identify or retrieve the submitted business records.",
      },
      {
        id: "cf4",
        text: "Presenting unsupported or inaccurate financial information as verified.",
      },
    ],
  },
  aiPrompts: [],
  staff: {
    facilitatorGuide: "### Facilitator prompts\n\n- Where does your business store its sales information?\n- Can someone other than the owner retrieve a customer record?\n- Can you identify how much a customer owes?\n- Can you establish the quantity of inventory available today?\n- How quickly can you produce the documents requested by a bank?\n- If a buyer asks for your product specifications, which version will you send?\n- What happens if the phone containing your business records is lost?\n- Which process would benefit most from digitization?\n\n## Assessor scoring guide\n\n| Score | Performance description |\n| --- | --- |\n| 0 | No submission or no demonstrated capability |\n| 1 | Very limited understanding; major omissions |\n| 2 | Partial capability; significant gaps |\n| 3 | Functional; basic requirements addressed |\n| 4 | Good; practical and mostly complete |\n| 5 | Strong; consistent and well-organized |\n| 6 | Excellent; accurate, secure and ready for regular business use |\n\nThe assessor must record the reason for any critical failure and provide corrective feedback.",
    liveSessionPlan: "### Duration: 150 minutes\n\n| Time | Activity | Facilitator responsibility | Learner output |\n| --- | --- | --- | --- |\n| 0–10 min | Introduction | Explain the relationship between business records and commercial readiness | Understanding of module |\n| 10–30 min | Business records | Discuss records SMEs need to maintain | Business Records Inventory |\n| 30–50 min | Digital organization | Demonstrate folders, file naming and version control | Digital folder structure |\n| 50–80 min | Spreadsheets | Guide learners through sales, expenses and inventory registers | Working registers |\n| 80–90 min | Break |  |  |\n| 90–110 min | Finance and export documentation | Demonstrate a structured transaction folder | Transaction information file |\n| 110–130 min | Security and backup | Review access, passwords, backups and confidentiality | Security checklist |\n| 130–145 min | Digital tools | Discuss practical digitization opportunities | Improvement recommendation |\n| 145–150 min | Assessment briefing | Explain submissions and assessment requirements | Confirmed submission requirements |",
    hybridSequence: "The platform should contain six lessons:\n\n| Lesson | Content | Required activity |\n| --- | --- | --- |\n| 1 | Understanding business records | Business Records Inventory |\n| 2 | Organizing digital information | Digital folder structure |\n| 3 | Using spreadsheets | Sales, expense or inventory register |\n| 4 | Finance and export documentation | Digital transaction folder |\n| 5 | Data protection and security | Security and Backup Checklist |\n| 6 | Choosing digital tools | Digital Improvement Recommendation |\n\nEach lesson should include instructional material, a worked example, a practical exercise and a knowledge check.\n\nLearners should be able to save their work and continue later.",
  },
};
