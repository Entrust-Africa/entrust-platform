import { BarChart2, Layers, Search, Shield, Users } from "lucide-react";
import Image from "next/image";

const developmentPhases = [
  {
    number: "01",
    title: "Phase 1",
    description: "Internal and partner-facing trade database",
  },
  {
    number: "02",
    title: "Phase 2",
    description: "Verified SME and buyer visibility",
  },
  {
    number: "03",
    title: "Phase 3",
    description: "Scalable digital access to structured trade opportunities",
  },
];

const featureCards = [
  {
    title: "Verified SME Profiles",
    description:
      "Structured profiles of export-ready SMEs with validated capacity, product offerings, and trade readiness.",
    Icon: Shield,
  },
  {
    title: "Buyer Demand Visibility",
    description:
      "Access to real sourcing requirements from regional and global buyers.",
    Icon: Users,
  },
  {
    title: "Trade Opportunity Access",
    description:
      "Clear, structured visibility into cross-border trade opportunities aligned with SME capabilities.",
    Icon: Search,
  },
  {
    title: "Data-Driven Trade Insights",
    description:
      "Information that supports better decision-making for SMEs, buyers, and institutional partners.",
    Icon: BarChart2,
  },
];

export default function AfriBridgeHome() {
  return (
    <div className="afri-bridge-home afri-bridge-home-page" style={{ background: '#fff', color: '#23272f', fontFamily: 'inherit', fontSize: '1.04rem' }}>
      {/* HERO SECTION */}
      <section 
        className="afri-bridge-hero section-padding" 
        style={{
          position: 'relative',
          minHeight: '420px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          background: 'none',
        }}
      >
        <Image
          src="/src/assets/backgroundImg/afri-bridge-bg-image.png"
          alt="Afri-Bridge Hero Background"
          fill
          style={{ objectFit: 'cover', zIndex: 0 }}
          priority
          className="afri-bridge-hero-bg-image"
        />
        <div 
          className="afri-bridge-hero-inner" 
          style={{ 
            position: 'relative', 
            zIndex: 2, 
            textAlign: 'left', 
            justifyContent: 'flex-end',
            maxWidth: '700px',
            padding: '3.5rem 1.5rem',
            margin: '0 0 2.5rem 2.5vw',
            background: 'none',
            boxShadow: 'none',
            borderRadius: 0,
          }}
        >
          <h1 className="afri-bridge-hero-title">Afri-Bridge</h1>
          <span className="afri-bridge-hero-badge">Coming Soon</span>
          <h2 className="afri-bridge-hero-subtitle" style={{ textAlign: 'left' }}>The Digital Gateway for African Trade</h2>
          <p className="afri-bridge-hero-lead">
            A structured digital layer designed to support visibility, access, and scalability across the Andinet trade ecosystem.
          </p>
          {/* CTA in hero */}
          <a href="/community" className="ea-btn ea-btn-primary" style={{ minWidth: 180, fontSize: '1.08rem', padding: '0.85rem 2.2rem', fontWeight: 700, borderRadius: '0.7rem', background: '#19954f', color: '#fff', border: 'none', textDecoration: 'none', display: 'inline-block', marginTop: '2.2rem' }}>Join Community</a>
        </div>
      </section>

      <div className="afri-bridge-main-container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 1.5rem' }}>
        {/* ...existing sections... */}
        <section className="afri-bridge-section bg-white">
          <div className="afri-bridge-content-shell">
            <h2 className="afri-bridge-section-title">Overview</h2>
            <div className="afri-bridge-overview-split">
              <div className="afri-bridge-overview-main">
                <p className="afri-bridge-section-copy">
                  Afri-Bridge is being developed as the digital extension of Andinet—designed to make cross-border trade
                  more visible, accessible, and data-driven.
                </p>
                <p className="afri-bridge-section-copy">
                  While Andinet focuses on structuring and executing trade through physical and institutional engagement,
                  Afri-Bridge provides a continuous digital layer that supports discovery, evaluation, and connection
                  across markets.
                </p>
              </div>
              <div className="afri-bridge-notice-card">
                <strong>NOT a marketplace</strong>
                <span>Afri-Bridge is a digital trade enablement layer, not a listing site.</span>
              </div>
            </div>
          </div>
        </section>

        <section className="afri-bridge-section bg-white">
          <div className="afri-bridge-content-shell">
            <p className="afri-bridge-positioning-eyebrow">Bridging opportunities across Africa</p>
            <h2 className="afri-bridge-section-title">Connecting Africa to opportunity</h2>
            <p className="afri-bridge-section-copy">
              Afri-Bridge is built to strengthen what already works: clearer visibility for SMEs, better signals for
              buyers, and a more connected view of trade flows—so collaboration can scale beyond one-off deals.
            </p>
            <ul className="afri-bridge-gap-list">
              <li className="afri-bridge-gap-row">
                <span className="afri-bridge-gap-dot" />
                <span className="afri-bridge-gap-row-text">Structured representation for export-ready SMEs</span>
              </li>
              <li className="afri-bridge-gap-row">
                <span className="afri-bridge-gap-dot" />
                <span className="afri-bridge-gap-row-text">Clearer paths for buyers to find verified suppliers</span>
              </li>
              <li className="afri-bridge-gap-row">
                <span className="afri-bridge-gap-dot" />
                <span className="afri-bridge-gap-row-text">A connected view of opportunities across markets</span>
              </li>
            </ul>
            <div className="afri-bridge-gap-closing">
              The goal is durable trade relationships—not fragmented, one-time transactions.
            </div>
          </div>
        </section>

      <section className="afri-bridge-section">
        <div className="afri-bridge-content-shell">
          <div className="afri-bridge-connection-header">
            <Layers size={20} className="text-[var(--brand-afri)]" aria-hidden />
            <h2 className="afri-bridge-section-title">How It Connects to Andinet</h2>
          </div>
          <ul className="afri-bridge-connection-list">
            <li>SMEs are prepared through the TRADE Program</li>
            <li>Buyers are engaged through Trade Corridors</li>
            <li>Deals are structured and executed through Andinet</li>
          </ul>
          <p className="afri-bridge-section-copy">
            Afri-Bridge extends this system by creating a digital layer of visibility and access, enabling broader
            participation and scalability.
          </p>
        </div>
      </section>

      <section className="afri-bridge-section">
        <div className="afri-bridge-content-shell afri-bridge-development-shell">
          <h2 className="afri-bridge-section-title">Development Approach</h2>
          <ul className="afri-bridge-dev-list">
            {developmentPhases.map((phase) => (
              <li key={phase.number} className="afri-bridge-dev-item">
                <span className="afri-bridge-dev-number">{phase.number}</span>
                <div className="afri-bridge-dev-content">
                  <h3 className="afri-bridge-dev-title">{phase.title}</h3>
                  <p className="afri-bridge-dev-copy">{phase.description}</p>
                </div>
              </li>
            ))}
          </ul>
          <p className="afri-bridge-section-copy">
            The focus is on quality, verification, and alignment with real trade activity—not volume.
          </p>
        </div>
      </section>

      <section className="afri-bridge-section">
        <div className="afri-bridge-content-shell afri-bridge-features-shell">
          <h2
            className="afri-bridge-section-title"
            style={{
              textAlign: 'center',
              marginLeft: 0,
              marginRight: 0,
              width: '100%'
            }}
          >
            What Afri-Bridge Will Enable
          </h2>
          <div
            className="afri-bridge-feature-grid"
            style={{
              justifyItems: 'start',
              marginLeft: 0,
              paddingLeft: 0
            }}
          >
            {featureCards.map(({ title, description, Icon }) => (
              <article key={title} className="afri-bridge-feature-modern-card card-animate bg-white">
                <div className="afri-bridge-feature-icon text-[var(--brand-afri)]">
                  <Icon size={24} aria-hidden />
                </div>
                <h3 className="afri-bridge-feature-title">{title}</h3>
                <p className="afri-bridge-feature-desc">{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="afri-bridge-section afri-bridge-positioning-section bg-white">
        <div className="afri-bridge-content-shell afri-bridge-positioning-shell bg-white">
          <p className="afri-bridge-positioning-eyebrow">Positioning</p>
          <h2 className="afri-bridge-positioning-title">Afri-Bridge is not a marketplace.</h2>
          <p className="afri-bridge-positioning-copy">
            It is a structured digital gateway that reflects real trade activity and supports more efficient
            cross-border engagement.
          </p>
          <p className="afri-bridge-positioning-note">
            Afri-Bridge complements execution with visibility—enabling a more connected and scalable African trade
            ecosystem.
          </p>
        </div>
      </section>
      </div>
    </div>
  );
}
