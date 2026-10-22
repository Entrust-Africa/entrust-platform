import Link from "next/link";
import Image from "next/image";

export function AboutPreview() {
  return (
    <section className="home-section about-preview">
      <div className="home-section-inner">
        <h2 className="home-section-title">About Entrust Africa</h2>
        <p className="home-section-lead">
          Entrust Africa empowers professionals, entrepreneurs, and diaspora communities by building networks, events, and platforms that drive collaboration and opportunity across the continent.
        </p>
        <Link href="/about" className="btn btn-secondary home-section-cta">Learn More</Link>
      </div>
    </section>
  );
}

export function ProgramsOverview() {
  return (
    <section className="home-section programs-overview">
      <div className="home-section-inner">
        <h2 className="home-section-title">Our Programs</h2>
        <ul className="home-programs-list">
          <li>
            <strong>Business Structuring</strong> – Strengthening operations and growth for SMEs.
          </li>
          <li>
            <strong>SME Growth Support</strong> – Practical support for scaling businesses.
          </li>
          <li>
            <strong>Strategic Advisory</strong> – Guidance for market entry and long-term success.
          </li>
        </ul>
        <Link href="/programs" className="btn btn-secondary home-section-cta">View All Programs</Link>
      </div>
    </section>
  );
}

export function FeaturedEvents() {
  // Placeholder: Replace with dynamic event data/component
  return (
    <section className="home-section featured-events">
      <div className="home-section-inner">
        <h2 className="home-section-title">Featured Events</h2>
        <p className="home-section-lead">Join our upcoming events to connect, learn, and grow with the Entrust Africa community.</p>
        <Link href="/events" className="btn btn-primary home-section-cta">See Events</Link>
      </div>
    </section>
  );
}

export function CommunitySection() {
  return (
    <section className="home-section community-section">
      <div className="home-section-inner">
        <h2 className="home-section-title">Community</h2>
        <p className="home-section-lead">Become part of a vibrant network of African professionals, entrepreneurs, and diaspora leaders.</p>
        <Link href="/community" className="btn btn-primary home-section-cta">Join the Community</Link>
      </div>
    </section>
  );
}

export function PartnersLogos() {
  // Placeholder: Replace with real partner logos
  return (
    <section className="home-section partners-logos">
      <div className="home-section-inner">
        <h2 className="home-section-title">Our Partners</h2>
        <div className="home-partners-logos-grid">
          <Image src="/src/assets/partner/partner1.png" alt="Partner 1" width={120} height={60} />
          <Image src="/src/assets/partner/partner2.png" alt="Partner 2" width={120} height={60} />
          <Image src="/src/assets/partner/partner3.png" alt="Partner 3" width={120} height={60} />
        </div>
        <Link href="/partners" className="btn btn-outline home-section-cta">See All Partners</Link>
      </div>
    </section>
  );
}

export function TestimonialsSection() {
  // Placeholder: Replace with real testimonials
  return (
    <section className="home-section testimonials-section">
      <div className="home-section-inner">
        <h2 className="home-section-title">Testimonials</h2>
        <div className="home-testimonials-list">
          <blockquote className="home-testimonial">
            "Entrust Africa helped us scale our business and connect with new partners."
            <footer>– SME Founder</footer>
          </blockquote>
          <blockquote className="home-testimonial">
            "The community and events are top-notch. Highly recommended!"
            <footer>– Community Member</footer>
          </blockquote>
        </div>
      </div>
    </section>
  );
}

export function FinalCTASection() {
  return (
    <section className="home-section final-cta-section">
      <div className="home-section-inner">
        <h2 className="home-section-title">Ready to Get Involved?</h2>
        <div className="home-final-cta-row">
          <Link href="/community" className="btn btn-primary home-section-cta">Join the Community</Link>
          <Link href="/events" className="btn btn-secondary home-section-cta">Register for Events</Link>
          <Link href="/partners" className="btn btn-outline home-section-cta">Become a Partner</Link>
        </div>
      </div>
    </section>
  );
}
