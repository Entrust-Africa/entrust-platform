import Image from "next/image";

export default function AboutSection() {
  return (
    <section id="about-ea" className="about-section section-padding" style={{ background: 'var(--color-bg)' }}>
      <div className="about-container section-container">
        <h2 className="entrust-section-title text-center">About Entrust Africa</h2>
        <p className="entrust-page-lead text-center" style={{ maxWidth: 700, marginLeft: 'auto', marginRight: 'auto' }}>
          Our mission is to empower African businesses and communities by providing strategic guidance, practical support, and a trusted platform for growth, connection, and impact. We envision a continent where opportunity is accessible, partnerships are strong, and every entrepreneur can thrive.
        </p>
        <div className="about-mission-vision" style={{ display: 'flex', flexWrap: 'wrap', gap: '2.5rem', justifyContent: 'center', alignItems: 'flex-start' }}>
          <div style={{ flex: '1 1 320px', minWidth: 280 }}>
            <h3 className="entrust-section-title" style={{ fontSize: '1.25rem', color: 'var(--color-accent)', marginBottom: '0.7rem', fontWeight: 700 }}>Our Mission</h3>
            <p className="entrust-page-lead" style={{ fontSize: '1.05rem', color: '#222', lineHeight: 1.7 }}>
              To unlock Africa’s potential by supporting businesses, fostering innovation, and building a collaborative ecosystem for sustainable growth.
            </p>
          </div>
          <div style={{ flex: '1 1 320px', minWidth: 280 }}>
            <h3 className="entrust-section-title" style={{ fontSize: '1.25rem', color: 'var(--color-accent)', marginBottom: '0.7rem', fontWeight: 700 }}>Our Vision</h3>
            <p className="entrust-page-lead" style={{ fontSize: '1.05rem', color: '#222', lineHeight: 1.7 }}>
              A connected Africa where businesses, communities, and partners work together to create lasting impact and shared prosperity.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
