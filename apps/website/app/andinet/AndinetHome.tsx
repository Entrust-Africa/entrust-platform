import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Banknote,
  Building2,
  CalendarDays,
  FlaskConical,
  Globe,
  GraduationCap,
  Handshake,
  Network,
  Users,
} from "lucide-react";

const firstEventImages = [
  "/src/assets/event1/first-event-image2.jpeg",
  "/src/assets/event1/first-event-image31.jpeg",
  "/src/assets/event1/first-event-image41.jpeg",
  "/src/assets/event1/first-event-image5.jpeg",
  "/src/assets/event1/first-event-image61.jpeg",
  "/src/assets/event1/first-event-image7.jpeg",
  "/src/assets/event1/first-event-image8.jpeg",
  "/src/assets/event1/first-event-image91.jpeg",
];

const secondEventImages = [
  "/src/assets/event2/second-event-image1.jpeg",
  "/src/assets/event2/second-event-image2.jpeg",
  "/src/assets/event2/second-event-image3.jpeg",
  "/src/assets/event2/second-event-image4.jpeg",
  "/src/assets/event2/second-event-image5.jpeg",
  "/src/assets/event2/second-event-image6.jpeg",
  "/src/assets/event2/second-event-image7.jpeg",
  "/src/assets/event2/second-event-image8.jpeg",
  "/src/assets/event2/second-event-image9.jpeg",
];

const offers = [
  {
    icon: Users,
    title: "Networking",
    description:
      "Connect with business leaders, investors, and innovators across Africa.",
  },
  {
    icon: CalendarDays,
    title: "Events",
    description:
      "Premier Pan-African events fostering collaboration and growth.",
  },
  {
    icon: Globe,
    title: "Programs",
    description:
      "Initiatives like Andinet Umoja and Remmogo driving cross-border partnerships.",
  },
  {
    icon: Handshake,
    title: "Partnerships",
    description:
      "Building bridges between institutions, governments, and the private sector.",
  },
];

const pipelineSteps = [
  {
    number: "1",
    title: "Market Access",
    subtitle: "Embassy Forums",
    icon: Building2,
  },
  {
    number: "2",
    title: "Preparation",
    subtitle: "TRADE Program",
    icon: GraduationCap,
  },
  {
    number: "3",
    title: "Deal Structuring",
    subtitle: "Trade Corridor",
    icon: Network,
  },
  {
    number: "4",
    title: "Enablement",
    subtitle: "Credit & Compliance",
    icon: Banknote,
  },
  {
    number: "5",
    title: "Execution",
    subtitle: "Trade Lab",
    icon: FlaskConical,
  },
];

const differencePoints = [
  "Structuring deals",
  "Enabling financing",
  "Supporting execution",
  "Tracking outcomes",
];

const partnerTypes = [
  "Embassies",
  "Financial institutions",
  "Development partners",
  "Private sector buyers",
];

export default function AndinetHome() {
  return (
    <div className="andinet-home andinet-home-page">
      <section className="andinet-hero section-padding" style={{ position: 'relative', minHeight: '420px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', background: 'none' }}>
        <Image
          src="/src/assets/backgroundImg/andinet-bg-image.png"
          alt="Andinet Hero Background"
          fill
          style={{ objectFit: 'cover', zIndex: 0 }}
          priority
          className="andinet-hero-bg-image"
        />
        <div className="andinet-container section-container" style={{ position: 'relative', zIndex: 2 }}>
          <div className="andinet-hero-content">
            <p className="andinet-hero-kicker">Pan-African Trade Platform</p>
            <h1 className="andinet-hero-title">From Connections to Trade Execution</h1>
            <p className="andinet-hero-description">
              Andinet is a Pan-African platform that structures, enables, and supports SME trade across borders.
            </p>
            <div className="andinet-hero-actions">
              <Link href="#how-it-works" className="andinet-primary-button">
                How It Works
                <ArrowRight size={18} aria-hidden />
              </Link>
              <Link href="/andinet/contact" className="andinet-secondary-button">
                Work With Us
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section id="overview" className="andinet-overview">
        <div className="andinet-container">
          <div className="andinet-overview-card">
            <p className="andinet-overview-label">Quick Overview</p>
            <p className="andinet-overview-description">
              Across Africa, businesses are connecting more than ever. But most engagements stop at introductions.
              Deals often stall due to gaps in pricing, compliance, financing, and execution.
            </p>
            <p className="andinet-overview-description">
              Andinet is designed to close that gap by supporting SMEs and partners through a structured process
              that leads to real transactions and delivery.
            </p>
          </div>
          <div className="andinet-pipeline-visual" style={{ display: 'flex', gap: 24, marginTop: 32, flexWrap: 'wrap', justifyContent: 'center' }}>
            {pipelineSteps.map((step) => (
              <div key={step.number} style={{ background: '#fff', border: '1.5px solid #e5e7eb', borderRadius: 16, padding: 20, minWidth: 160, maxWidth: 200, textAlign: 'center', boxShadow: '0 2px 8px #bae6fd', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <step.icon size={32} style={{ color: '#19954f', marginBottom: 8 }} />
                <div style={{ fontWeight: 700, fontSize: 18, color: '#18181b', marginBottom: 4 }}>Step {step.number}</div>
                <div style={{ fontWeight: 700, fontSize: 16, color: '#19954f', marginBottom: 2 }}>{step.title}</div>
                <div style={{ fontSize: 15, color: '#334155' }}>{step.subtitle}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="andinet-story-band" aria-labelledby="andinet-remmogo-title">
        <div className="andinet-container">
          <article className="andinet-story-card">
            <div className="andinet-story-copy">
              <p className="andinet-story-eyebrow">Event Spotlight</p>
              <h2 id="andinet-remmogo-title" className="andinet-story-title" style={{ fontSize: '1.5rem' }}>
                Andinet Remmogo
              </h2>
              <p className="andinet-story-subtitle">Ethiopia-Botswana Business Forum</p>
              <p className="andinet-story-description">
                The second Andinet event brought together public and private sector actors to deepen trade
                relationships, strengthen corridor dialogue, and push conversations toward execution.
              </p>
            </div>
            <div className="andinet-story-gallery andinet-story-gallery-second">
              {secondEventImages.map((src, index) => (
                <div
                  key={src}
                  className={`andinet-story-media ${
                    index === 0 ? "is-feature" : index === 4 ? "is-tall" : ""
                  }`}
                >
                  <Image
                    src={src}
                    alt={`Andinet Remmogo event ${index + 1}`}
                    fill
                    sizes="(max-width: 767px) 100vw, (max-width: 1199px) 50vw, 33vw"
                    className="andinet-story-image andinet-gallery-image-top"
                    loading="lazy"
                    style={{ objectFit: 'cover', objectPosition: 'top' }}
                  />
                </div>
              ))}
            </div>
          </article>
        </div>
      </section>

      <section className="andinet-story-band andinet-story-band-alt" aria-labelledby="andinet-umoja-title">
        <div className="andinet-container">
          <article className="andinet-story-card andinet-story-card-reverse">
            <div className="andinet-story-copy">
              <p className="andinet-story-eyebrow">Founding Event</p>
              <h2 id="andinet-umoja-title" className="andinet-story-title" style={{ fontSize: '1.5rem' }}>
                Andinet Umoja
              </h2>
              <p className="andinet-story-description">
                The first Andinet event laid the foundation for a more structured trade platform by convening
                decision-makers, SMEs, and institutional partners around practical market opportunities.
              </p>
            </div>
            <div className="andinet-story-gallery andinet-story-gallery-first">
              {firstEventImages.map((src, index) => (
                <div
                  key={src}
                  className={`andinet-story-media ${
                    index === 1 ? "is-feature" : index === 5 ? "is-wide" : ""
                  }`}
                  style={{ marginBottom: 8, minHeight: 120, background: 'transparent' }}
                >
                  <Image
                    src={src}
                    alt={`Andinet Umoja event ${index + 1}`}
                    fill
                    sizes="(max-width: 767px) 100vw, (max-width: 1199px) 50vw, 33vw"
                    className="andinet-story-image"
                    loading="lazy"
                    style={{ objectFit: 'cover', objectPosition: 'center', background: 'transparent' }}
                  />
                </div>
              ))}
            </div>
          </article>
        </div>
      </section>

      <section className="andinet-section-band andinet-gap-section" aria-labelledby="andinet-gap-title">
        <div className="andinet-container">
          <div className="andinet-section-shell">
            <h2 id="andinet-gap-title" className="andinet-section-title centered">
              The Gap We Close
            </h2>
            <div className="andinet-section-copy">
              <p>
                Across Africa, businesses are connecting more than ever. But most engagements stop at introductions.
                Deals often stall due to gaps in pricing, compliance, financing, and execution.
              </p>
              <p>
                Andinet is designed to close that gap, supporting SMEs and partners through a structured process that
                leads to real transactions and delivery.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="andinet-section-band andinet-process-section" aria-labelledby="andinet-process-title">
        <div className="andinet-container">
          <div className="andinet-section-shell">
            <div className="andinet-section-heading-group">
              <h2 id="andinet-process-title" className="andinet-section-title">How It Works</h2>
              <p className="andinet-section-subtitle">Our trade execution pipeline</p>
            </div>
            <div className="andinet-process-grid">
              {pipelineSteps.map((step) => (
                <article key={step.number} className="andinet-process-card">
                  <span className="andinet-process-number">{step.number}</span>
                  <div className="andinet-process-icon">
                    <step.icon size={24} strokeWidth={2} aria-hidden />
                  </div>
                  <h3 className="andinet-process-title">{step.title}</h3>
                  <p className="andinet-process-copy">{step.subtitle}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="andinet-section-band" aria-labelledby="andinet-difference-title">
        <div className="andinet-container">
          <div className="andinet-section-shell">
            <div className="andinet-section-heading-group">
              <h2 id="andinet-difference-title" className="andinet-section-title">What Makes Andinet Different</h2>
              <p className="andinet-section-subtitle">Most platforms focus on connections. Andinet focuses on:</p>
            </div>
            <div className="andinet-difference-grid">
              {differencePoints.map((point) => (
                <div key={point} className="andinet-difference-pill">
                  <span className="andinet-difference-dot" aria-hidden />
                  <span>{point}</span>
                </div>
              ))}
            </div>
            <p className="andinet-section-note">
              We measure success by transactions completed, not introductions made.
            </p>
          </div>
        </div>
      </section>

      <section className="andinet-section-band andinet-partners-preview" aria-labelledby="andinet-partners-title">
        <div className="andinet-container">
          <div className="andinet-section-shell">
            <div className="andinet-section-heading-group">
              <h2 id="andinet-partners-title" className="andinet-section-title">Our Partners</h2>
              <p className="andinet-section-subtitle">We work with:</p>
            </div>
            <div className="andinet-partner-pill-row">
              {partnerTypes.map((partner) => (
                <div key={partner} className="andinet-partner-pill">
                  {partner}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="andinet-offers-section" aria-labelledby="andinet-offers-title">
        <div className="andinet-container">
          <h2 id="andinet-offers-title" className="andinet-section-title">
            What Andinet Offers
          </h2>
          <div className="andinet-offers-grid">
            {offers.map((offer, i) => (
              <article
                key={offer.title}
                className="andinet-offer-card text-left card-animate"
                style={{ animationDelay: `${i * 120}ms` }}
              >
                <div className="andinet-offer-icon">
                  <offer.icon size={24} strokeWidth={2.1} aria-hidden />
                </div>
                <h3 className="andinet-offer-title mt-2">{offer.title}</h3>
                <p className="andinet-offer-copy mt-2">{offer.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="andinet-join" aria-labelledby="andinet-join-title">
        <div className="andinet-container shell-12">
          <div className="col-12">
            <div className="andinet-join-panel rounded-lg shadow-lg p-8">
              <div>
                <h2 id="andinet-join-title" className="andinet-join-title text-2xl font-bold text-green-700 text-left">
                  Join the network
                </h2>
                <p className="andinet-join-copy mt-6 text-gray-600 text-left">
                  Tell us what you&apos;re building—we&apos;ll connect you to the right conversations, events, and partners.
                </p>
              </div>
              <Link href="/andinet/contact" className="btn-primary mt-6 bg-green-700 hover:bg-green-800 text-white py-3 px-6 rounded-lg">
                Join Network
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
