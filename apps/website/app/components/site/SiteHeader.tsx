"use client";

import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { buttonClasses } from "../ui/Button";
import { ArrowRight, ArrowUpRight, Slat } from "../ui/icons";
import { PatchworkBand } from "./Decor";
import {
  COMPANY_LINKS,
  CONTACT,
  IMG,
  LINKEDIN_PROFILES,
  MENU_PLATFORMS,
  PLATFORM_COLOR,
  PLATFORM_LOGOS,
  PLATFORM_URLS,
} from "../../lib/site";

const EASE = [0.16, 1, 0.3, 1] as const;

/** Two lines that fold into a cross when the menu is open. */
function MenuGlyph({ open }: { open: boolean }) {
  return (
    <span className="relative block h-5 w-5" aria-hidden>
      <motion.span
        className="absolute left-0.5 h-0.5 w-4 rounded-full bg-current"
        initial={false}
        animate={open ? { top: 9, rotate: 45 } : { top: 6, rotate: 0 }}
        transition={{ duration: 0.35, ease: EASE }}
      />
      <motion.span
        className="absolute left-0.5 h-0.5 w-4 rounded-full bg-current"
        initial={false}
        animate={open ? { top: 9, rotate: -45 } : { top: 13, rotate: 0 }}
        transition={{ duration: 0.35, ease: EASE }}
      />
    </span>
  );
}

/** The platform whose page we're on, for the header's brand lockup. */
function platformFor(pathname: string) {
  return Object.values(PLATFORM_LOGOS).find((p) => pathname === p.path || pathname.startsWith(`${p.path}/`));
}

export function SiteHeader() {
  const pathname = usePathname();
  const platform = platformFor(pathname);
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { scrollY } = useScroll();
  const toggleRef = useRef<HTMLButtonElement>(null);

  // The bar stays put; once the page scrolls under it, it turns frosted with a hairline.
  useMotionValueEvent(scrollY, "change", (y) => setScrolled(y > 8));

  // Close on navigation (state adjusted during render, not in an effect).
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  // Lock scroll and listen for Escape while the menu is open.
  useEffect(() => {
    if (!open) return;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        toggleRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-[background-color,box-shadow,backdrop-filter] duration-300 ${
          open
            ? "bg-transparent text-on-forest"
            : scrolled
              ? "bg-page/80 text-ink shadow-[0_1px_0_var(--color-line)] backdrop-blur-md"
              : "bg-transparent text-ink"
        }`}
      >
        <div className="shell flex h-14 items-center justify-between md:h-16">
          <div className="flex min-w-0 items-center gap-3 md:gap-5">
            <Link href="/" aria-label="Entrust Africa, home" className="relative block h-8 w-[150px] md:h-9 md:w-[169px]">
              <Image
                src={IMG.logo}
                alt="Entrust Africa"
                fill
                sizes="169px"
                preload
                className={`object-contain object-left transition-opacity duration-300 ${open ? "opacity-0" : "opacity-100"}`}
              />
              <Image
                src={IMG.logoLight}
                alt=""
                fill
                sizes="169px"
                className={`object-contain object-left transition-opacity duration-300 ${open ? "opacity-100" : "opacity-0"}`}
              />
            </Link>

            {/* Brand lockup on platform pages: divider + app badge slide in beside the Entrust logo. */}
            <AnimatePresence mode="wait" initial={false}>
              {platform && (
                <motion.div
                  key={platform.path}
                  className="flex min-w-0 items-center gap-3 md:gap-5"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.45, ease: EASE }}
                >
                  <span aria-hidden className={`h-7 w-px shrink-0 ${open ? "bg-line-on-forest" : "bg-line-strong"}`} />
                  <Link href={platform.path} className="group/badge flex min-w-0 items-center gap-2.5">
                    <Image
                      src={platform.src}
                      alt=""
                      width={32}
                      height={32}
                      className="h-7 w-7 shrink-0 rounded-md object-cover transition-transform duration-500 ease-(--ease-out-expo) group-hover/badge:-rotate-6 group-hover/badge:scale-105 md:h-8 md:w-8"
                    />
                    <span className="hidden truncate text-base font-bold tracking-[-0.01em] sm:inline">{platform.name}</span>
                  </Link>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex items-center gap-3 md:gap-6">
            <button
              ref={toggleRef}
              type="button"
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              aria-controls="site-menu"
              className="group flex h-10 items-center gap-2 rounded-md px-2 text-base font-semibold"
            >
              <MenuGlyph open={open} />
              <span className="relative inline-grid overflow-hidden">
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.span
                    key={open ? "close" : "menu"}
                    initial={{ y: "100%" }}
                    animate={{ y: "0%" }}
                    exit={{ y: "-100%" }}
                    transition={{ duration: 0.3, ease: EASE }}
                  >
                    {open ? "Close" : "Menu"}
                  </motion.span>
                </AnimatePresence>
              </span>
            </button>
            <div className="hidden sm:block">
              <Link href="/contact" className={buttonClasses(open ? "outline-light" : "outline", "sm")}>
                <span>Contact us</span>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <AnimatePresence>{open && <MenuPanel onNavigate={() => setOpen(false)} />}</AnimatePresence>
    </>
  );
}

const list = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05, delayChildren: 0.18 } },
  exit: { transition: { staggerChildren: 0.02, staggerDirection: -1 } },
};
const item = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.2 } },
};

function MenuPanel({ onNavigate }: { onNavigate: () => void }) {
  const firstLink = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    firstLink.current?.focus({ preventScroll: true });
  }, []);

  return (
    <motion.div
      id="site-menu"
      role="dialog"
      aria-modal="true"
      aria-label="Site menu"
      className="fixed inset-0 z-40 overflow-y-auto bg-forest text-on-forest"
      initial={{ clipPath: "inset(0% 0% 100% 0%)" }}
      animate={{ clipPath: "inset(0% 0% 0% 0%)" }}
      exit={{ clipPath: "inset(0% 0% 100% 0%)", transition: { duration: 0.5, ease: EASE, delay: 0.1 } }}
      transition={{ duration: 0.7, ease: EASE }}
    >
      <motion.div
        className="shell grid gap-12 pb-8 pt-[76px] md:pt-[88px] lg:grid-cols-[minmax(0,840fr)_minmax(0,408fr)] lg:gap-16"
        variants={list}
        initial="hidden"
        animate="show"
        exit="exit"
      >
        {/* Platforms */}
        <div>
          <motion.p variants={item} className="pb-3 text-sm font-medium text-on-forest-muted">
            Platforms
          </motion.p>
          <ul>
            {MENU_PLATFORMS.map((p, i) => (
              <motion.li key={p.key} variants={item} className="border-t border-line-on-forest">
                <div className="group/row flex flex-col gap-3 py-5 md:flex-row md:items-center md:gap-4 md:py-6">
                  <Link
                    ref={i === 0 ? firstLink : undefined}
                    href={p.href}
                    onClick={onNavigate}
                    className="flex items-center gap-4 md:w-[340px] md:shrink-0"
                  >
                    <Slat
                      color={PLATFORM_COLOR[p.key]}
                      height={44}
                      className="mr-2 shrink-0 origin-bottom transition-transform duration-500 ease-(--ease-out-expo) group-hover/row:scale-y-110 group-hover/row:-skew-x-6 md:mr-[30px]"
                    />
                    <span className="flex flex-col transition-transform duration-500 ease-(--ease-out-expo) group-hover/row:translate-x-1.5">
                      <span className="text-xl font-semibold leading-7">{p.name}</span>
                      <span className="text-sm text-on-forest-muted">{p.tagline}</span>
                    </span>
                  </Link>
                  <div className="flex flex-wrap gap-x-6 gap-y-2 pl-[46px] md:pl-0">
                    {p.links.map((l) => (
                      <Link
                        key={l.label}
                        href={l.href}
                        onClick={onNavigate}
                        {...(l.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                        className="link-grow inline-flex items-center gap-1 text-base text-on-forest/90 hover:text-on-forest"
                      >
                        {l.label}
                      </Link>
                    ))}
                  </div>
                </div>
              </motion.li>
            ))}
            <motion.li variants={item} className="border-y border-line-on-forest">
              <a
                href={PLATFORM_URLS.afriConnect}
                target="_blank"
                rel="noopener noreferrer"
                className="group/row flex flex-col gap-3 py-5 md:flex-row md:items-center md:gap-4 md:py-6"
              >
                <span className="flex items-center gap-4 md:w-[340px] md:shrink-0">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-white transition-transform duration-500 ease-(--ease-out-expo) group-hover/row:rotate-[-4deg] group-hover/row:scale-105">
                    <Image src={IMG.afriConnectMark} alt="" width={36} height={34} />
                  </span>
                  <span className="flex flex-col">
                    <span className="flex items-center gap-3">
                      <span className="text-xl font-semibold leading-7">AfriConnect</span>
                      <span className="rounded-sm border border-on-forest-muted px-2 text-sm font-medium">Partner</span>
                    </span>
                    <span className="text-sm text-on-forest-muted">Trade execution intelligence for Africa</span>
                  </span>
                </span>
                <span className="inline-flex items-center gap-1.5 pl-[60px] md:pl-0">
                  <span className="link-grow">Visit AfriConnect</span>
                  <ArrowUpRight className="transition-transform duration-300 group-hover/row:-translate-y-0.5 group-hover/row:translate-x-0.5" />
                </span>
              </a>
            </motion.li>
          </ul>
          <motion.div variants={item} className="flex flex-col gap-3 pt-6 sm:flex-row">
            <a href={PLATFORM_URLS.trade} className={buttonClasses("primary", "lg")} onClick={onNavigate}>
              <span>Apply to TRADE</span>
            </a>
            <a href={PLATFORM_URLS.clear} className={buttonClasses("outline-light", "lg")} onClick={onNavigate}>
              <span>Sign in to CLEAR Export</span>
            </a>
          </motion.div>
        </div>

        {/* Company and latest forum */}
        <div className="flex flex-col gap-7">
          <div>
            <motion.p variants={item} className="pb-3 text-sm font-medium text-on-forest-muted">
              Entrust Africa
            </motion.p>
            <ul>
              {COMPANY_LINKS.map((l) => (
                <motion.li key={l.href} variants={item}>
                  <Link
                    href={l.href}
                    onClick={onNavigate}
                    className="group/cl flex items-center gap-3 text-[28px] font-semibold leading-[44px] tracking-[-0.01em]"
                  >
                    <span className="transition-transform duration-500 ease-(--ease-out-expo) group-hover/cl:translate-x-2">
                      {l.label}
                    </span>
                    <ArrowRight className="-translate-x-2 text-brand-bright opacity-0 transition-all duration-300 group-hover/cl:translate-x-0 group-hover/cl:opacity-100" />
                  </Link>
                </motion.li>
              ))}
            </ul>
          </div>
          <motion.div variants={item}>
            <Link
              href="/events"
              onClick={onNavigate}
              className="group/ev flex items-center gap-4 rounded-lg bg-forest-2 p-3 transition-colors duration-300 hover:bg-[#163223]"
            >
              <span className="zoom-frame relative h-28 w-[136px] shrink-0 !rounded-md">
                <Image src={IMG.forumAudience} alt="" fill sizes="136px" className="object-cover" />
              </span>
              <span className="flex flex-col gap-1">
                <span className="text-sm text-on-forest-muted">Latest forum</span>
                <span className="text-xl font-semibold leading-7">Andinet Remmogo</span>
                <span className="inline-flex items-center gap-1 text-sm font-semibold">
                  See all events
                  <ArrowRight size={16} className="transition-transform duration-300 group-hover/ev:translate-x-1" />
                </span>
              </span>
            </Link>
          </motion.div>
        </div>
      </motion.div>

      <motion.div
        className="shell flex flex-col gap-4 pb-6 pt-2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, transition: { delay: 0.5 } }}
        exit={{ opacity: 0 }}
      >
        <PatchworkBand />
        <div className="flex flex-col justify-between gap-2 text-sm text-on-forest-muted md:flex-row">
          <span>
            {CONTACT.city} · <a href={CONTACT.phoneHref} className="hover:text-on-forest">{CONTACT.phone}</a> ·{" "}
            <a href={`mailto:${CONTACT.email}`} className="hover:text-on-forest">{CONTACT.email}</a>
          </span>
          <span>
            LinkedIn:{" "}
            {LINKEDIN_PROFILES.map((p, i) => (
              <span key={p.href}>
                {i > 0 && " · "}
                <a href={p.href} target="_blank" rel="noopener noreferrer" className="hover:text-on-forest">
                  {p.label}
                </a>
              </span>
            ))}
          </span>
        </div>
      </motion.div>
    </motion.div>
  );
}
