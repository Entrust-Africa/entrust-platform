import Link from "next/link";
import { BarChart3, BriefcaseBusiness, Compass, Handshake, Settings2, Target } from "lucide-react";

const services = [
  {
    icon: Compass,
    title: "Market Entry Strategy",
    description:
      "Comprehensive market research, competitive analysis, and go-to-market roadmaps tailored for African economies.",
    points: [
      "Market sizing & opportunity mapping",
      "Competitive landscape analysis",
      "Go-to-market roadmap",
      "Regulatory navigation",
    ],
  },
  {
    icon: BarChart3,
    title: "Financial Structuring",
    description:
      "From fundraising readiness to investor matching and deal structuring, we prepare your business to attract and close the right capital.",
    points: [
      "Investor-ready financial models",
      "Pitch deck development",
      "Due diligence preparation",
      "Deal negotiation support",
    ],
  },
  {
    icon: Settings2,
    title: "Operational Readiness",
    description:
      "Building the systems, processes, and teams that allow businesses to scale efficiently across borders and sectors.",
    points: [
      "Process design & optimization",
      "Team structuring & recruitment",
      "Technology stack advisory",
      "KPI frameworks",
    ],
  },
  {
    icon: Target,
    title: "Strategic Advisory",
    description:
      "Hands-on guidance from senior advisors who walk alongside you from concept to execution. We don&apos;t just advise—we do.",
    points: ["Board-level advisory", "Growth strategy", "Partnership development", "Risk management"],
  },
  {
    icon: BriefcaseBusiness,
    title: "Cross-Border Expansion",
    description:
      "Navigate the complexities of expanding across African markets with our deep regional knowledge and on-the-ground networks.",
    points: [
      "Multi-market entry planning",
      "Regulatory compliance",
      "Local partnership facilitation",
      "Cultural intelligence",
    ],
  },
  {
    icon: Handshake,
    title: "Stakeholder Engagement",
    description:
      "Build and maintain relationships with investors, regulators, and partners critical to your success in African markets.",
    points: ["Investor relations", "Government engagement", "Community partnerships", "ESG alignment"],
  },
];

export default function EntrustServices() {
  return (
    <div className="entrust-services-page">
      <section className="entrust-page-shell entrust-hero-block" style={{ marginBottom: '1.5rem' }}>
        <style>{`
          .entrust-hero-block .entrust-kicker,
          .entrust-hero-block .entrust-page-title,
          .entrust-hero-block .entrust-page-lead {
            text-align: left !important;
            margin-left: 0 !important;
            margin-right: 0 !important;
          }
        `}</style>
        <p className="entrust-kicker" style={{ marginBottom: 12 }}>What We Offer</p>
        <h1 className="entrust-page-title" style={{ marginBottom: 12 }}>
          Services Built for African Growth
        </h1>
        <p className="entrust-page-lead" style={{ marginBottom: 32, maxWidth: 700 }}>
          End-to-end strategy and execution services that help SMEs, financial institutions, and investors unlock Africa&apos;s potential.
        </p>
      </section>

      <section className="entrust-page-shell">
        <div className="entrust-services-grid">
          {services.map((service) => (
            <article key={service.title} className="entrust-service-box">
              <div className="entrust-service-icon-box">
                <service.icon size={18} strokeWidth={2.2} aria-hidden className="entrust-green-icon" />
              </div>
              <h2 className="entrust-service-box-title" style={{ textAlign: 'left', marginBottom: 12 }}>{service.title}</h2>
              <p className="entrust-copy mt-3" style={{ textAlign: 'left', marginBottom: 16 }}>{service.description}</p>
              <ul className="entrust-service-list">
                {service.points.map((item) => (
                  <li key={item} className="entrust-service-item" style={{ textAlign: 'left' }}>
                    <span className="entrust-dot" />
                    {item}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="entrust-page-shell">
        <div className="entrust-process-panel">
          <p className="entrust-kicker" style={{ marginBottom: 12, textAlign: 'left' }}>How We Work</p>
          <h2 className="entrust-section-title" style={{ textAlign: 'left', marginBottom: 32 }}>
            A proven four-step framework that takes you from ambition to impact.
          </h2>
          <div className="entrust-steps-grid">
            {[
              {
                label: "Discover",
                text: "Deep-dive into your business, market position, and growth ambitions.",
              },
              {
                label: "Design",
                text: "Craft a tailored strategy with clear milestones and deliverables.",
              },
              {
                label: "Execute",
                text: "Work alongside your team to implement and iterate on the plan.",
              },
              {
                label: "Scale",
                text: "Refine systems and strategies to sustain long-term growth.",
              },
            ].map((step, index) => (
              <div key={step.label} className="entrust-step-card">
                <div className="entrust-step-number">0{index + 1}</div>
                <h3 className="entrust-step-title" style={{ textAlign: 'left', marginBottom: 12 }}>{step.label}</h3>
                <p className="entrust-copy mt-3" style={{ textAlign: 'left' }}>{step.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA section removed to avoid duplication on home page */}
    </div>
  );
}
