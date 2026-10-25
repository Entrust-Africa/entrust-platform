const platforms = [
  {
    name: "Entrust",
    tagline: "Strategy, partnerships, and execution readiness across markets and sectors.",
    path: "/entrust",
    logo: "/src/assets/entrust-logo.jpeg",
    cta: "Explore Entrust",
  },
  {
    name: "Andinet",
    tagline: "Trade execution, events, and structured pipelines for African businesses.",
    path: "/andinet",
    logo: "/src/assets/andnet-log.jpeg",
    cta: "Explore Andinet",
  },
  {
    name: "Afri-Bridge",
    tagline: "Digital visibility and access that scales with real trade activity.",
    path: "/afri-bridge",
    logo: "/src/assets/afri-bridge-logo.jpeg",
    cta: "Explore Afri-Bridge",
  },
];

const ecosystemFlow = [
  {
    title: "Clarity & Strategy",
    copy: "Get clear on your goals, partners, and market approach.",
    Icon: Compass,
  },
  {
    title: "Network Activation",
    copy: "Engage with the right people and organizations.",
    Icon: Layers3,
  },
  {
    title: "Trade & Visibility",
    copy: "Execute deals and grow your digital presence.",
    Icon: Sparkles,
  },
];

const ecosystemBenefits = [
  {
    title: "Built for real outcomes",
    copy: "Practical delivery-not just introductions or visibility.",
    Icon: Target,
  },
  {
    title: "Designed for collaboration",
    copy: "SMEs, buyers, institutions, and partners engage through clear paths.",
    Icon: Handshake,
  },
  {
    title: "Grounded in community",
    copy: "Events and networks create momentum across the continent.",
    Icon: Users,
  },
];

import Image from "next/image";
import Link from "next/link";
import { Button } from "./components/ui/Button";
import { Compass, Handshake, Layers3, Sparkles, Target, Users } from "lucide-react";
import { PlatformCard } from "./components/ui/PlatformCard";
import { SectionContainer } from "./components/ui/SectionContainer";
import TestimonialCard from "./components/ui/TestimonialCard";

export default function Gateway() {
  return (
    <main className="gateway-page gateway-bg-image gateway-page-v2 gateway-home-modern">
      <section className="gateway-hm-hero gateway-hm-hero--with-image" aria-labelledby="gateway-title">
        <Image
          src="/src/assets/backgroundImg/afri-bridge-bg-image.png"
          alt="Entrust Africa Gateway Hero Background"
          fill
          priority
          className="gateway-hm-hero-bg-image"
        />
        <div
          className="gateway-hm-hero-inner gateway-shell-balanced gateway-shell-header-aligned gateway-shell-hero-offset"
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
          }}
        >
          <h1 id="gateway-title" className="gateway-hm-title" style={{ marginBottom: '1.1rem' }}>
            Driving Trade, Investment & SME Growth Across Africa
          </h1>
          <div className="gateway-hm-lead">
            <p style={{ margin: 0 }}>
              Entrust Africa enables market access, capacity building, and cross-border partnerships for sustainable economic growth.
            </p>
          </div>
          <div className="gateway-hm-actions" style={{ marginTop: '1.2rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <Button asChild variant="primary">
              <Link href="/community">Join the Community</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/events">Register for Events</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/entrust/contact" style={{ textDecoration: 'none' }}>Become a Partner</Link>
            </Button>
          </div>
        </div>
      </section>

      <SectionContainer className="gateway-hm-section gateway-shell-balanced gateway-shell-right-offset px-0 pt-6 sm:pt-8">
        <div className="gateway-hm-platforms-wrap" id="gateway-platforms">
          <div
            className="gateway-hm-platforms-head"
            style={{
              textAlign: 'center',
              width: '100%',
              maxWidth: '540px',
              marginLeft: 'auto',
              marginRight: 'auto',
            }}
          >
            <h2 className="gateway-hm-platforms-title" style={{ textAlign: 'center', width: '100%' }}>Choose your platform</h2>
            <p className="gateway-hm-platforms-sub">
              Three focused entry points—same ecosystem. Select a card to open that platform.
            </p>
          </div>
          <div className="gateway-hm-platforms-grid">
            {platforms.map((platform) => (
              <PlatformCard
                key={platform.path}
                logo={platform.logo}
                alt={`${platform.name} logo`}
                title={platform.name}
                description={platform.tagline}
                href={platform.path}
                cta={platform.cta}
                className="gateway-hm-platform-card"
              />
            ))}
          </div>
        </div>
      </SectionContainer>
      <SectionContainer className="gateway-hm-section gateway-shell-balanced gateway-shell-right-offset px-0">
        <div className="gateway-section-shell gateway-hm-band px-4 py-10 sm:px-8 sm:py-12">
          <div
            className="gateway-section-heading"
            style={{
              textAlign: 'center',
              width: '100%',
              maxWidth: '540px',
              marginLeft: 'auto',
              marginRight: 'auto',
            }}
          >
            <div>
              <p className="gateway-section-eyebrow" style={{ marginBottom: '0.5rem' }}>How it connects</p>
              <h2 className="gateway-section-title" style={{ marginBottom: '0.5rem' }}>How the ecosystem works together</h2>
              <p className="gateway-section-copy">
                From strategic clarity and network activation to structured trade and digital visibility.
              </p>
            </div>
          </div>
          <div className="gateway-hm-grid-3">
            {ecosystemFlow.map(({ title, copy, Icon }) => (
              <article key={title} className="gateway-hm-card ea-card-stack">
                <div className="ea-card-icon text-[#19954f]" aria-hidden>
                  <Icon size={22} strokeWidth={2} />
                </div>
                <h3 className="ea-card-title">{title}</h3>
                <p className="ea-card-body">{copy}</p>
              </article>
            ))}
          </div>
        </div>
      </SectionContainer>
      <SectionContainer className="gateway-hm-section gateway-shell-balanced gateway-shell-right-offset px-0">
        <div className="gateway-section-shell gateway-hm-band px-4 py-10 sm:px-8 sm:py-12">
          <div
            className="gateway-section-heading"
            style={{
              textAlign: 'center',
              width: '100%',
              maxWidth: '540px',
              marginLeft: 'auto',
              marginRight: 'auto',
            }}
          >
            <div>
              <p className="gateway-section-eyebrow" style={{ marginBottom: '0.5rem' }}>Why it matters</p>
              <h2 className="gateway-section-title" style={{ marginBottom: '0.5rem' }}>Built to be easy to use</h2>
              <p className="gateway-section-copy">
                Movement between strategy, trade execution, and scale should feel coherent—especially on mobile.
              </p>
            </div>
          </div>
          <div className="gateway-hm-grid-3">
            {ecosystemBenefits.map(({ title, copy, Icon }) => (
              <article key={title} className="gateway-hm-card ea-card-stack">
                <div className="ea-card-icon text-[#19954f]" aria-hidden>
                  <Icon size={22} strokeWidth={2} />
                </div>
                <h3 className="ea-card-title">{title}</h3>
                <p className="ea-card-body">{copy}</p>
              </article>
            ))}
          </div>
        </div>
      </SectionContainer>
      <SectionContainer className="gateway-hm-section gateway-shell-balanced gateway-shell-right-offset px-0" style={{ marginTop: '2.5rem', marginBottom: '2.5rem' }}>
        <div style={{ width: '100%', maxWidth: 1100, margin: '0 auto', padding: '0 1.5rem' }}>
          <h2 style={{ fontFamily: 'var(--font-heading), Arial, sans-serif', fontWeight: 800, fontSize: '2rem', color: '#15803d', marginBottom: '2.2rem', textAlign: 'center', letterSpacing: '-0.01em' }}>
            Trusted by SMEs and Organizations Across Africa
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '2rem',
            justifyContent: 'center',
              alignItems: 'stretch', // Ensures equal card heights
            margin: '0 auto',
            maxWidth: 1000,
          }}>
            <TestimonialCard quote="We now understand export requirements clearly." category="SME" />
            <TestimonialCard quote="The training helped us structure our pricing and costs." category="SME" />
            <TestimonialCard quote="The session was highly professional, insightful, and directly applicable to our strategic decision-making." category="Client" company="Equatorial Business Group" context="Finance for Non-Finance Training" />
          </div>
        </div>
      </SectionContainer>
    </main>
  );
}
