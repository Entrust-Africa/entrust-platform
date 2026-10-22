"use client";


const smeTestimonials = [
  {
    quote: "We now understand export requirements clearly.",
    company: "Leather and Agro-processing SME"
  },
  {
    quote: "The training helped us structure our pricing and costs.",
    company: "Leather and Agro-processing SME"
  },
  {
    quote: "We are now preparing to export for the first time.",
    company: "Leather and Agro-processing SME"
  }
];

const clientTestimonials = [
  {
    quote: "The session was highly professional, insightful, and directly applicable to our strategic decision-making.",
    company: "Equatorial Business Group",
    context: "Finance for Non-Finance Training"
  }
];

export default function TestimonialsSection() {
  return (
    <section className="testimonials-section" style={{ background: "#f9fafb", padding: "4rem 0" }}>
      <div className="testimonials-container" style={{ maxWidth: 1100, margin: "0 auto", padding: "0 1.5rem" }}>
        {/* SME Testimonials */}
        <h2 style={{ fontFamily: 'Montserrat, Arial, sans-serif', fontWeight: 800, fontSize: '2rem', color: '#15803d', marginBottom: '1.5rem', textAlign: 'center', letterSpacing: '-0.01em' }}>SME Testimonials</h2>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '2rem',
          marginBottom: '3.5rem',
        }}>
          {smeTestimonials.map((t, idx) => (
            <div
              key={idx}
              style={{
                background: '#fff',
                borderRadius: 18,
                boxShadow: '0 2px 12px #e5e7eb',
                padding: '2.2rem 1.7rem',
                minHeight: 180,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                border: '1.5px solid #e0e7ef',
                transition: 'box-shadow 0.2s, transform 0.2s',
                cursor: 'pointer',
                position: 'relative',
                overflow: 'hidden',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.boxShadow = '0 8px 32px -8px #16a34a33';
                e.currentTarget.style.transform = 'translateY(-4px) scale(1.03)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.boxShadow = '0 2px 12px #e5e7eb';
                e.currentTarget.style.transform = 'none';
              }}
            >
              <span style={{ fontSize: 38, color: '#16a34a', marginBottom: 10, lineHeight: 1 }}>&ldquo;</span>
              <p style={{ fontFamily: 'Open Sans, Arial, sans-serif', fontSize: '1.13rem', color: '#19954f', fontStyle: 'italic', marginBottom: 18, marginTop: 0, textAlign: 'center', lineHeight: 1.6 }}>
                {t.quote}
              </p>
              <div style={{ fontFamily: 'Montserrat, Arial, sans-serif', color: '#555', fontWeight: 600, fontSize: '1rem', marginTop: 'auto', textAlign: 'center' }}>{t.company}</div>
              {/* Placeholder for logo */}
              <div style={{ height: 28, marginTop: 8 }}>
                {/* <img src="/path/to/logo.png" alt="Company Logo" style={{ maxHeight: 28 }} /> */}
              </div>
            </div>
          ))}
        </div>

        {/* Client Testimonials */}
        <h2 style={{ fontFamily: 'Montserrat, Arial, sans-serif', fontWeight: 800, fontSize: '2rem', color: '#15803d', marginBottom: '1.5rem', textAlign: 'center', letterSpacing: '-0.01em' }}>Client Testimonials</h2>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
          gap: '2rem',
        }}>
          {clientTestimonials.map((t, idx) => (
            <div
              key={idx}
              style={{
                background: '#fff',
                borderRadius: 18,
                boxShadow: '0 2px 12px #e5e7eb',
                padding: '2.2rem 1.7rem',
                minHeight: 180,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                border: '1.5px solid #e0e7ef',
                transition: 'box-shadow 0.2s, transform 0.2s',
                cursor: 'pointer',
                position: 'relative',
                overflow: 'hidden',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.boxShadow = '0 8px 32px -8px #16a34a33';
                e.currentTarget.style.transform = 'translateY(-4px) scale(1.03)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.boxShadow = '0 2px 12px #e5e7eb';
                e.currentTarget.style.transform = 'none';
              }}
            >
              <div style={{ fontWeight: 700, color: '#18181b', fontSize: '1.08rem', marginBottom: 8, textAlign: 'center' }}>{t.context}</div>
              <span style={{ fontSize: 38, color: '#16a34a', marginBottom: 10, lineHeight: 1 }}>&ldquo;</span>
              <p style={{ fontFamily: 'Open Sans, Arial, sans-serif', fontSize: '1.13rem', color: '#19954f', fontStyle: 'italic', marginBottom: 18, marginTop: 0, textAlign: 'center', lineHeight: 1.6 }}>
                {t.quote}
              </p>
              <div style={{ fontFamily: 'Montserrat, Arial, sans-serif', color: '#555', fontWeight: 600, fontSize: '1rem', marginTop: 'auto', textAlign: 'center' }}>{t.company}</div>
              {/* Placeholder for logo */}
              <div style={{ height: 28, marginTop: 8 }}>
                {/* <img src="/path/to/logo.png" alt="Company Logo" style={{ maxHeight: 28 }} /> */}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
