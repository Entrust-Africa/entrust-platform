import Link from "next/link";
import {
  BarChart3,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  Cpu,
  Globe2,
  LineChart,
  Tractor,
  Truck,
  Users,
  Zap,
} from "lucide-react";

const metrics = [
  {
    value: "120+",
    label: "SMEs Trained",
    icon: Users,
  },
  {
    value: "30+",
    label: "Companies Supported (Consulting & Advisory)",
    icon: BriefcaseBusiness,
  },
  {
    value: "5+",
    label: "Countries Engaged",
    icon: Globe2,
  },
  {
    value: "4",
    label: "Cross-Border Engagements",
    icon: BarChart3,
  },
];

const projects = [
  {
    title: "SME Investment Readiness Programme",
    location: "Botswana & Southern Africa",
    description:
      "Prepared 25+ SMEs for investor engagement through financial restructuring, business model refinement, and pitch preparation. Multiple clients secured funding within 12 months.",
    icon: BarChart3,
  },
  {
    title: "Cross-Border Market Entry",
    location: "East & West Africa",
    description:
      "Guided financial institutions and corporates through multi-market expansion strategies, regulatory navigation, and local partnership development.",
    icon: Globe2,
  },
  {
    title: "Agricultural Value Chain Development",
    location: "Southern Africa",
    description:
      "Designed end-to-end value chain strategies for agribusinesses, connecting smallholder farmers to regional and international markets.",
    icon: BriefcaseBusiness,
  },
];

const sectors = [
  {
    title: "Financial Services",
    description: "Banking, insurance, fintech, and investment fund structuring across Southern and East Africa.",
    icon: Building2,
    tag: "Banking & Capital",
  },
  {
    title: "Agriculture & Agribusiness",
    description: "Value chain development, export readiness, and market access for agri-enterprises.",
    icon: Tractor,
    tag: "Food Systems",
  },
  {
    title: "SME Development",
    description: "Growth advisory, operational scaling, and investor readiness for small and medium enterprises.",
    icon: Users,
    tag: "SME Scaling",
  },
  {
    title: "Trade & Logistics",
    description: "Cross-border trade facilitation, supply chain optimization, and AfCFTA compliance.",
    icon: Truck,
    tag: "Trade Operations",
  },
  {
    title: "Energy & Infrastructure",
    description: "Project development, financing structures, and stakeholder engagement for energy projects.",
    icon: Zap,
    tag: "Infrastructure",
  },
  {
    title: "Technology",
    description: "Go-to-market strategies, fundraising support, and expansion planning for tech companies.",
    icon: Cpu,
    tag: "Digital Growth",
  },
];

export default function EntrustExperience() {
  return (
    <div className="entrust-experience-page">
      <section className="entrust-page-shell entrust-hero-block text-center">
        <p className="entrust-kicker" style={{ textAlign: 'center', margin: '0 auto 1.5rem auto' }}>Track Record</p>
        <h1 className="entrust-story-title" style={{ textAlign: 'center', marginBottom: '1.5rem', fontWeight: 700, fontSize: '2rem', color: '#1a1a1a', letterSpacing: '-0.5px' }}>
          Our Experience
        </h1>
        <p className="entrust-page-lead">
          Proven, hands-on experience across African markets, sectors, and institutions.
        </p>
      </section>

      <section className="entrust-page-shell">
        <div className="entrust-metrics-grid">
          {metrics.map((metric) => (
            <div
              key={metric.label}
              className="entrust-metric-card"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '1.5rem 1rem',
                minHeight: 160,
                background: '#fff',
                borderRadius: 18,
                boxShadow: '0 2px 12px #e5e7eb',
                border: '1.5px solid #e0e7ef',
                textAlign: 'center',
                wordBreak: 'break-word',
                overflowWrap: 'break-word',
                width: '100%',
                maxWidth: 260,
                margin: '0 auto',
              }}
            >
              <div className="entrust-metric-icon" style={{ marginBottom: 10 }}>
                <metric.icon size={24} strokeWidth={2.2} aria-hidden className="entrust-green-icon" />
              </div>
              <p className="entrust-metric-value" style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>{metric.value}</p>
              <p
                className="entrust-metric-label"
                style={{
                  fontSize: 15,
                  fontWeight: 500,
                  margin: '8px 0 0 0',
                  lineHeight: 1.3,
                  maxWidth: 220,
                  minHeight: 0,
                  width: '100%',
                  wordBreak: 'break-word',
                  overflowWrap: 'break-word',
                  textAlign: 'center',
                  hyphens: 'auto',
                  whiteSpace: 'normal',
                  padding: 0,
                }}
              >
                {metric.label}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="entrust-page-shell">
        <div className="text-center" style={{ maxWidth: 700, margin: '0 auto' }}>
          <h2
            className="entrust-section-title text-center"
            style={{
              marginBottom: '1.2rem',
              maxWidth: 700,
              marginLeft: 'auto',
              marginRight: 'auto',
            }}
          >
            Project Highlights
          </h2>
          <p className="entrust-page-lead" style={{ maxWidth: '100%', marginLeft: 'auto', marginRight: 'auto' }}>
            Selected engagements that demonstrate our approach and impact.
          </p>
        </div>

        <div className="entrust-project-grid">
          {projects.map((project) => (
            <article key={project.title} className="entrust-project-card">
              <div className="entrust-project-icon">
                <project.icon size={18} strokeWidth={2.2} aria-hidden className="entrust-green-icon" />
              </div>
              <h3 className="entrust-project-title">{project.title}</h3>
              <p className="entrust-project-location">{project.location}</p>
              <p className="entrust-copy mt-4">{project.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="entrust-page-shell">
        <div className="text-center" style={{ maxWidth: 700, margin: '0 auto' }}>
          <h2 className="entrust-section-title text-center">Sectors We Serve</h2>
          <p className="entrust-page-lead" style={{ maxWidth: '100%', marginLeft: 'auto', marginRight: 'auto' }}>
            Deep expertise across the industries driving Africa&apos;s growth.
          </p>
        </div>

        <div className="entrust-sector-grid">
          {sectors.map((sector) => (
            <div key={sector.title} className="entrust-sector-card">
              <div className="entrust-sector-head">
                <div className="entrust-sector-icon">
                  <sector.icon size={18} strokeWidth={2.2} aria-hidden className="entrust-green-icon" />
                </div>
                <p className="entrust-sector-tag">{sector.tag}</p>
              </div>
              <h3 className="entrust-sector-title">{sector.title}</h3>
              <p className="entrust-sector-copy">{sector.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA section removed to avoid duplication on home page */}
    </div>
  );
}
