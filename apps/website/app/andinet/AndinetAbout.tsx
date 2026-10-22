import Link from "next/link";
import { AlertTriangle, ArrowRight, Target } from "lucide-react";

const problemPoints = [
  "Unclear export pricing",
  "Compliance and documentation gaps",
  "Limited access to trade finance",
  "Logistics and delivery constraints",
];

export default function AndinetAbout() {
  return (
    <section className="andinet-about-page" style={{ background: '#fff', minHeight: '100vh', width: '100%' }}>
      <div className="andinet-about-shell">
        {/* Hero section with background image only at the top */}
        <section
          className="andinet-about-panel andinet-about-hero-panel"
          aria-labelledby="andinet-about-who-title"
          style={{
            background: `linear-gradient(rgba(255,255,255,0.92), rgba(255,255,255,0.98)), url('/src/assets/backgroundImg/andinet-bg-image1.png') center/cover no-repeat`,
            backgroundRepeat: 'no-repeat',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            minHeight: '340px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '1.2rem',
            marginBottom: '2.5rem',
          }}
        >
          <div className="andinet-about-hero-inner" style={{ maxWidth: 900, margin: '0 auto', padding: '2.5rem', color: '#161b26', textShadow: '0 2px 12px rgba(255,255,255,0.7)', textAlign: 'center' }}>
            <h1 id="andinet-about-who-title" className="andinet-about-display-title" style={{ fontSize: '1.5rem', textAlign: 'center' }}>
              Who We Are
            </h1>
            <div className="andinet-about-display-copy" style={{ textAlign: 'center' }}>
              <p>
                Andinet is a Pan-African trade platform focused on enabling SMEs to participate in
                structured cross-border trade.
              </p>
              <p>
                We work at the intersection of market access, SME development, and trade
                execution, bridging the gap between opportunity and delivery.
              </p>
            </div>
          </div>
        </section>

        <section className="andinet-about-panel andinet-about-problem-panel" aria-labelledby="andinet-about-problem-title" style={{ background: '#fff', paddingLeft: '2.5rem', marginLeft: 0, maxWidth: 900 }}>
          <div className="andinet-about-section-header" style={{ textAlign: 'left', alignItems: 'flex-start', marginLeft: 0, paddingLeft: 0 }}>
            <div className="andinet-about-icon andinet-about-icon-problem">
              <AlertTriangle size={22} strokeWidth={2.1} aria-hidden />
            </div>
            <h2 id="andinet-about-problem-title" className="andinet-about-section-title" style={{ fontSize: '1.7rem', fontFamily: 'var(--font-heading), system-ui, sans-serif', fontWeight: 700, margin: 0 }}>
              The Problem
            </h2>
          </div>
          <p className="andinet-about-section-copy" style={{ fontSize: '1.05rem', fontFamily: 'var(--font-body), system-ui, sans-serif', margin: 0 }}>
            Across Africa, trade platforms have improved access and visibility. However, most
            engagements stop at introductions. SMEs face practical challenges after meeting buyers:
          </p>
          <div className="andinet-about-problem-grid" style={{ marginLeft: 0 }}>
            {problemPoints.map((point) => (
              <div key={point} className="andinet-about-problem-pill">
                <span className="andinet-about-problem-dot" aria-hidden />
                <span>{point}</span>
              </div>
            ))}
          </div>
          <p className="andinet-about-problem-note" style={{ fontSize: '1.05rem', fontFamily: 'var(--font-body), system-ui, sans-serif', margin: 0 }}>
            As a result, many trade opportunities do not convert into actual transactions.
          </p>
        </section>

        <section className="andinet-about-panel andinet-about-solution-panel" aria-labelledby="andinet-about-solution-title" style={{ background: '#fff', paddingLeft: '2.5rem', marginLeft: 0, maxWidth: 900 }}>
          <div className="andinet-about-solution-inner" style={{ textAlign: 'left', alignItems: 'flex-start', marginLeft: 0, paddingLeft: 0 }}>
            <h2 id="andinet-about-solution-title" className="andinet-about-section-title" style={{ fontSize: '1.7rem', fontFamily: 'var(--font-heading), system-ui, sans-serif', fontWeight: 700, margin: 0 }}>
              Our Solution
            </h2>
            <div className="andinet-about-section-copy andinet-about-solution-copy" style={{ fontSize: '1.05rem', fontFamily: 'var(--font-body), system-ui, sans-serif', margin: 0 }}>
              <p>
                Andinet operates a structured pipeline that supports SMEs and partners from initial
                engagement through to execution.
              </p>
              <p>
                By aligning embassies, financial institutions, and private sector actors, we create
                an environment where trade is not only discussed but completed.
              </p>
            </div>
            <Link href="/andinet/programs" className="andinet-about-cta" style={{ fontSize: '0.98rem', minHeight: '2.2rem', padding: '0.45rem 1.1rem', borderRadius: '0.55rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontWeight: 600, marginTop: '1.2rem', background: '#19954f', color: '#fff', textDecoration: 'none' }}>
              See Our Model
              <ArrowRight size={16} aria-hidden />
            </Link>
          </div>
        </section>

        <section className="andinet-about-panel andinet-about-vision-panel" aria-labelledby="andinet-about-vision-title">
          <div className="andinet-about-vision-inner" style={{ maxWidth: 900, margin: '0', marginLeft: '0', paddingLeft: '2.5rem', textAlign: 'left', alignItems: 'flex-start', display: 'flex', flexDirection: 'column' }}>
            <h2 id="andinet-about-vision-title" className="andinet-about-section-title andinet-about-vision-title" style={{ fontSize: '1.7rem', fontFamily: 'var(--font-heading), system-ui, sans-serif', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', background: '#ede9fe', borderRadius: '0.5rem', padding: '0.25rem', marginRight: '0.5rem' }}>
                <Target size={20} strokeWidth={2.1} aria-hidden />
              </span>
              Our Vision
            </h2>
            <p className="andinet-about-section-copy andinet-about-vision-copy" style={{ fontSize: '1.05rem', fontFamily: 'var(--font-body), system-ui, sans-serif', margin: 0 }}>
              To increase the number of African SMEs successfully trading across borders and
              participating in regional and global value chains.
            </p>
          </div>
        </section>
      </div>
    </section>
  );
}
