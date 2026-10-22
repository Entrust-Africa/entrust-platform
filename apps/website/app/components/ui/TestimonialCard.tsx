"use client";

import React from "react";

interface TestimonialCardProps {
  quote: string;
  category?: "SME" | "Client";
  context?: string;
  company?: string;
}

export default function TestimonialCard({ quote, category, context, company }: TestimonialCardProps) {
  return (
    <div
      className="testimonial-card"
      style={{
        background: "#fff",
        borderRadius: 18,
        boxShadow: "0 2px 12px #e5e7eb",
        padding: "2.2rem 1.7rem",
        minHeight: 260, // Increased for equal height
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        border: "1.5px solid #e0e7ef",
        transition: "box-shadow 0.2s, transform 0.2s",
        cursor: "pointer",
        position: "relative",
        overflow: "hidden",
        margin: 0,
      }}
      onMouseEnter={e => {
        e.currentTarget.style.boxShadow = "0 8px 32px -8px #16a34a33";
        e.currentTarget.style.transform = "translateY(-4px) scale(1.03)";
      }}
      onMouseLeave={e => {
        e.currentTarget.style.boxShadow = "0 2px 12px #e5e7eb";
        e.currentTarget.style.transform = "none";
      }}
    >
      <span style={{ fontSize: 38, color: "#16a34a", marginBottom: 10, lineHeight: 1 }}>&ldquo;</span>
      <p style={{ fontFamily: "Open Sans, Arial, sans-serif", fontSize: "1.13rem", color: "#19954f", fontStyle: "italic", marginBottom: 18, marginTop: 0, textAlign: "center", lineHeight: 1.6 }}>
        {quote}
      </p>
      <div style={{ marginTop: "auto", width: "100%" }}>
        {context && (
          <div style={{ fontWeight: 700, color: "#18181b", fontSize: "1.08rem", marginBottom: 8, textAlign: "center" }}>{context}</div>
        )}
        {company && (
          <div style={{ fontFamily: "Montserrat, Arial, sans-serif", color: "#555", fontWeight: 600, fontSize: "1rem", marginTop: 4, textAlign: "center" }}>{company}</div>
        )}
        {/* Placeholder for logo */}
        <div style={{ height: 28, marginTop: 8 }}>
          {/* <img src="/path/to/logo.png" alt="Company Logo" style={{ maxHeight: 28 }} /> */}
        </div>
      </div>
      {category && (
        <div style={{ position: "absolute", top: 18, right: 18, background: "#e6f4ea", color: "#15803d", fontWeight: 700, fontSize: 12, borderRadius: 8, padding: "2px 10px" }}>
          {category}
        </div>
      )}
    </div>
  );
}
