import Link from "next/link";
import {
  ArrowRight,
  Building2,
  FlaskConical,
  GraduationCap,
  Network,
  WalletCards,
} from "lucide-react";

const programs = [
  {
    stage: "Stage 01",
    title: "Embassy Business Forums",
    subtitle: "Market Access & Deal Origination",
    description:
      "We collaborate with African embassies to host country-specific forums that introduce SMEs to new markets and identify real demand.",
    outcome: "Qualified SMEs and buyers ready for structured engagement",
    icon: Building2,
  },
  {
    stage: "Stage 02",
    title: "TRADE Program",
    subtitle: "SME Readiness & Export Preparation",
    description:
      "A structured training program preparing SMEs for cross-border trade.",
    outcome: "Export-ready SMEs with clear pricing, compliance, and positioning",
    icon: GraduationCap,
  },
  {
    stage: "Stage 03",
    title: "Andinet Trade Corridor",
    subtitle: "Deal Structuring & Buyer Engagement",
    description:
      "A sector-focused platform where buyers and SMEs engage in structured sourcing sessions.",
    outcome: "LOIs, sample orders, and defined deal pipelines",
    icon: Network,
  },
  {
    stage: "Stage 04",
    title: "Credit & Compliance Support",
    subtitle: "Trade Enablement",
    description:
      "Support for financing, documentation, and logistics alignment.",
    outcome: "Executable and bankable trade opportunities",
    icon: WalletCards,
  },
  {
    stage: "Stage 05",
    title: "Trade Lab",
    subtitle: "Execution & Delivery",
    description:
      "Post-deal support to ensure transactions are completed.",
    outcome: "Shipments delivered and repeat trade established",
    icon: FlaskConical,
  },
];

export default function AndinetPrograms() {
  return (
    <section className="andinet-programs-page andinet-programs-page-v2" style={{ background: '#fff' }}>
      <div className="andinet-programs-shell">
        <section className="andinet-programs-hero andinet-programs-hero-v2" aria-labelledby="andinet-programs-title">
          <h1 id="andinet-programs-title" className="andinet-programs-title">
            Our Trade Execution Model
          </h1>
          <p className="andinet-programs-description">
            Andinet operates as a multi-stage pipeline, with each component addressing a key
            gap in the trade process.
          </p>
        </section>

        <div className="andinet-programs-stack">
          {programs.map((program) => (
            <article key={program.title} className="andinet-programs-stage-card">
              <div className="andinet-programs-stage-icon">
                <program.icon size={24} strokeWidth={2} aria-hidden />
              </div>
              <div className="andinet-programs-stage-body">
                <p className="andinet-programs-stage-label">{program.stage}</p>
                <h2 className="andinet-programs-stage-title">{program.title}</h2>
                <p className="andinet-programs-stage-subtitle">{program.subtitle}</p>
                <p className="andinet-programs-stage-description">{program.description}</p>
                <div className="andinet-programs-stage-outcome">
                  <span className="andinet-programs-stage-outcome-label">Outcome:</span>
                  <span>{program.outcome}</span>
                </div>
              </div>
            </article>
          ))}
        </div>

        <section className="andinet-programs-cta" aria-labelledby="andinet-programs-cta-title">
          <h2 id="andinet-programs-cta-title" className="andinet-programs-cta-title" style={{ fontSize: '1.3rem' }}>
            Ready to Enter the Pipeline?
          </h2>
          <p className="andinet-programs-cta-copy">
            Whether you&apos;re an SME, buyer, or institutional partner, there&apos;s a stage designed
            for you.
          </p>
          <Link href="/andinet/contact" className="andinet-programs-cta-button" style={{ fontSize: '1.05rem' }}>
            Get Involved
            <ArrowRight size={18} aria-hidden />
          </Link>
        </section>
      </div>
    </section>
  );
}
