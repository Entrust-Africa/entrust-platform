import Link from "next/link";
import {
  ArrowRight,
  Building2,
  Globe,
  Landmark,
  ShoppingBag,
} from "lucide-react";

const andinetPartners = [
  {
    title: "Embassies & Government Institutions",
    icon: Landmark,
    points: [
      "Facilitate market access",
      "Support bilateral trade engagement",
      "Enable country-specific corridors",
    ],
  },
  {
    title: "Financial Institutions",
    icon: Building2,
    points: [
      "Access to structured SME pipelines",
      "Opportunities for trade finance deployment",
      "Participation in deal enablement",
    ],
  },
  {
    title: "Development Partners",
    icon: Globe,
    points: [
      "Support SME capacity building",
      "Enable trade ecosystem development",
      "Track measurable trade outcomes",
    ],
  },
  {
    title: "Private Sector Buyers",
    icon: ShoppingBag,
    points: [
      "Access to pre-qualified suppliers",
      "Structured sourcing environments",
      "Reduced procurement risk",
    ],
  },
];

export default function AndinetPartnersPage() {
  return (
    <main className="andinet-partners-page andinet-partners-page-v2" style={{ background: '#fff' }}>
      <section className="andinet-partners-hero-band" style={{ background: '#fff', padding: '64px 0 32px 0' }}>
        <div className="andinet-partners-hero" style={{ background: '#fff', maxWidth: 900, margin: '0 auto', textAlign: 'center' }}>
          <h1 className="andinet-partners-title" style={{ fontSize: '1.3rem' }}>Working With Andinet</h1>
          <p className="andinet-partners-lead">
            Andinet partners with institutions across the trade ecosystem to enable structured and scalable SME trade.
          </p>
        </div>
      </section>

      <section className="andinet-partners-list-section" style={{ marginTop: 48, marginBottom: 48 }}>
        <div className="andinet-partners-list-grid" style={{ gap: '2.5rem' }}>
          {andinetPartners.map((partner) => (
            <article key={partner.title} className="andinet-partner-card" style={{ boxShadow: '0 8px 32px rgba(25, 149, 79, 0.10)', border: '2px solid #e5e7eb', borderRadius: '1.5rem', padding: '2.5rem 1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: '12rem', background: '#fff' }}>
              <div className="andinet-partner-icon-wrap">
                <partner.icon size={32} />
              </div>
              <h2 className="andinet-partner-card-title" style={{ fontSize: '1.35rem', marginBottom: 16 }}>{partner.title}</h2>
              <ul className="andinet-partner-points">
                {partner.points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="andinet-partners-cta-band" style={{ background: '#fff' }}>
        <div className="andinet-partners-cta" style={{ background: '#fff' }}>
          <h2 className="andinet-partners-cta-title">Partner With Us</h2>
          <p className="andinet-partners-cta-copy">
            Partner with Andinet to enable real trade outcomes across Africa.
          </p>
          <Link href="/andinet/contact" className="andinet-partners-cta-button">
            Get in Touch
            <ArrowRight size={18} />
          </Link>
        </div>
      </section>
    </main>
  );
}
