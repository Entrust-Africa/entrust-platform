import Link from "next/link";

const roadmapSteps = [
  {
    number: 1,
    title: "Get Ready",
    subtitle: "SME Readiness Assessment",
    description:
      "Every journey starts with understanding where you are. We conduct a comprehensive readiness assessment of your business — evaluating operational capacity, product quality, compliance, and market positioning to identify gaps and opportunities.",
    bullets: [
      "Business diagnostic & gap analysis",
      "Compliance & standards review",
      "Product-market fit evaluation",
      "Capacity building roadmap",
    ],
  },
  {
    number: 2,
    title: "Get Connected",
    subtitle: "Network & Partner Matching",
    description:
      "Once you’re ready, we connect you with the right partners. Our network spans buyers, distributors, logistics providers, and trade bodies across the continent — ensuring you find the right match for your product and market.",
    bullets: [
      "Buyer & distributor matchmaking",
      "Trade network introductions",
      "Supply chain partner sourcing",
      "Industry association onboarding",
    ],
  },
  {
    number: 3,
    title: "Go Regional",
    subtitle: "Cross-Border Expansion",
    description:
      "Moving beyond your local market requires strategy and support. We help you navigate regulatory requirements, customs procedures, and market entry strategies to successfully expand into new African markets.",
    bullets: [
      "Market entry strategy development",
      "Regulatory & customs guidance",
      "Cross-border logistics planning",
      "Regional pricing & positioning",
    ],
  },
  {
    number: 4,
    title: "Scale Up",
    subtitle: "Export Enablement & Growth",
    description:
      "With your regional presence established, we help you scale. From export documentation to international trade finance, we provide the tools and knowledge to grow your business sustainably across borders.",
    bullets: [
      "Export documentation support",
      "Trade finance & funding access",
      "Quality certification assistance",
      "Ongoing growth advisory",
    ],
  },
];

const pillars = [
  {
    title: "Business & Financial Readiness",
    description: "Costing, pricing, and financial structure.",
  },
  {
    title: "Legal & Compliance",
    description: "Registration, contracts, and regulatory alignment.",
  },
  {
    title: "AfCFTA & Market Access",
    description: "Trade rules, tariffs, and country requirements.",
  },
  {
    title: "Product Readiness",
    description: "Packaging, labeling, and export standards.",
  },
  {
    title: "Digital & Systems Setup",
    description: "ERP, e-tax, and operational systems.",
  },
  {
    title: "Logistics & Fulfillment",
    description: "Shipping, documentation, and delivery.",
  },
  {
    title: "Finance & Credit Readiness",
    description: "Preparing SMEs to access bank and development finance.",
  },
];

const processSteps = [
  "Training sessions (practical and applied)",
  "Assessment and scoring",
  "Gap identification",
  "Targeted support to close those gaps",
];

export default function AfriBridgeHowItWorks() {
  return (
    <div className="trade-page">
      <section className="trade-hero">
        <div className="trade-container">
          <p className="trade-kicker">How It Works</p>
          <h1 className="trade-h1">Your roadmap from local production to regional trade.</h1>
          <p className="trade-lead">
            A structured, step-by-step approach to help African SMEs become export-ready and access new markets across the continent.
          </p>
        </div>
      </section>

      <section className="trade-section" aria-label="Roadmap steps">
        <div className="trade-container">
          <div className="trade-roadmap-grid">
            {roadmapSteps.map((step) => (
              <article key={step.number} className="trade-roadmap-card">
                <div className="trade-roadmap-head">
                  <div className="trade-roadmap-badge" aria-hidden>
                    {step.number}
                  </div>
                  <div>
                    <h2 className="trade-roadmap-title">{step.title}</h2>
                    <p className="trade-roadmap-sub">{step.subtitle}</p>
                  </div>
                </div>
                <p className="trade-body">{step.description}</p>
                <ul className="trade-list">
                  {step.bullets.map((bullet) => (
                    <li key={bullet} className="trade-list-item">
                      <span className="trade-dot" aria-hidden />
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="trade-section" aria-labelledby="trade-program-title">
        <div className="trade-container">
          <article className="trade-program-card">
            <p className="trade-kicker">Flagship Program</p>
            <h2 id="trade-program-title" className="trade-h2">
              The TRADE Program
            </h2>
            <p className="trade-subtitle">Training for Regional Access and Development through Exports</p>
            <h3 className="trade-h3" id="trade-problem">
              Problem
            </h3>
            <p className="trade-body trade-body-tight">
              Many SMEs want to export. Very few are ready. Across Ethiopia and the region, businesses produce quality goods but struggle with documentation, compliance, financing, and market access. The issue isn&apos;t ambition. It&apos;s structure.
            </p>

            <h3 className="trade-h3" id="trade-does">
              What the Program Does
            </h3>
            <p className="trade-body">
              The TRADE Program takes SMEs from local operations to export-ready businesses. It combines practical training, structured assessment, system setup, and direct market alignment. The focus is not just learning, but preparing businesses to actually trade across borders.
            </p>

            <h3 className="trade-h3" id="trade-pillars">
              The 7 Pillars
            </h3>
            <div className="trade-pillars-grid">
              {pillars.map((pillar, index) => (
                <div key={pillar.title} className="trade-pillar-card">
                  <p className="trade-pillar-index">0{index + 1}</p>
                  <h4 className="trade-pillar-title">{pillar.title}</h4>
                  <p className="trade-pillar-copy">{pillar.description}</p>
                </div>
              ))}
            </div>

            <h3 className="trade-h3" id="trade-process">
              How It Works
            </h3>
            <p className="trade-body">
              SMEs move through a structured process that makes export readiness clear and repeatable.
            </p>
            <ol className="trade-steps">
              {processSteps.map((step, index) => (
                <li key={step} className="trade-step-row">
                  <span className="trade-step-badge">{index + 1}</span>
                  <span className="trade-step-text">{step}</span>
                </li>
              ))}
            </ol>

            <div className="trade-split">
              <div>
                <h3 className="trade-h3" id="trade-why">
                  Why It Matters
                </h3>
                <p className="trade-body">
                  Capital for SMEs exists, but it often doesn&apos;t reach them. Banks and development partners need businesses that are structured, compliant, and ready to absorb funding. TRADE builds that pipeline.
                </p>
              </div>
              <div className="trade-outcome">
                <h3 className="trade-h3" id="trade-outcome">
                  Outcome
                </h3>
                <p className="trade-body">
                  Move SMEs from potential exporters to active participants in African trade.
                </p>
              </div>
            </div>

            <div className="trade-cta-row">
              <Link href="/afri-bridge/contact" className="btn-primary">
                Apply to the TRADE Program
              </Link>
              <Link href="/afri-bridge/contact" className="btn-secondary">
                Partner with us to build export-ready SMEs
              </Link>
            </div>
          </article>
        </div>
      </section>

      <section className="trade-section trade-bottom">
        <div className="trade-container">
          <div className="trade-final-panel">
            <div>
              <h2 className="trade-h2 trade-h2-tight">Ready to start your trade journey?</h2>
              <p className="trade-body">
                Apply to the TRADE Program or partner with us to build export-ready SMEs across Africa.
              </p>
            </div>
            <div className="trade-final-actions">
              <Link href="/afri-bridge/contact" className="btn-primary">
                Apply / Partner
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
