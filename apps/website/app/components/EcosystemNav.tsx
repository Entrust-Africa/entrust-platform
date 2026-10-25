"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Menu, X } from "lucide-react";

const PLATFORMS = [
  {
    id: "entrust" as const,
    label: "Entrust",
    href: "/entrust",
    logo: "/src/assets/entrust-logo.jpeg",
    brandLogo: "/src/assets/entrust-africa-logo.jpeg",
  },
  {
    id: "andinet" as const,
    label: "Andinet",
    href: "/andinet",
    logo: "/src/assets/andnet-log.jpeg",
  },
  {
    id: "afri-bridge" as const,
    label: "Afri-bridge",
    href: "/afri-bridge",
    logo: "/src/assets/afri-bridge-logo.jpeg",
  },
];

const SECTION_LINKS: Record<
  (typeof PLATFORMS)[number]["id"],
  { label: string; href: string }[]
> = {
  entrust: [
    { label: "Home", href: "/entrust" },
    { label: "About", href: "/entrust/about" },
    { label: "Services", href: "/entrust/services" },
    { label: "Experience", href: "/entrust/experience" },
    { label: "Contact", href: "/entrust/contact" },
  ],
  andinet: [
    { label: "Home", href: "/andinet" },
    { label: "About", href: "/andinet/about" },
    { label: "Events", href: "/andinet/events" },
    { label: "Programs", href: "/andinet/programs" },
    { label: "Partners", href: "/andinet/partners" },
    { label: "Community", href: "/andinet/community" },
    { label: "Contact", href: "/andinet/contact" },
  ],
  "afri-bridge": [
    { label: "Home", href: "/afri-bridge" },
    { label: "Contact", href: "/afri-bridge/contact" },
  ],
};

function activePlatform(pathname: string): (typeof PLATFORMS)[number]["id"] | null {
  if (pathname === "/entrust" || pathname.startsWith("/entrust/")) return "entrust";
  if (pathname === "/andinet" || pathname.startsWith("/andinet/")) return "andinet";
  if (pathname === "/afri-bridge" || pathname.startsWith("/afri-bridge/")) return "afri-bridge";
  return null;
}

function linkMatches(pathname: string, href: string): boolean {
  if (href === "/entrust" || href === "/andinet" || href === "/afri-bridge") {
    return pathname === href;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function EcosystemNavContent({ pathname }: { pathname: string }) {
  const [previousPathname, setPreviousPathname] = useState(pathname);
  const [open, setOpen] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const switcherRef = useRef<HTMLDivElement | null>(null);

  if (pathname !== previousPathname) {
    setPreviousPathname(pathname);
    setOpen(false);
    setSwitcherOpen(false);
  }

  const platform = activePlatform(pathname);
  const currentLinks = platform ? SECTION_LINKS[platform] : [];
  const otherPlatforms = PLATFORMS.filter((item) => item.id !== platform);
  const activePlatformConfig = PLATFORMS.find((item) => item.id === platform) ?? PLATFORMS[0];
  const platformLabel = activePlatformConfig.label;
  // Use platform-specific logo for each platform, Entrust Africa logo for main/other pages
  let logoSrc = "/src/assets/entrust-africa-logo.jpeg";
  let logoAlt = "Entrust Africa logo";
  if (platform === "entrust") {
    logoSrc = "/src/assets/entrust-logo.jpeg";
    logoAlt = "Entrust logo";
  } else if (platform === "andinet") {
    logoSrc = "/src/assets/andnet-log.jpeg";
    logoAlt = "Andinet logo";
  } else if (platform === "afri-bridge") {
    logoSrc = "/src/assets/afri-bridge-logo.jpeg";
    logoAlt = "Afri-bridge logo";
  }
  const themeClass =
    platform === "andinet"
      ? "theme-andinet"
      : platform === "afri-bridge"
        ? "theme-afri"
        : "theme-entrust";
  // Add transparent logo class if on Gateway Home page
  const isGatewayHome = pathname === "/GatwayHome" || pathname === "/features/gateway";
  const logoClass =
    (platform === "andinet" || platform === "afri-bridge"
      ? "h-5 sm:h-6"
      : "h-5 sm:h-6") + (isGatewayHome ? " gateway-logo-transparent" : "");

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!switcherRef.current) return;
      if (!switcherRef.current.contains(event.target as Node)) {
        setSwitcherOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <header className={`eco-nav ${themeClass}`}>
      <div className="eco-nav-bar">
        <div className="eco-nav-inner">
          <Link href="/" className={`eco-nav-brand${isGatewayHome ? ' gateway-logo-parent' : ''}`} aria-label="Platform home">
            <Image
              src={logoSrc}
              alt={logoAlt}
              width={180}
              height={56}
              className={`${logoClass} w-auto rounded-md object-contain`}
              style={{ width: "auto" }}
              priority
            />
            <span className="eco-nav-brand-text">
              <span className="eco-nav-brand-title">Entrust Africa</span>
              {platform && (
                <span className="eco-nav-brand-sub">{platformLabel}</span>
              )}
            </span>
          </Link>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: 'auto' }}>
            <nav className="eco-nav-platforms" aria-label="Current platform sections">
              {/* Only show global Home link if not on a platform page */}
              {!platform && (
                <Link
                  href="/"
                  className={`eco-nav-platform${pathname === '/' ? ' is-active' : ''}`}
                  aria-current={pathname === '/' ? 'page' : undefined}
                >
                  Home
                </Link>
              )}
              {currentLinks.map((item) => {
                const isActive = linkMatches(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`eco-nav-platform ${isActive ? "is-active" : ""}`}
                    aria-current={isActive ? "page" : undefined}
                  >
                    {item.label}
                  </Link>
                );
              })}
              {/* Only show global Contact link if not on a platform page */}
              {!platform && (
                <Link
                  href="/contact"
                  className={`eco-nav-platform${pathname === '/contact' ? ' is-active' : ''}`}
                  aria-current={pathname === '/contact' ? 'page' : undefined}
                >
                  Contact
                </Link>
              )}
            </nav>
            <div className="eco-nav-desktop-end">
              {/* Removed Join, Events, Partner quick action buttons for navigation cleanup */}
              <div className="eco-nav-switcher" ref={switcherRef}>
                <button
                  type="button"
                  className="eco-nav-switcher-btn"
                  aria-expanded={switcherOpen}
                  aria-haspopup="menu"
                  onClick={() => setSwitcherOpen((value) => !value)}
                >
                  {platform ? 'Switch Platform' : 'Choose Platform'}
                  <ChevronDown size={16} aria-hidden />
                </button>
                {switcherOpen ? (
                  <div className="eco-nav-switcher-menu" role="menu" aria-label="Switch platform">
                    {otherPlatforms.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="eco-nav-switcher-link"
                        onClick={() => setSwitcherOpen(false)}
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <button
            type="button"
            className="eco-nav-toggle"
            aria-expanded={open}
            aria-controls="eco-nav-mobile-panel"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X size={22} aria-hidden /> : <Menu size={22} aria-hidden />}
            <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
          </button>
        </div>

      </div>

      {open ? (
        <div id="eco-nav-mobile-panel" className="eco-nav-mobile" role="dialog" aria-modal="true">
          <div className="eco-nav-mobile-section">
            <p className="eco-nav-mobile-heading">{platformLabel} Africa</p>
            <div className="eco-nav-mobile-links">
              {currentLinks.map((item) => {
                const isActive = linkMatches(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`eco-nav-mobile-link ${isActive ? "is-active" : ""}`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Removed Quick actions (Join, Events, Partner) from mobile navigation for navigation cleanup */}

          <div className="eco-nav-mobile-section">
            <p className="eco-nav-mobile-heading">Switch Platform</p>
            <div className="eco-nav-mobile-links">
              {otherPlatforms.map((item) => {
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="eco-nav-mobile-link"
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>


        </div>
      ) : null}
    </header>
  );
}

export default function EcosystemNav() {
  const pathname = usePathname();

  return <EcosystemNavContent pathname={pathname} />;
}
