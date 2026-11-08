import type { ModuleContent } from "../schema";

// Loaded from Entrust's M09 document. A draft until Entrust approves it; content fixes go back to them.
export const M09_V1_0_0: ModuleContent = {
  module: "M09",
  version: "1.0.0",
  title: "AI and Digital Productivity",
  deliverable: "Digital Productivity Plan and Prompt Library",
  objectives: [
    "Identify business activities that can benefit from digital tools and AI.",
    "Write clear and structured prompts for business tasks.",
    "Use AI to draft business documents and customer communications.",
    "Use AI to support buyer research and market analysis.",
    "Use spreadsheets and digital tools to organize business information.",
    "Use AI to review costing assumptions and identify missing information.",
    "Apply AI to prepare quotations, product descriptions and business profiles.",
    "Verify AI-generated information against reliable sources.",
    "Protect confidential business, customer and financial information.",
    "Develop a practical digital productivity improvement plan.",
  ],
  status: "draft",
  lessons: [
    {
      id: "introduction",
      title: "Module introduction",
      body: "## Purpose\n\nMany SMEs have access to digital tools but do not use them consistently to improve business performance. Some rely on manual records, informal communication and repetitive administrative work. Others use AI tools without knowing how to verify the results or protect confidential business information.\n\nM09 teaches SMEs how to use AI and accessible digital tools to improve everyday business operations, save time, organize information and support export-related decisions.\n\nThe emphasis is on practical application. Participants must complete real business tasks using digital tools, not simply learn about AI.\n\nAI is an assistant for analysis, drafting and productivity. It does not replace management judgment, professional advice, regulatory verification or the SME’s responsibility for its business decisions.\n\n## Entry conditions\n\nThe SME should have:\n\n- A basic understanding of its products or services.\n- Access to a smartphone or computer.\n- Internet access where online tools are used.\n- At least one business activity it wants to improve.\n\nNo advanced technical knowledge or programming experience is required.\n\n## Required outputs\n\nEach SME must submit:\n\n1. SME Digital Productivity Opportunity List.\n2. Personal Business Prompt Library.\n3. Business Administration Improvement Sample.\n4. AI-Assisted Buyer Research Worksheet.\n5. AI-Assisted Cost Review.\n6. Digital Business Content Pack.\n7. SME Digital Tool Selection Matrix.\n8. AI Verification and Data Protection Checklist.\n9. 30-Day Digital Productivity Improvement Plan.\n\n## Completing this module\n\n### Passing requirements\n\n- Minimum practical assessment score: 24/36.\n- Knowledge check: at least 80%.\n- No critical failure.\n\nAn SME completes M09 when it has:\n\n- Completed all required lessons.\n- Achieved at least 80% in the knowledge check.\n- Submitted the required practical outputs.\n- Achieved at least 24/36 in the practical assessment.\n- Passed all critical-failure checks.\n- Submitted its individual learning plan.\n\n### Completion statement\n\nSuccessful completion demonstrates that the SME has completed the TRADE™️ AI and Digital Productivity learning requirements. It does not certify the accuracy of AI-generated information, the security of third-party tools or the commercial success of the SME’s digital activities.",
    },
    {
      id: "lesson-1",
      title: "Understanding AI in everyday business",
      body: "**Objective:** Identify practical ways AI can support SME operations.\n\nArtificial intelligence tools can help SMEs:\n\n- Draft and edit business documents.\n- Summarize information.\n- Organize business records.\n- Develop product descriptions.\n- Prepare customer responses.\n- Analyze sales and expense data.\n- Research potential markets and buyers.\n- Prepare meeting notes.\n- Translate or simplify business communications.\n- Generate ideas for marketing and product development.\n\nAI tools may produce incorrect, incomplete or outdated information. The user remains responsible for checking outputs before using them.\n\n## Practical exercise\n\nParticipants identify five repetitive or time-consuming business activities and classify each as:\n\n- Suitable for AI assistance.\n- Suitable for ordinary digital automation.\n- Requires human judgment or professional review.\n\n**Output:** SME Digital Productivity Opportunity List.",
    },
    {
      id: "lesson-2",
      title: "Writing effective business prompts",
      body: "**Objective:** Learn how to give AI clear instructions and useful context.\n\nA good prompt should establish:\n\n1. Role: What type of assistance is required?\n2. Context: What does the AI need to know?\n3. Task: What should it produce?\n4. Constraints: What must it avoid or include?\n5. Format: How should the result be presented?\n6. Verification: What information remains uncertain?\n\n## Example: Weak prompt\n\n“Write about my company.”\n\n## Improved prompt\n\n“Act as a business communications assistant. My company manufactures industrial workwear in Ethiopia. We produce uniforms for factories, construction companies and institutional buyers. Draft a 100-word company profile for a potential distributor in Kenya. Use clear commercial language. Do not invent production capacity, certifications, customer names or export history. List any missing information that would make the profile stronger.”\n\n## Practical exercise\n\nParticipants write prompts for three tasks:\n\n- Company profile.\n- Buyer introduction.\n- Product description.\n\nThey compare the original output with the revised prompt output.\n\n**Output:** Personal Business Prompt Library.",
    },
    {
      id: "lesson-3",
      title: "AI for business administration and documentation",
      body: "**Objective:** Reduce repetitive administrative work.\n\nAI can assist with:\n\n- Drafting letters and business correspondence.\n- Preparing meeting agendas.\n- Summarizing meeting notes.\n- Creating standard operating procedures.\n- Preparing action lists.\n- Organizing product information.\n- Drafting internal reports.\n- Improving grammar and clarity.\n- Converting unstructured notes into structured information.\n\n## Example prompt\n\n“Convert these meeting notes into an action register. Include the action, responsible person, deadline, priority and status. Do not create missing names or deadlines. Mark missing information as ‘To be confirmed’.”\n\n## Practical exercise\n\nParticipants bring a non-confidential business document or set of notes and use AI to produce a structured action register.\n\n**Output:** Business Administration Improvement Sample.",
    },
    {
      id: "lesson-4",
      title: "AI for buyer research and market development",
      body: "**Objective:** Use AI to organize market research and buyer development.\n\nAI can help SMEs:\n\n- Identify potential buyer categories.\n- Develop buyer search terms.\n- Prepare buyer qualification questions.\n- Compare target markets.\n- Organize market research.\n- Draft buyer introduction messages.\n- Prepare meeting questions.\n- Summarize publicly available market information.\n\nAI-generated buyer names, contact details, import statistics, market demand and company information must be independently verified.\n\nA suggested workflow:\n\n1. Define the product.\n2. Identify target buyer types.\n3. Select a target market.\n4. Research potential buyers using credible sources.\n5. Verify the company’s existence and commercial activity.\n6. Record the evidence.\n7. Prepare an appropriate introduction.\n8. Track responses and follow-up actions.\n\n## Practical exercise\n\nParticipants select one product and target market. They use AI to generate:\n\n- Three buyer categories.\n- Five search terms.\n- Five buyer qualification questions.\n- One buyer introduction message.\n\nThey then identify which information requires independent verification.\n\n**Output:** AI-Assisted Buyer Research Worksheet.",
    },
    {
      id: "lesson-5",
      title: "AI for costing and financial analysis",
      body: "**Objective:** Use AI to support basic financial and commercial analysis.\n\nAI can help:\n\n- Organize cost information.\n- Explain financial ratios.\n- Review spreadsheet structures.\n- Identify missing costing categories.\n- Compare pricing scenarios.\n- Summarize monthly sales and expenses.\n- Prepare cash-flow assumptions.\n- Explain differences between markup and gross margin.\n\nAI must not be treated as the authoritative source of financial figures. Calculations should be checked, and source data must be accurate.\n\n## Example prompt\n\n“Review this export costing structure. Identify missing cost categories, possible double counting and assumptions that need verification. Do not change my figures. Separate confirmed costs, estimates and missing information. Explain the difference between markup and gross margin.”\n\n## Practical exercise\n\nParticipants use a sample costing worksheet and ask AI to identify:\n\n- Missing costs.\n- Unclear assumptions.\n- Possible calculation errors.\n- Commercial risks.\n\nThey independently check the calculations.\n\n**Output:** AI-Assisted Cost Review.",
    },
    {
      id: "lesson-6",
      title: "AI for product marketing and digital presence",
      body: "**Objective:** Improve the quality of the SME’s digital business information.\n\nAI can assist with:\n\n- Company descriptions.\n- Product catalogues.\n- Product specifications.\n- Website content.\n- Social media content.\n- Digital product listings.\n- Buyer-facing presentations.\n- Frequently asked questions.\n- Customer response templates.\n\nThe SME must provide accurate product details. AI must not invent certifications, product performance, production capacity, origin claims or customer references.\n\n## Practical exercise\n\nParticipants prepare:\n\n1. A 100-word company profile.\n2. A product description.\n3. A buyer-facing product information sheet.\n4. A short digital business introduction.\n\n**Output:** Digital Business Content Pack.",
    },
    {
      id: "lesson-7",
      title: "Digital tools and business records",
      body: "**Objective:** Select practical digital tools for everyday operations.\n\nExamples include:\n\n- Spreadsheets for sales, expenses and inventory.\n- Cloud storage for business documents.\n- Digital calendars for deadlines and meetings.\n- Customer relationship management tools for buyer follow-up.\n- Accounting software for financial records.\n- Digital forms for data collection.\n- Task management tools for staff coordination.\n\nThe objective is to select tools based on business needs, affordability, accessibility and ease of use.\n\nAn SME should avoid buying multiple systems that duplicate the same functions.\n\n## Practical exercise\n\nParticipants map one business process and identify:\n\n- Current method.\n- Main problem.\n- Digital tool that could improve it.\n- Cost and implementation requirements.\n- Responsible person.\n- Expected benefit.\n\n**Output:** SME Digital Tool Selection Matrix.",
    },
    {
      id: "lesson-8",
      title: "AI verification, data protection and responsible use",
      body: "**Objective:** Prevent misuse of AI and protect business information.\n\nAI can produce:\n\n- Incorrect facts.\n- Fabricated references.\n- Outdated market information.\n- Incorrect regulatory guidance.\n- Misleading financial analysis.\n- Inaccurate translations.\n- Unsupported claims.\n\nSMEs should apply a verification process:\n\n1. Identify factual claims.\n2. Identify the original source.\n3. Check whether the source is authoritative and current.\n4. Verify calculations independently.\n5. Confirm legal and regulatory information with relevant authorities.\n6. Correct errors before using the output.\n7. Retain evidence where important decisions depend on it.\n\n## Data protection practices\n\n- Do not upload passwords or authentication codes.\n- Do not share confidential customer information unnecessarily.\n- Do not upload sensitive financial or employee records into unapproved tools.\n- Check the privacy and data-use terms of the tools being used.\n- Restrict access to business accounts.\n- Use strong passwords and multifactor authentication where available.\n- Review AI-generated content before sending it to buyers or partners.\n- Obtain appropriate permission before using third-party personal or business information.\n\n## Practical exercise\n\nParticipants review a fictional AI-generated export market report containing inaccurate claims and invented statistics. They identify what must be verified before the report can be used.\n\n**Output:** AI Verification and Data Protection Checklist.",
    },
  ],
  workedExample: {
    title: "Addis Workwear PLC",
    body: "This is a fictional training case.\n\nAddis Workwear manufactures industrial uniforms and wants to develop its regional buyer market.\n\nIts current processes include:\n\n- Preparing product descriptions manually.\n- Tracking buyers in spreadsheets.\n- Preparing quotations from previous documents.\n- Responding to buyer enquiries individually.\n- Keeping some production and sales information in separate files.\n\nThe business wants to improve productivity without investing in expensive software immediately.\n\n## Learner tasks\n\n1. Identify five activities suitable for AI assistance.\n2. Write a prompt to prepare a company profile.\n3. Prepare a product description.\n4. Develop buyer qualification questions.\n5. Use AI to review a sample export costing worksheet.\n6. Identify a suitable digital tool for buyer tracking.\n7. Review an AI-generated market report for accuracy.\n8. Prepare a 30-day digital productivity improvement plan.\n\n## Expected outcome\n\nThe SME produces a practical set of AI-assisted business outputs and identifies how to introduce digital tools into its operations.",
  },
  worksheets: [
    {
      id: "opportunity_list",
      title: "SME Digital Productivity Opportunity List",
      fields: [],
      tables: [
        {
          id: "activities",
          label: "Repetitive or time-consuming activities (five)",
          columns: [
            {
              id: "activity",
              label: "Business activity",
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
                  value: "suitable_for_ai_assistance",
                  label: "Suitable for AI assistance",
                },
                {
                  value: "suitable_for_ordinary_digital_automation",
                  label: "Suitable for ordinary digital automation",
                },
                {
                  value: "requires_human_judgment_or_professional_review",
                  label: "Requires human judgment or professional review",
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
      id: "prompt_library",
      title: "Personal Business Prompt Library",
      fields: [],
      tables: [
        {
          id: "prompts",
          label: "Prompts",
          columns: [
            {
              id: "task",
              label: "Task",
              kind: "choice",
              required: true,
              options: [
                {
                  value: "company_profile",
                  label: "Company profile",
                },
                {
                  value: "buyer_introduction",
                  label: "Buyer introduction",
                },
                {
                  value: "product_description",
                  label: "Product description",
                },
              ],
            },
            {
              id: "original_prompt",
              label: "Original prompt",
              kind: "long_text",
              required: true,
            },
            {
              id: "original_output",
              label: "Original output",
              kind: "long_text",
            },
            {
              id: "revised_prompt",
              label: "Revised prompt",
              kind: "long_text",
              required: true,
            },
            {
              id: "revised_output",
              label: "Revised output",
              kind: "long_text",
            },
            {
              id: "comparison",
              label: "What changed",
              kind: "long_text",
            },
          ],
          minRows: 3,
        },
      ],
      computed: [],
    },
    {
      id: "administration_sample",
      title: "Business Administration Improvement Sample",
      fields: [
        {
          id: "source",
          label: "Non-confidential document or notes",
          kind: "long_text",
          required: true,
          help: "Do not include confidential information.",
        },
      ],
      tables: [
        {
          id: "action_register",
          label: "Action register",
          columns: [
            {
              id: "action",
              label: "Action",
              kind: "text",
              required: true,
            },
            {
              id: "responsible",
              label: "Responsible person",
              kind: "text",
              help: "Mark missing information as 'To be confirmed'.",
            },
            {
              id: "deadline",
              label: "Deadline",
              kind: "text",
              help: "Mark missing information as 'To be confirmed'.",
            },
            {
              id: "priority",
              label: "Priority",
              kind: "text",
            },
            {
              id: "status",
              label: "Status",
              kind: "text",
            },
          ],
          minRows: 1,
        },
      ],
      computed: [],
    },
    {
      id: "buyer_research_worksheet",
      title: "AI-Assisted Buyer Research Worksheet",
      fields: [
        {
          id: "product",
          label: "Product",
          kind: "text",
          required: true,
        },
        {
          id: "target_market",
          label: "Target market",
          kind: "text",
          required: true,
        },
        {
          id: "buyer_categories",
          label: "Three buyer categories",
          kind: "long_text",
          required: true,
        },
        {
          id: "search_terms",
          label: "Five search terms",
          kind: "long_text",
          required: true,
        },
        {
          id: "qualification_questions",
          label: "Five buyer qualification questions",
          kind: "long_text",
          required: true,
        },
        {
          id: "introduction",
          label: "One buyer introduction message",
          kind: "long_text",
          required: true,
        },
        {
          id: "needs_verification",
          label: "Information that requires independent verification",
          kind: "long_text",
          required: true,
        },
      ],
      tables: [],
      computed: [],
    },
    {
      id: "cost_review",
      title: "AI-Assisted Cost Review",
      fields: [
        {
          id: "missing_costs",
          label: "Missing costs",
          kind: "long_text",
          required: true,
        },
        {
          id: "unclear_assumptions",
          label: "Unclear assumptions",
          kind: "long_text",
          required: true,
        },
        {
          id: "calculation_errors",
          label: "Possible calculation errors",
          kind: "long_text",
          required: true,
        },
        {
          id: "commercial_risks",
          label: "Commercial risks",
          kind: "long_text",
          required: true,
        },
        {
          id: "independent_check",
          label: "Your independent check of the calculations",
          kind: "long_text",
          required: true,
        },
      ],
      tables: [],
      computed: [],
    },
    {
      id: "digital_content_pack",
      title: "Digital Business Content Pack",
      fields: [
        {
          id: "company_profile",
          label: "A 100-word company profile",
          kind: "long_text",
          required: true,
        },
        {
          id: "product_description",
          label: "A product description",
          kind: "long_text",
          required: true,
        },
        {
          id: "product_sheet",
          label: "A buyer-facing product information sheet",
          kind: "long_text",
          required: true,
        },
        {
          id: "digital_introduction",
          label: "A short digital business introduction",
          kind: "long_text",
          required: true,
        },
      ],
      tables: [],
      computed: [],
    },
    {
      id: "tool_selection_matrix",
      title: "SME Digital Tool Selection Matrix",
      fields: [],
      tables: [
        {
          id: "processes",
          label: "Business processes",
          columns: [
            {
              id: "process",
              label: "Business process",
              kind: "text",
              required: true,
            },
            {
              id: "current_method",
              label: "Current method",
              kind: "text",
            },
            {
              id: "problem",
              label: "Main problem",
              kind: "long_text",
            },
            {
              id: "tool",
              label: "Digital tool that could improve it",
              kind: "text",
              required: true,
            },
            {
              id: "cost",
              label: "Cost and implementation requirements",
              kind: "long_text",
            },
            {
              id: "responsible",
              label: "Responsible person",
              kind: "text",
            },
            {
              id: "benefit",
              label: "Expected benefit",
              kind: "long_text",
            },
          ],
          minRows: 1,
        },
      ],
      computed: [],
    },
    {
      id: "verification_checklist",
      title: "AI Verification and Data Protection Checklist",
      fields: [
        {
          id: "no_passwords",
          label: "Do not upload passwords or authentication codes",
          kind: "checkbox",
        },
        {
          id: "no_customer_data",
          label: "Do not share confidential customer information unnecessarily",
          kind: "checkbox",
        },
        {
          id: "no_sensitive_records",
          label: "Do not upload sensitive financial or employee records into unapproved tools",
          kind: "checkbox",
        },
        {
          id: "check_terms",
          label: "Check the privacy and data-use terms of the tools being used",
          kind: "checkbox",
        },
        {
          id: "restrict_access",
          label: "Restrict access to business accounts",
          kind: "checkbox",
        },
        {
          id: "strong_passwords",
          label: "Use strong passwords and multifactor authentication where available",
          kind: "checkbox",
        },
        {
          id: "review_content",
          label: "Review AI-generated content before sending it to buyers or partners",
          kind: "checkbox",
        },
        {
          id: "permission",
          label: "Obtain appropriate permission before using third-party personal or business information",
          kind: "checkbox",
        },
      ],
      tables: [
        {
          id: "claims",
          label: "Claims to verify before the report can be used",
          columns: [
            {
              id: "claim",
              label: "Factual claim",
              kind: "long_text",
              required: true,
            },
            {
              id: "source",
              label: "Original source",
              kind: "text",
            },
            {
              id: "current",
              label: "Is the source authoritative and current?",
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
                {
                  value: "not_checked",
                  label: "Not checked",
                },
              ],
            },
            {
              id: "correction",
              label: "Correction before use",
              kind: "long_text",
            },
          ],
          minRows: 1,
        },
      ],
      computed: [],
    },
    {
      id: "individual_learning_plan",
      title: "30-Day Digital Productivity Improvement Plan",
      description: "Three actions. Productivity improvement: which repetitive business task will be improved using AI or a digital tool? Digital records: which business records should be organized or digitized? Responsible AI use: what verification and data protection practices will the business adopt?",
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
                  value: "productivity_improvement",
                  label: "Productivity improvement",
                },
                {
                  value: "digital_records",
                  label: "Digital records",
                },
                {
                  value: "responsible_ai_use",
                  label: "Responsible AI use",
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
        text: "What is the most appropriate role of AI in SME operations?",
        options: [
          {
            id: "a",
            text: "Replace all management decisions.",
          },
          {
            id: "b",
            text: "Support productivity, analysis and drafting while humans verify and make decisions.",
          },
          {
            id: "c",
            text: "Guarantee export success.",
          },
          {
            id: "d",
            text: "Replace all professional service providers.",
          },
        ],
        correct: [
          "b",
        ],
        lessonId: "lesson-1",
      },
      {
        id: "q2",
        text: "Which prompt is more effective?",
        options: [
          {
            id: "a",
            text: "“Help my company.”",
          },
          {
            id: "b",
            text: "“Write something good.”",
          },
          {
            id: "c",
            text: "A prompt that includes context, task, constraints and expected format.",
          },
          {
            id: "d",
            text: "A prompt with no product or business information.",
          },
        ],
        correct: [
          "c",
        ],
        lessonId: "lesson-2",
      },
      {
        id: "q3",
        text: "What should an SME do with an AI-generated buyer list?",
        options: [
          {
            id: "a",
            text: "Treat every name as a verified buyer.",
          },
          {
            id: "b",
            text: "Independently verify company existence, activity and commercial suitability.",
          },
          {
            id: "c",
            text: "Immediately send confidential information.",
          },
          {
            id: "d",
            text: "Assume the contacts are current.",
          },
        ],
        correct: [
          "b",
        ],
        lessonId: "lesson-4",
      },
      {
        id: "q4",
        text: "What is a major risk of using AI for export requirements?",
        options: [
          {
            id: "a",
            text: "AI may produce incorrect or outdated regulatory information.",
          },
          {
            id: "b",
            text: "AI always requires a customs broker.",
          },
          {
            id: "c",
            text: "AI automatically approves shipments.",
          },
          {
            id: "d",
            text: "AI eliminates the need for documentation.",
          },
        ],
        correct: [
          "a",
        ],
        lessonId: "lesson-8",
      },
      {
        id: "q5",
        text: "What is the best way to use AI for costing?",
        options: [
          {
            id: "a",
            text: "Allow AI to invent missing cost figures.",
          },
          {
            id: "b",
            text: "Use AI to identify gaps and review calculations, then verify the figures independently.",
          },
          {
            id: "c",
            text: "Accept every calculation without checking.",
          },
          {
            id: "d",
            text: "Remove all estimates from the costing sheet.",
          },
        ],
        correct: [
          "b",
        ],
        lessonId: "lesson-5",
      },
      {
        id: "q6",
        text: "Which information should not be entered into an unapproved AI tool?",
        options: [
          {
            id: "a",
            text: "A public company description.",
          },
          {
            id: "b",
            text: "General product information.",
          },
          {
            id: "c",
            text: "Passwords, authentication codes and confidential personal or financial information.",
          },
          {
            id: "d",
            text: "Publicly available market information.",
          },
        ],
        correct: [
          "c",
        ],
        lessonId: "lesson-8",
      },
      {
        id: "q7",
        text: "What should an SME do when AI provides a market statistic?",
        options: [
          {
            id: "a",
            text: "Publish it immediately.",
          },
          {
            id: "b",
            text: "Verify the statistic against a credible and current source.",
          },
          {
            id: "c",
            text: "Assume it is accurate because it is specific.",
          },
          {
            id: "d",
            text: "Use it only if it supports the business plan.",
          },
        ],
        correct: [
          "b",
        ],
        lessonId: "lesson-8",
      },
      {
        id: "q8",
        text: "Why should SMEs avoid purchasing multiple digital tools without a clear plan?",
        options: [
          {
            id: "a",
            text: "All digital tools are unsuitable for SMEs.",
          },
          {
            id: "b",
            text: "They may create unnecessary costs, duplicated records and fragmented processes.",
          },
          {
            id: "c",
            text: "Digital tools cannot improve productivity.",
          },
          {
            id: "d",
            text: "They eliminate the need for management.",
          },
        ],
        correct: [
          "b",
        ],
        lessonId: "lesson-7",
      },
      {
        id: "q9",
        text: "What should an SME do before using AI-generated content in a buyer communication?",
        options: [
          {
            id: "a",
            text: "Send it immediately.",
          },
          {
            id: "b",
            text: "Review accuracy, tone, commercial claims and confidential information.",
          },
          {
            id: "c",
            text: "Remove all product specifications.",
          },
          {
            id: "d",
            text: "Assume the buyer will correct mistakes.",
          },
        ],
        correct: [
          "b",
        ],
        lessonId: "lesson-8",
      },
      {
        id: "q10",
        text: "What is the purpose of a digital productivity improvement plan?",
        options: [
          {
            id: "a",
            text: "To purchase as many tools as possible.",
          },
          {
            id: "b",
            text: "To identify practical improvements, responsible persons, timelines and expected results.",
          },
          {
            id: "c",
            text: "To replace the business strategy.",
          },
          {
            id: "d",
            text: "To guarantee an increase in revenue.",
          },
        ],
        correct: [
          "b",
        ],
      },
    ],
  },
  rubric: {
    criteria: [
      {
        id: "opportunity_identification",
        title: "Opportunity identification",
        description: "Identifies relevant SME productivity problems",
        maxPoints: 6,
        mustHave: false,
      },
      {
        id: "prompt_quality",
        title: "Prompt quality",
        description: "Uses clear context, tasks, constraints and output formats",
        maxPoints: 6,
        mustHave: false,
      },
      {
        id: "practical_application",
        title: "Practical application",
        description: "Produces useful business outputs using AI",
        maxPoints: 6,
        mustHave: false,
      },
      {
        id: "buyer_and_market_research",
        title: "Buyer and market research",
        description: "Uses AI appropriately and identifies verification needs",
        maxPoints: 6,
        mustHave: false,
      },
      {
        id: "digital_tool_selection",
        title: "Digital tool selection",
        description: "Selects tools based on business requirements and feasibility",
        maxPoints: 6,
        mustHave: false,
      },
      {
        id: "verification_and_data_protection",
        title: "Verification and data protection",
        description: "Identifies factual risks and applies responsible-use controls",
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
        text: "Presenting unverified AI-generated information as confirmed fact in a material business decision.",
      },
      {
        id: "cf2",
        text: "Using fabricated buyer identities, certifications, market statistics or financial information.",
      },
      {
        id: "cf3",
        text: "Uploading passwords, authentication codes or confidential personal information into an unapproved tool.",
      },
      {
        id: "cf4",
        text: "Using AI-generated regulatory advice as final authority without independent verification.",
      },
      {
        id: "cf5",
        text: "Submitting materially inaccurate AI-generated commercial information to a buyer.",
      },
      {
        id: "cf6",
        text: "Allowing AI to make a material financial or contractual decision without human review.",
      },
    ],
  },
  aiPrompts: [
    {
      id: "company-profile",
      title: "Draft a company profile",
      prompt: "Act as a business communications assistant. My company manufactures industrial workwear in Ethiopia. We produce uniforms for factories, construction companies and institutional buyers. Draft a 100-word company profile for a potential distributor in Kenya. Use clear commercial language. Do not invent production capacity, certifications, customer names or export history. List any missing information that would make the profile stronger.",
      verification: [
        "Identify factual claims.",
        "Identify the original source.",
        "Check whether the source is authoritative and current.",
        "Verify calculations independently.",
        "Confirm legal and regulatory information with relevant authorities.",
        "Correct errors before using the output.",
        "Retain evidence where important decisions depend on it.",
      ],
    },
    {
      id: "action-register",
      title: "Turn meeting notes into an action register",
      prompt: "Convert these meeting notes into an action register. Include the action, responsible person, deadline, priority and status. Do not create missing names or deadlines. Mark missing information as ‘To be confirmed’.",
      verification: [
        "Identify factual claims.",
        "Identify the original source.",
        "Check whether the source is authoritative and current.",
        "Verify calculations independently.",
        "Confirm legal and regulatory information with relevant authorities.",
        "Correct errors before using the output.",
        "Retain evidence where important decisions depend on it.",
      ],
    },
    {
      id: "costing-review",
      title: "Review an export costing structure",
      prompt: "Review this export costing structure. Identify missing cost categories, possible double counting and assumptions that need verification. Do not change my figures. Separate confirmed costs, estimates and missing information. Explain the difference between markup and gross margin.",
      verification: [
        "Identify factual claims.",
        "Identify the original source.",
        "Check whether the source is authoritative and current.",
        "Verify calculations independently.",
        "Confirm legal and regulatory information with relevant authorities.",
        "Correct errors before using the output.",
        "Retain evidence where important decisions depend on it.",
      ],
    },
  ],
  staff: {
    facilitatorGuide: "Facilitators should demonstrate actual tasks using an AI tool available to participants. Where internet access or tool availability is limited, use prepared examples and offline exercises.\n\n## Assessor scoring guide\n\n- 0: No evidence.\n- 1–2: Significant gaps or incorrect work.\n- 3–4: Adequate work with some gaps.\n- 5: Strong work with minor gaps.\n- 6: Complete, accurate and supported work.",
    liveSessionPlan: "Recommended duration: 180 minutes\n\n| Session | Duration |\n| --- | --- |\n| Introduction and practical AI applications | 10 minutes |\n| Lesson 1: Understanding AI | 15 minutes |\n| Lesson 2: Effective prompts | 25 minutes |\n| Lesson 3: Business administration | 20 minutes |\n| Lesson 4: Buyer research | 25 minutes |\n| Lesson 5: Costing and financial analysis | 20 minutes |\n| Lesson 6: Marketing and digital presence | 20 minutes |\n| Lesson 7: Digital tools and records | 15 minutes |\n| Lesson 8: Verification and data protection | 15 minutes |\n| Knowledge check and close | 15 minutes |\n| Total | 180 minutes |",
    hybridSequence: "The platform should present M09 in the following sequence:\n\n1. Module introduction and learning outcomes.\n2. Lesson 1 video and Digital Productivity Opportunity List.\n3. Lesson 2 video and Prompt Library exercise.\n4. Lesson 3 video and Business Administration exercise.\n5. Lesson 4 video and Buyer Research Worksheet.\n6. Lesson 5 video and Cost Review exercise.\n7. Lesson 6 video and Digital Business Content exercise.\n8. Lesson 7 video and Tool Selection Matrix.\n9. Lesson 8 video and Verification Checklist.\n10. Knowledge check.\n11. Practical assessment submission.\n12. Assessor review and feedback.\n13. Individual learning plan.\n14. Module completion record.",
  },
};
