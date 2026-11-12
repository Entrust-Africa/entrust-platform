"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { PaperCutHorizon } from "../../components/site/Decor";
import { SplitWords } from "../../components/motion/SplitWords";
import { buttonClasses } from "../../components/ui/Button";
import { ArrowRight, Slat } from "../../components/ui/icons";
import { PLATFORM_COLOR } from "../../lib/site";

const EASE = [0.16, 1, 0.3, 1] as const;

const ROUTES = [
  { title: "Get ready to export", sub: "TRADE: assessment, training and a learning plan", href: "/trade", color: PLATFORM_COLOR.trade },
  { title: "Run an export case", sub: "CLEAR Export: permits, documents and deadlines", href: "/clear-export", color: PLATFORM_COLOR.clear },
  { title: "Meet buyers and partners", sub: "Entrust: trade forums and deal pipelines", href: "/events", color: PLATFORM_COLOR.entrust },
  { title: "Plan a market entry", sub: "Entrust: strategy, structuring and advisory", href: "/entrust#services", color: PLATFORM_COLOR.entrust },
];

export function HomeHero() {
  return (
    <section className="shell">
      <div className="relative isolate grid gap-10 overflow-hidden rounded-lg bg-forest px-6 pb-24 pt-10 md:px-12 md:pb-16 md:pt-12 lg:grid-cols-[7fr_5fr] lg:gap-16 lg:pl-[72px] lg:pr-14">
        {/* Soft glow that slowly breathes behind the copy. */}
        <motion.div
          aria-hidden
          className="pointer-events-none absolute -left-40 -top-40 -z-10 h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle,rgb(25_149_79/0.22),transparent_65%)]"
          animate={{ scale: [1, 1.12, 1], opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
        />

        <div className="flex flex-col gap-6 lg:pb-[120px]">
          <motion.span
            aria-hidden
            className="block h-[3px] w-16 origin-left bg-brand-bright"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.9, ease: EASE, delay: 0.1 }}
          />
          <SplitWords
            as="h1"
            onMount
            delay={0.15}
            text="Take your business across African borders."
            className="t-display text-on-forest"
          />
          <motion.p
            className="t-lead max-w-[540px] text-on-forest-muted"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: EASE, delay: 0.6 }}
          >
            Entrust Africa helps SMEs prepare for export, stay compliant, find buyers and close cross-border deals.
          </motion.p>
        </div>

        <motion.div
          className="relative z-10 flex flex-col gap-3"
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: EASE, delay: 0.45 }}
        >
          <nav aria-label="Where do you want to start?" className="rounded-lg bg-surface px-6 pb-2 pt-6 shadow-[0_24px_48px_-24px_rgb(0_0_0/0.5)]">
            <p className="mb-3 text-xl font-semibold leading-7 text-ink">Where do you want to start?</p>
            <motion.ul
              initial="hidden"
              animate="show"
              variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07, delayChildren: 0.7 } } }}
            >
              {ROUTES.map((r) => (
                <motion.li
                  key={r.title}
                  variants={{ hidden: { opacity: 0, x: 12 }, show: { opacity: 1, x: 0, transition: { duration: 0.6, ease: EASE } } }}
                  className="border-t border-line"
                >
                  <Link
                    href={r.href}
                    className="group/route relative -mx-3 flex items-center gap-3 rounded-md px-3 py-3 transition-colors duration-300 hover:bg-page"
                  >
                    <Slat
                      color={r.color}
                      className="shrink-0 transition-transform duration-500 ease-(--ease-out-expo) group-hover/route:scale-y-[1.18] group-hover/route:-skew-x-6"
                    />
                    <span className="flex flex-1 flex-col transition-transform duration-500 ease-(--ease-out-expo) group-hover/route:translate-x-1">
                      <span className="text-base font-semibold leading-[22px] text-ink">{r.title}</span>
                      <span className="text-sm text-muted">{r.sub}</span>
                    </span>
                    <ArrowRight className="shrink-0 text-brand transition-transform duration-300 ease-(--ease-out-quart) group-hover/route:translate-x-1" />
                  </Link>
                </motion.li>
              ))}
            </motion.ul>
          </nav>
          <Link href="/partners" className={buttonClasses("primary", "lg", "w-full")}>
            <span>Partner as an institution</span>
          </Link>
        </motion.div>

        <PaperCutHorizon className="absolute bottom-0 left-0 -z-0 h-[92px] w-auto md:h-[140px] lg:h-[190px]" />
      </div>
    </section>
  );
}
