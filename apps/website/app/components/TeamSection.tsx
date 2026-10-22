import Image from "next/image";

const team = [
  {
    name: "Thomas Lorato",
    role: "Founder & CEO",
    img: "/src/assets/tomas-image.jpeg",
    bio: "Over two decades of international manufacturing and business leadership experience, focused on building scalable, bankable African businesses.",
  },
  {
    name: "Mikias Melak Birhanie",
    role: "Managing Director, Advisory & Transactions",
    img: "/src/assets/mikias-image.jpeg",
    bio: "Licensed attorney and legal consultant, leading investment structuring, regulatory compliance, and cross-border deal execution.",
  },
  // Add more team members as needed
];

export default function TeamSection() {
  return (
    <section className="team-section" style={{ background: "#f9fafb", padding: "4rem 0" }}>
      <div className="team-container" style={{ maxWidth: 1000, margin: "0 auto", padding: "0 1.5rem" }}>
        <h2 style={{ fontFamily: 'Montserrat, Arial, sans-serif', fontWeight: 800, fontSize: '2.2rem', color: '#18181b', marginBottom: '2rem', textAlign: 'center' }}>
          Meet Our Team
        </h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2.5rem', justifyContent: 'center' }}>
          {team.map((member) => (
            <div key={member.name} style={{ background: '#fff', borderRadius: 18, boxShadow: '0 2px 16px #e5e7eb', padding: '2rem 1.5rem', maxWidth: 320, minWidth: 240, textAlign: 'center' }}>
              <Image src={member.img} alt={member.name} width={120} height={120} style={{ borderRadius: '50%', marginBottom: 18, objectFit: 'cover' }} />
              <h3 style={{ fontFamily: 'Montserrat, Arial, sans-serif', fontWeight: 700, fontSize: '1.18rem', color: '#19954f', marginBottom: 6 }}>{member.name}</h3>
              <p style={{ fontFamily: 'Montserrat, Arial, sans-serif', fontWeight: 600, fontSize: '1rem', color: '#444', marginBottom: 8 }}>{member.role}</p>
              <p style={{ fontFamily: 'Open Sans, Arial, sans-serif', fontSize: '0.98rem', color: '#555', lineHeight: 1.6 }}>{member.bio}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
