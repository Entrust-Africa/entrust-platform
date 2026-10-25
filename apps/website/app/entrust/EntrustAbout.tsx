import Image from "next/image";
import Link from "next/link";
import PartnersSection from "../components/PartnersSection";
import TestimonialsSection from "../components/TestimonialsSection";

export default function EntrustAbout() {
  return (
    <div className="entrust-about-page" style={{ background: '#fff' }}>
      <section className="entrust-page-shell entrust-hero-block" style={{ background: '#fff', padding: '4.5rem 0 3.5rem 0' }}>
        <div
          className="entrust-page-hero"
          style={{
            maxWidth: 900,
            margin: '0 auto',
            padding: '0 1.5rem',
            textAlign: 'center',
            background: '#fff',
          }}
        >
          <h1
            className="entrust-story-title"
            style={{
              textAlign: 'center',
              marginBottom: '1.5rem',
              fontWeight: 700,
              fontSize: '2rem',
              color: '#1a1a1a',
              letterSpacing: '-0.5px',
            }}
          >
            About Entrust Africa
          </h1>
          <p className="entrust-page-lead" style={{ color: '#23272f', fontSize: '1.08rem', marginBottom: 0, lineHeight: '1.8', fontWeight: 400, maxWidth: 700, marginLeft: 'auto', marginRight: 'auto' }}>
            Entrust Africa is a strategy and execution firm working with SMEs, financial institutions, and investors across African markets.
          </p>
        </div>
      </section>

      {/* CTA block after About section */}
      <section style={{ width: '100%', background: '#f6fef9', padding: '2.5rem 0', marginTop: '0', textAlign: 'center' }}>
        <h2 style={{ fontFamily: 'var(--font-heading), system-ui, sans-serif', fontWeight: 700, fontSize: '2rem', marginBottom: '1.2rem', color: '#19954f' }}>Ready to connect?</h2>
        <Link
          href="/community"
          className="ea-btn ea-btn-primary"
          style={{
            minWidth: 180,
            fontSize: '1.08rem',
            padding: '0.85rem 2.2rem',
            fontWeight: 700,
            borderRadius: '0.7rem',
            background: '#19954f',
            color: '#fff',
            border: 'none',
            textDecoration: 'none',
            display: 'inline-block'
          }}
        >
          Join Community
        </Link>
      </section>

      <section className="entrust-page-shell" style={{ background: '#fff' }}>
        <div className="entrust-surface-card" style={{ background: '#fff' }}>
          <div className="entrust-stack-lg">

            <div className="entrust-surface-card entrust-leadership-card" style={{ marginBottom: '2.5rem', background: '#fff', boxShadow: 'none' }}>
              <div className="entrust-founder-grid" style={{ display: 'block' }}>
                <h2 className="entrust-story-title" style={{ textAlign: 'center', marginBottom: '1.5rem', fontWeight: 700, fontSize: '2rem', color: '#1a1a1a', letterSpacing: '-0.5px' }}>Our Story</h2>
                <p className="entrust-story-copy" style={{ fontSize: '1.13rem', color: '#23272f', lineHeight: '1.7', marginBottom: '1.2rem', textAlign: 'center', maxWidth: '820px', marginLeft: 'auto', marginRight: 'auto', fontWeight: 400 }}>
                  Entrust Africa was founded on the belief that African businesses deserve world-class strategic advisory. We work at the intersection of strategy, finance, and operations to help SMEs and institutions unlock their potential.
                </p>
                <p className="entrust-story-copy" style={{ fontSize: '1.13rem', color: '#23272f', lineHeight: '1.7', marginBottom: 0, textAlign: 'center', maxWidth: '820px', marginLeft: 'auto', marginRight: 'auto', fontWeight: 400 }}>
                  Our approach is hands-on: from designing go-to-market strategies to structuring financials for investor readiness, we walk alongside our clients from concept to execution.
                </p>
              </div>
            </div>

            <div>
              <h2
                className="entrust-story-title"
                style={{
                  textAlign: 'center',
                  marginBottom: '1.5rem',
                  fontWeight: 700,
                  fontSize: '2rem',
                  color: '#1a1a1a',
                  letterSpacing: '-0.5px',
                }}
              >
                Leadership
              </h2>
              <div className="entrust-leadership-list">
                <div className="entrust-surface-card entrust-leadership-card">
                  <div className="entrust-founder-grid">
                    <div className="entrust-founder-image-wrap">
                      <Image
                        src="/src/assets/tomas-image.jpeg"
                        alt="Thomas Lorato"
                        width={420}
                        height={420}
                        className="entrust-founder-image"
                      />
                    </div>
                    <div>
                      <h3 className="entrust-founder-name">Thomas Lorato</h3>
                      <p className="entrust-founder-role">Founder &amp; CEO</p>
                      <p className="entrust-copy mt-5">
                        Thomas Lorato is the Founder of Entrust Africa, working with financial institutions and SMEs to improve the quality, readiness, and scalability of businesses across African markets.
                      </p>
                      <p className="entrust-copy mt-4">
                        He brings over two decades of international manufacturing experience, along with a track record of leading and managing organizations across different markets. This operational background informs his approach to building businesses that are not only strategic, but executable.
                      </p>
                      <p className="entrust-copy mt-4">
                        His work focuses on bridging the gap between banks and SME clients—supporting deal structuring, financial readiness, and pipeline development that leads to stronger, more bankable businesses.
                      </p>
                      <p className="entrust-copy mt-4">
                        He also leads Andinet and Afri-bridge, platforms designed to expand market access and enable cross-border trade.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="entrust-surface-card entrust-leadership-card">
                  <div className="entrust-founder-grid">
                    <div className="entrust-founder-image-wrap">
                      <Image
                        src="/src/assets/mikias-image.jpeg"
                        alt="Mikias Melak Birhanie"
                        width={560}
                        height={560}
                        className="entrust-founder-image"
                      />
                    </div>
                    <div>
                      <h3 className="entrust-founder-name">Mikias Melak Birhanie</h3>
                      <p className="entrust-founder-role">Managing Director, Advisory &amp; Transactions</p>
                      <p className="entrust-copy mt-5">
                        Mikias Melak Birhanie is a licensed attorney and legal consultant based in Addis Ababa, with expertise in corporate, commercial, labor, and international law. At Entrust Africa, he leads advisory and transaction support work, focusing on investment structuring, regulatory compliance, and cross-border deal execution.
                      </p>
                      <p className="entrust-copy mt-4">
                        He previously worked as an Associate Lawyer at KAL Law Office and served as in-house counsel for Parker Clay Ethiopia, supporting corporate governance, compliance, and international business operations. He also advises SMEs on legal compliance, HR systems, and institutional engagement.
                      </p>
                      <p className="entrust-copy mt-4">
                        Mikias has been actively involved in governance and civil society work, including serving as a General Assembly Member of Transparency International Ethiopia (2016–2024), and founding Public Information Noble (PIN), an organization focused on transparency and access to information.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="entrust-surface-card entrust-leadership-card">
                  <div className="entrust-founder-grid">
                    <div className="entrust-founder-image-wrap">
                      <Image
                        src="/src/assets/fekadu-image.jpeg"
                        alt="Fekadu Welde"
                        width={560}
                        height={560}
                        className="entrust-founder-image"
                      />
                    </div>
                    <div>
                      <h3 className="entrust-founder-name">Fekadu Welde</h3>
                      <p className="entrust-founder-role">Chief Legal &amp; Regulatory Affairs Officer</p>
                      <p className="entrust-copy mt-5">
                        Fekadu Welde is a lawyer and legal consultant based in Ethiopia, with strong experience in corporate, commercial, and regulatory law. At Entrust Africa, he leads legal structuring and regulatory advisory work, supporting cross-border transactions, investment compliance, and institutional engagements.
                      </p>
                      <p className="entrust-copy mt-4">
                        He has worked across legal advisory and consulting roles, supporting businesses on licensing, contract structuring, labor compliance, and dispute resolution. His work helps organizations operate within Ethiopia’s regulatory framework while aligning with broader regional trade and investment requirements.
                      </p>
                      <p className="entrust-copy mt-4">
                        Fekadu is recognized for a practical legal approach that connects regulatory requirements with business execution, helping clients move from compliance challenges to operational clarity.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="entrust-surface-card entrust-leadership-card">
                  <div className="entrust-founder-grid">
                    <div className="entrust-founder-image-wrap">
                      <Image
                        src="/src/assets/tomas-seyum.jpeg"
                        alt="Thomas Seyone"
                        width={560}
                        height={560}
                        className="entrust-founder-image"
                      />
                    </div>
                    <div>
                      <h3 className="entrust-founder-name">Thomas Seyoum Kassaye</h3>
                      <p className="entrust-founder-role">Digital Governance Advisor</p>
                      <p className="entrust-copy mt-5">
                        Thomas Seyoum Kassaye is a seasoned Digital Governance Advisor with over 20 years of experience across international organizations, including the UNHCR, UNEP, UNICEF, UNECA, UNSOS, and UNAMA in the ICT, digital transformation, and information governance sectors. He brings deep expertise in designing and implementing digital systems that enhance institutional efficiency, transparency, and data-driven decision-making, particularly within government and multilateral contexts. He has extensive knowledge in data science, information systems, Archive and Records Management, business analysis, AI/ML, cybersecurity, and digital transformation. He has led the implementation of major digital initiatives, including Electronic Document Management Frameworks (EDMF), cloud migrations, data warehousing, and paperless office projects, across mission-critical environments. Thomas has also worked as a technical lead for AI projects.
                      </p>
                      <p className="entrust-copy mt-4">
                        Thomas currently serves as the Team Lead for Project Management and Policy Development of Records and Archives at the Ministry of Foreign Affairs of Ethiopia, where he leads the digitization of records and modernization of archival systems. He ensures institutional compliance with ISO 15489 and national regulatory standards.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* CTA section removed to avoid duplication on home page */}
          </div>
        </div>
      </section>
      {/* --- Partners Section removed (only one instance should exist, at the bottom if needed) --- */}

      {/* --- Testimonials Section --- */}
      <TestimonialsSection />
    </div>
  );
}
