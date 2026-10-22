"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import type { CSSProperties } from "react";
import { ExternalLink, Mail, MapPin, Phone } from "lucide-react";

type Props = {
  headline?: string;
  description?: string;
};

export default function CommonContact({
  headline = "Get in Touch",
  description = "Share your needs and our team will reach out with the right next step.",
}: Props) {
  const pathname = usePathname();
  const isAndinet = pathname.startsWith("/andinet");
  const isAfri = pathname.startsWith("/afri-bridge");
  const accent = isAndinet ? "var(--brand-andinet)" : isAfri ? "var(--brand-afri)" : "var(--brand-entrust)";
  const accentHover = isAndinet
    ? "var(--brand-andinet-hover)"
    : isAfri
      ? "var(--brand-afri-hover)"
      : "var(--brand-entrust-hover)";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{
    name?: string;
    email?: string;
    phone?: string;
    subject?: string;
    message?: string;
  }>({});
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(
    null,
  );
  const [toastVisible, setToastVisible] = useState(false);

  const contactEmails = [
  
    "thomas@entrustafrica.com",
    "info@entrustafrica.com",
  ];
  const contactPhone = "+251 909 039 999";
  const contactLocation = "Addis Ababa, Ethiopia";
  const socialLinks = [
    { label: "Entrust LinkedIn", href: "https://www.linkedin.com/company/entrust-plc/" },
    {
      label: "Andinet LinkedIn",
      href: "https://www.linkedin.com/company/andinet-umoja-connecting-african-businesses/",
    },
    { label: "Thomas Lorato", href: "https://www.linkedin.com/in/thomas-lorato" },
  ];

  const validate = () => {
    const nextErrors: typeof errors = {};

    if (!name.trim()) {
      nextErrors.name = "Please enter your name.";
    }

    if (!email.trim()) {
      nextErrors.email = "Please enter your email address.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      nextErrors.email = "Please enter a valid email address.";
    }

    if (!phone.trim()) {
      nextErrors.phone = "Please enter your phone number.";
    } else if (!/^[+\d][\d\s\-()]{6,}$/.test(phone.trim())) {
      nextErrors.phone = "Please enter a valid phone number.";
    }

    if (!subject.trim()) {
      nextErrors.subject = "Please enter a subject.";
    }

    if (!message.trim()) {
      nextErrors.message = "Please enter your message.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  useEffect(() => {
    if (!toastVisible) return;
    const timer = setTimeout(() => setToastVisible(false), 4200);
    return () => clearTimeout(timer);
  }, [toastVisible]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setToastVisible(false);
    setStatus(null);

    if (!validate()) {
      return;
    }

    try {
      setSubmitting(true);
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name, email, phone, subject, message }),
      });

      const data = (await response.json()) as { error?: string; message?: string };

      if (!response.ok) {
        setStatus({
          type: "error",
          message: data.error ?? "Something went wrong while sending your message.",
        });
        setToastVisible(true);
        return;
      }

      setName("");
      setEmail("");
      setPhone("");
      setSubject("");
      setMessage("");
      setErrors({});
      setStatus({
        type: "success",
        message: data.message ?? "Your message has been sent successfully.",
      });
      setToastVisible(true);
    } catch {
      setStatus({
        type: "error",
        message: "We could not send your message right now. Please try again shortly.",
      });
      setToastVisible(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section
      className="contact-page"
      style={
        {
          "--page-accent": accent,
          "--page-accent-hover": accentHover,
          background: !isAndinet && !isAfri ? '#16a34a' : undefined,
        } as CSSProperties
      }
    >
      <div className="contact-page-inner">
        <div className="contact-hero">
          <h1 className="contact-title">{headline}</h1>
          <p className="contact-description">{description}</p>
        </div>

        <div className="contact-content">
          <aside className="contact-side-card">
            <h2 className="contact-side-title">Contact Information</h2>
            <div className="contact-info-grid">
              {contactEmails.map((contactEmail) => (
                <a key={contactEmail} href={`mailto:${contactEmail}`} className="contact-info-chip">
                  <Mail size={16} aria-hidden className="contact-info-icon is-mail" />
                  <span className="contact-info-meta">
                    <span className="contact-info-value">{contactEmail}</span>
                  </span>
                </a>
              ))}
              <a href="tel:+251911000000" className="contact-info-chip">
                <Phone size={16} aria-hidden className="contact-info-icon" />
                <span className="contact-info-meta">
                  <span className="contact-info-value">{contactPhone}</span>
                </span>
              </a>
              <p className="contact-info-chip is-static">
                <MapPin size={16} aria-hidden className="contact-info-icon" />
                <span className="contact-info-meta">
                  <span className="contact-info-value">{contactLocation}</span>
                </span>
              </p>
            </div>

            <div className="contact-map-wrap">
              <iframe
                title="Entrust Africa location map"
                src="https://www.google.com/maps?q=Addis%20Ababa%2C%20Ethiopia&output=embed"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className="contact-map-frame"
              />
            </div>

            <div className="contact-social-row" aria-label="Social links">
              {socialLinks.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  target="_blank"
                  rel="noreferrer"
                  className={`contact-social-link ${
                    item.label.toLowerCase().includes("linkedin") ? "is-linkedin" : ""
                  }`}
                >
                  {item.label}
                  <ExternalLink size={13} aria-hidden />
                </a>
              ))}
            </div>
          </aside>

          <form className="contact-form-card contact-form-simple" onSubmit={handleSubmit} noValidate>
            <div className="contact-fields">
              <div className="contact-field">
                <label htmlFor="contact-name" className="contact-label">
                  Full Name
                </label>
                <input
                  id="contact-name"
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="contact-input"
                  placeholder="Your full name"
                />
                {errors.name ? <p className="contact-error">{errors.name}</p> : null}
              </div>

              <div className="contact-field-grid">
                <div className="contact-field">
                  <label htmlFor="contact-email" className="contact-label">
                    Email
                  </label>
                  <input
                    id="contact-email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="contact-input"
                    placeholder="you@company.com"
                  />
                  {errors.email ? <p className="contact-error">{errors.email}</p> : null}
                </div>

                <div className="contact-field">
                  <label htmlFor="contact-phone" className="contact-label">
                    Phone Number
                  </label>
                  <input
                    id="contact-phone"
                    type="tel"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    className="contact-input"
                    placeholder="+251 911 000 000"
                  />
                  {errors.phone ? <p className="contact-error">{errors.phone}</p> : null}
                </div>
              </div>

              <div className="contact-field">
                <label htmlFor="contact-subject" className="contact-label">
                  Subject
                </label>
                <input
                  id="contact-subject"
                  type="text"
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  className="contact-input"
                  placeholder="How can we help?"
                />
                {errors.subject ? <p className="contact-error">{errors.subject}</p> : null}
              </div>

              <div className="contact-field">
                <label htmlFor="contact-message" className="contact-label">
                  Message
                </label>
                <textarea
                  id="contact-message"
                  rows={6}
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  className="contact-textarea"
                  placeholder="Tell us about your request..."
                />
                {errors.message ? <p className="contact-error">{errors.message}</p> : null}
              </div>

              <button type="submit" disabled={submitting} className="contact-submit">
                {submitting ? (
                  <span className="contact-submit-loading" aria-live="polite">
                    <span className="contact-spinner" aria-hidden />
                    Sending...
                  </span>
                ) : (
                  "Send Message"
                )}
              </button>

              {status ? <p className="contact-status sr-only">{status.message}</p> : null}
            </div>
          </form>
        </div>
      </div>
      {status && toastVisible ? (
        <div
          className={`contact-toast ${status.type === "success" ? "is-success" : "is-error"}`}
          role="status"
          aria-live="polite"
        >
          <span>{status.message}</span>
          <button
            type="button"
            className="contact-toast-close"
            aria-label="Dismiss notification"
            onClick={() => setToastVisible(false)}
          >
            x
          </button>
        </div>
      ) : null}
    </section>
  );
}
