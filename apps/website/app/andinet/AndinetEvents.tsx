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
import Image from "next/image";
import Link from "next/link";


const highlightItems = [
  {
    title: "Quality Network",
    description: "Connect with vetted business leaders, investors, and policymakers.",
  },
  {
    title: "Pan-African Reach",
    description: "Events spanning multiple regions across the African continent.",
  },
  {
    title: "Curated Agenda",
    description: "Structured sessions designed for actionable outcomes and real deals.",
  },
  {
    title: "Lasting Impact",
    description: "Partnerships formed at our events continue to drive growth long after.",
  },
];


export default function AndinetEvents() {
  return (
    <div className="andinet-events-page">
      <section className="andinet-events-shell andinet-events-hero">
        <div className="andinet-events-hero-inner">
          <p className="andinet-events-kicker">Events & Programs</p>
          <h1 className="andinet-events-title">Where Africa&apos;s business leaders connect.</h1>
          <p className="andinet-events-lead">
            Premier Pan-African events fostering collaboration, partnerships, and growth across the continent.
          </p>
        </div>
      </section>

      {/* Second Event Card at the Top */}
      <section className="andinet-events-shell andinet-events-featured">
        <div className="andinet-events-featured-card">
          <div className="andinet-gallery andinet-gallery-second">
            {secondEventImages.map((src, index) => (
              <div
                key={src}
                className="andinet-gallery-item andinet-gallery-second-item"
                style={{ width: '320px', height: '180px', marginRight: '0.5rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', borderRadius: '0.75rem', boxShadow: '0 2px 8px #e5e7eb' }}
              >
                <Image
                  src={src}
                  alt={`Andinet Remmogo Image ${index + 1}`}
                  width={320}
                  height={180}
                  className="andinet-gallery-image rounded-lg shadow-md"
                  loading="lazy"
                  style={{
                    objectFit: 'cover',
                    objectPosition: [3, 5, 6].includes(index) ? 'top' : 'center',
                    maxWidth: '100%',
                    maxHeight: '100%'
                  }}
                />
              </div>
            ))}
          </div>
          <h2 className="andinet-events-h2">Andinet Remmogo</h2>
          <p className="andinet-events-gallery-desc">
            Andinet Remmogo brought together visionaries and changemakers from across Africa to share insights, forge partnerships, and celebrate the spirit of collaboration. The event featured inspiring talks, networking sessions, and showcases of innovative projects.
          </p>
        </div>
      </section>

      {/* First Event Card at the Bottom */}
      <section className="andinet-events-shell andinet-events-featured">
        <div className="andinet-events-featured-card">
          <div className="andinet-gallery andinet-gallery-first">
            {firstEventImages.map((src, index) => (
              <div
                key={src}
                className="andinet-gallery-item andinet-gallery-first-item"
                style={{ width: '320px', height: '180px', marginRight: '0.5rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', borderRadius: '0.75rem', boxShadow: '0 2px 8px #e5e7eb' }}
              >
                <Image
                  src={src}
                  alt={`Andinet Umoja Image ${index + 1}`}
                  width={320}
                  height={180}
                  className="andinet-gallery-image rounded-lg shadow-md"
                  loading="lazy"
                  style={{ objectFit: 'cover', objectPosition: 'center' }}
                />
              </div>
            ))}
          </div>
          <h2 className="andinet-events-h2">Andinet Umoja</h2>
          <p className="andinet-events-gallery-desc">
            Andinet Umoja celebrated unity and innovation, highlighting the achievements of African businesses and the power of cross-border partnerships. Attendees engaged in workshops, keynote speeches, and cultural showcases, making it a memorable gathering for all participants.
          </p>
        </div>
      </section>


      <section className="andinet-events-shell andinet-events-why">
        <div className="andinet-events-why-card">
          <h2 className="andinet-events-h2">Why Attend Andinet Events?</h2>
          <div className="andinet-events-why-grid">
            {highlightItems.map((item) => (
              <div key={item.title} className="andinet-events-why-item">
                <div className="andinet-events-why-icon">
                  <span className="text-lg font-bold">★</span>
                </div>
                <h3 className="andinet-events-why-title">{item.title}</h3>
                <p className="andinet-events-why-copy">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="andinet-events-shell andinet-events-cta">
        <div className="andinet-events-cta-vertical andinet-events-cta-center">
          <h2 className="andinet-events-h2">Ready to join us?</h2>
          <p className="andinet-events-cta-copy">
            Get in touch to learn more about upcoming events, sponsorship opportunities, or partnership enquiries.
          </p>
          <div className="andinet-events-cta-actions">
            <Link href="/andinet/contact" className="btn-primary andinet-events-cta-btn">
              Contact Us →
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
