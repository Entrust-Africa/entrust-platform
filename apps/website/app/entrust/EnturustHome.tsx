import Link from "next/link";
import { ArrowRight, BriefcaseBusiness, LineChart, Layers } from "lucide-react";
import { SectionContainer } from "../components/ui/SectionContainer";
import TestimonialCard from "../components/ui/TestimonialCard";

const services = [
  {
    icon: Layers,
    title: "Business Structuring",
    desc: "We strengthen operational structure, internal systems, and execution discipline for sustainable growth.",
  },
  {
    icon: LineChart,
    title: "SME Growth Support",
    desc: "We help SMEs improve readiness, strengthen performance, and scale with practical support.",
  },
  {
    icon: BriefcaseBusiness,
    title: "Strategic Advisory",
    desc: "We provide strategic guidance for market decisions, business direction, and long-term execution.",
  },
];

const projects = [
  {
    title: "SME Readiness and Structuring Program",
    description:
      "Worked with growth-stage SMEs to improve internal structure, financial clarity, and execution readiness.",
    outcome: "Outcome: stronger operational discipline and improved funding preparedness.",
  },
  {
    title: "Bank-SME Pipeline Development",
    description:
      "Supported alignment between financial institutions and SME clients through deal structuring and readiness support.",
    outcome: "Outcome: improved quality of pipelines and more bankable businesses.",
  },
  {
    title: "Market Entry Execution Support",
    description:
      "Guided companies through practical market expansion planning with clear execution frameworks.",
    outcome: "Outcome: better market readiness and clearer pathways for sustainable growth.",
  },
];

export default function EntrustHome() {
  return (
    <div className="entrust-home">
      <section className="entrust-home-hero" style={{ position: 'relative', overflow: 'hidden' }}>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            background: 'linear-gradient(rgba(255,255,255,0.68), rgba(255,255,255,0.82))',
            zIndex: 1,
            pointerEvents: 'none',
          }}
        />
        <div
          className="entrust-home-hero-inner"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            zIndex: 2,
            position: 'relative',
            marginLeft: '5vw',
            maxWidth: '900px',
            paddingLeft: 0,
            paddingRight: '1.5rem',
            color: '#161b26',
            textShadow: '0 2px 12px rgba(255,255,255,0.7)'
          }}
        >
          <div className="entrust-home-copy" style={{ width: '100%' }}>
            <h1 className="entrust-home-title" style={{ marginBottom: '1.1rem', textAlign: 'left' }}>
              Building Structured Businesses Across Africa
            </h1>
            <p className="entrust-home-lead" style={{ margin: 0, textAlign: 'left', maxWidth: 700 }}>
              We work with SMEs, financial institutions, and investors to strengthen operations, improve structure, and support long-term growth across African markets.
            </p>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem', flexWrap: 'wrap' }}>
              <a
                href="/community"
                className="ea-btn ea-btn-primary"
                style={{ minWidth: 180, fontSize: '1.08rem', padding: '0.85rem 2.2rem', fontWeight: 700, borderRadius: '0.7rem', background: '#19954f', color: '#fff', border: 'none', textDecoration: 'none', display: 'inline-block', marginTop: 0 }}
              >
                Join Community
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="entrust-home-section entrust-home-story-section">
        <div
          className="entrust-home-shell"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            marginLeft: '5vw',
            maxWidth: '900px',
            paddingLeft: 0,
            paddingRight: '1.5rem',
            width: '100%'
          }}
        >
          <h2 className="entrust-home-section-title" style={{ textAlign: 'left', marginBottom: '1.1rem' }}>Our Story</h2>
          <p className="entrust-story-copy" style={{ textAlign: 'left', margin: 0, maxWidth: 700 }}>
            Entrust Africa was founded on the belief that African businesses deserve world-class strategic advisory. We work at the intersection of strategy, finance, and operations to help SMEs and institutions unlock their potential.
          </p>
          <p className="entrust-story-copy" style={{ textAlign: 'left', margin: 0, maxWidth: 700, marginTop: '0.7rem' }}>
            Our approach is hands-on: from designing go-to-market strategies to structuring financials for investor readiness, we walk alongside our clients from concept to execution.
          </p>
        </div>
      </section>

      <section className="entrust-home-section entrust-home-services-section">
        <div
          className="entrust-home-shell"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            marginLeft: '5vw',
            maxWidth: '900px',
            paddingLeft: 0,
            paddingRight: '1.5rem',
          }}
        >
          <div className="entrust-home-section-header entrust-home-text-rail">
            <h2 className="entrust-home-section-title">What We Offer</h2>
            <p className="entrust-home-section-copy">
              End-to-end strategy and execution services for SMEs, financial institutions, and investors looking to unlock Africa&apos;s potential.
            </p>
          </div>
          <div className="entrust-home-summary-grid">
            {services.map(({ icon: Icon, title, desc }) => (
              <article key={title} className="entrust-home-summary-card">
                <div className="entrust-home-summary-icon" aria-hidden>
                  <Icon size={20} strokeWidth={2.1} />
                </div>
                <h3 className="entrust-home-summary-title">{title}</h3>
                <p className="entrust-home-summary-copy">{desc}</p>
              </article>
            ))}
          </div>
          <Link href="/entrust/services" className="entrust-home-inline-link">
            Explore full services
            <ArrowRight size={18} strokeWidth={2.2} aria-hidden />
          </Link>
        </div>
      </section>

      <section className="entrust-home-section entrust-home-experience-section">
        <div
          className="entrust-home-shell"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            marginLeft: '5vw',
            maxWidth: '900px',
            paddingLeft: 0,
            paddingRight: '1.5rem',
          }}
        >
          <div className="entrust-home-section-header entrust-home-text-rail">
            <h2 className="entrust-home-section-title">Track Record</h2>
            <p className="entrust-home-section-copy">
              Practical advisory work across African markets, from readiness and structuring to market expansion and execution support.
            </p>
          </div>
          <div className="entrust-home-summary-grid entrust-home-project-grid">
            {projects.map(({ title, description, outcome }) => (
              <article key={title} className="entrust-home-summary-card entrust-home-project-card">
                <h3 className="entrust-home-summary-title">{title}</h3>
                <p className="entrust-home-summary-copy">{description}</p>
                <p className="entrust-home-summary-outcome">{outcome}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* --- Testimonials Section --- */}
      <section className="entrust-home-section entrust-home-testimonials-section" style={{ background: '#f9fafb', padding: '4rem 0', marginTop: '2.5rem' }}>
        <div className="entrust-home-shell" style={{ maxWidth: 1100, margin: '0 auto', padding: '0 1.5rem' }}>
          <h2 style={{ fontFamily: 'Montserrat, Arial, sans-serif', fontWeight: 800, fontSize: '2rem', color: '#15803d', marginBottom: '2.2rem', textAlign: 'center', letterSpacing: '-0.01em' }}>
            What SMEs Say About Our Programs
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '2rem',
            justifyContent: 'center',
            alignItems: 'stretch',
            margin: '0 auto',
            maxWidth: 1000,
            marginBottom: '3.5rem',
          }}>
            <TestimonialCard quote="We now understand export requirements clearly." category="SME" context="SME Export Training" />
            <TestimonialCard quote="The training helped us structure our pricing and costs." category="SME" context="SME Export Training" />
            <TestimonialCard quote="We are now preparing to export for the first time." category="SME" context="SME Export Training" />
          </div>
          <h2 style={{ fontFamily: 'Montserrat, Arial, sans-serif', fontWeight: 800, fontSize: '2rem', color: '#15803d', marginBottom: '1.5rem', textAlign: 'center', letterSpacing: '-0.01em' }}>
            Client Feedback
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
            gap: '2rem',
            justifyContent: 'center',
            alignItems: 'stretch',
            margin: '0 auto',
            maxWidth: 1000,
          }}>
            <TestimonialCard quote="The session was highly professional, insightful, and directly applicable to our strategic decision-making." category="Client" company="Equatorial Business Group" context="Finance for Non-Finance Training" />
          </div>
        </div>
      </section>
    </div>
  );
}
