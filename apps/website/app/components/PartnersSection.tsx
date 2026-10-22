import Image from "next/image";

const partners = [
  { name: "Entrust", logo: "/src/assets/entrust-logo.jpeg" },
  { name: "Andinet", logo: "/src/assets/andnet-log.jpeg" },
  { name: "Afri-Bridge", logo: "/src/assets/afri-bridge-logo.jpeg" },
  { name: "BALBBIYS Trading PLC", logo: "/src/assets/partner/partner7.jpeg" },
  // Add more partner logos as needed
];

export default function PartnersSection() {
  return (
    <section className="partners-section" style={{ background: "#fff", padding: "3.5rem 0" }}>
      <div className="partners-container" style={{ maxWidth: 900, margin: "0 auto", padding: "0 1.5rem" }}>
        <h2 style={{ fontFamily: 'Montserrat, Arial, sans-serif', fontWeight: 800, fontSize: '2.1rem', color: '#18181b', marginBottom: '1.5rem', textAlign: 'center' }}>
          Our Partners
        </h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2.2rem', justifyContent: 'center', alignItems: 'center' }}>
          {partners.map((partner) => (
            <div key={partner.name} style={{ background: '#f9fafb', borderRadius: 14, boxShadow: '0 2px 8px #e5e7eb', padding: '1.2rem 2.2rem', minWidth: 120, minHeight: 80, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <Image src={partner.logo} alt={partner.name + ' logo'} width={100} height={60} style={{ objectFit: 'contain', maxHeight: 60 }} />
              {partner.name === 'BALBBIYS Trading PLC' && (
                <span style={{ marginTop: 8, fontSize: 14, fontWeight: 500, color: '#222', textAlign: 'center', wordBreak: 'break-word' }}>
                  BALBBIYS Trading PLC
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
