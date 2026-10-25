import Image from "next/image";

const media = [
  { type: "photo", src: "/src/assets/event1/photo1.jpg", alt: "Event photo 1" },
  { type: "photo", src: "/src/assets/event2/photo2.jpg", alt: "Event photo 2" },
  // Add more media as needed
];

export default function MediaSection() {
  return (
    <section className="media-section" style={{ background: "#fff", padding: "3.5rem 0" }}>
      <div className="media-container" style={{ maxWidth: 900, margin: "0 auto", padding: "0 1.5rem" }}>
        <h2 style={{ fontFamily: 'var(--font-heading), Arial, sans-serif', fontWeight: 800, fontSize: '2.1rem', color: '#18181b', marginBottom: '1.5rem', textAlign: 'center' }}>
          Media Highlights
        </h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', justifyContent: 'center', alignItems: 'center' }}>
          {media.map((item, idx) => (
            <div key={idx} style={{ background: '#f9fafb', borderRadius: 14, boxShadow: '0 2px 8px #e5e7eb', padding: '0.5rem', minWidth: 120, minHeight: 80, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Image src={item.src} alt={item.alt} width={180} height={120} style={{ objectFit: 'cover', borderRadius: 10 }} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
