import Image from "next/image";
import Link from "next/link";
import { ExternalLink, Mail } from "lucide-react";

const NAV_LINKS = [
  { label: "Entrust", href: "/entrust" },
  { label: "Andinet", href: "/andinet" },
  { label: "Afri-Bridge", href: "/afri-bridge" },
  { label: "Contact", href: "/contact" },
];

const CONTACT_LINKS = [
  { label: "Thomas", href: "https://www.linkedin.com/in/thomas-lorato" },
  { label: "Entrust LinkedIn", href: "https://www.linkedin.com/company/entrust-plc/" },
  { label: "Andinet LinkedIn", href: "https://www.linkedin.com/company/andinet-umoja-connecting-african-businesses/" },
];

const EMAILS = [
  "thomas@entrustafrica.com",
  "info@entrustafrica.com",
];

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="site-footer-brand">
          <Link href="/" className={`site-footer-logo-link${typeof window !== 'undefined' && (window.location.pathname === '/GatwayHome' || window.location.pathname === '/features/gateway') ? ' gateway-logo-parent' : ''}`}> 
            <Image
              src="/src/assets/entrust-africa-logo.jpeg"
              alt="Entrust Africa Logo"
              width={180}
              height={15}
              className={`site-footer-logo${typeof window !== 'undefined' && (window.location.pathname === '/GatwayHome' || window.location.pathname === '/features/gateway') ? ' gateway-logo-transparent' : ''}`}
              style={{ width: "auto", height: "auto" }}
            />
          </Link>
          <p className="site-footer-description">
            Entrust Africa is one ecosystem with three focused platforms: Entrust, Andinet, and
            Afri-bridge. Each section supports growth, connection, and regional trade with a clean,
            professional experience.
          </p>
        </div>

        <div className="site-footer-columns">
          <div>
            <h3 className="site-footer-heading">
              Navigation
            </h3>
            <ul className="site-footer-list">
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="site-footer-link"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="site-footer-heading">
              Connect
            </h3>
            <ul className="site-footer-list">
              {CONTACT_LINKS.map((item) => (
                <li key={item.href}>
                  <a
                    href={item.href}
                    target="_blank"
                    rel="noreferrer"
                    className="site-footer-link inline-flex items-center gap-2"
                  >
                    <ExternalLink size={14} aria-hidden />
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="site-footer-heading">
              Contact
            </h3>
            <ul className="site-footer-list">
              {EMAILS.map((email) => (
                <li key={email}>
                  <a
                    href={`mailto:${email}`}
                    className="site-footer-link inline-flex items-center gap-2"
                  >
                    <Mail size={14} aria-hidden />
                    {email}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="site-footer-bottom-wrap">
        <div className="site-footer-bottom">
          <p>© Entrust Africa. All rights reserved.</p>

        </div>
      </div>
    </footer>
  );
}
