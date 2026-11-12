"use client";

import { motion } from "framer-motion";
import { SplitWords } from "../../components/motion/SplitWords";
import { ButtonLink } from "../../components/ui/Button";
import { CountUp } from "./CountUp";
import { TRACK_RECORD } from "./data";

const EASE = [0.16, 1, 0.3, 1] as const;

// The Entrust hero's green "paper-cut" hills, in a 690×70 box anchored bottom-left.
const HILLS = [
  { d: "M0 70V26L150 0L300 40L360 70Z", fill: "#11271c" },
  { d: "M250 70L420 10L620 44L690 70Z", fill: "#11271c" },
  { d: "M0 70V44L110 24L230 70Z", fill: "#19954f" },
  { d: "M110 24L240 14L310 70H230Z", fill: "#157642" },
  { d: "M400 70L440 40L560 30L610 70Z", fill: "#19954f" },
];

export function EntrustHero() {
  return (
    <section className="shell">
      <div className="relative isolate grid gap-7 overflow-hidden rounded-lg bg-forest px-3 pb-[88px] pt-8 md:px-12 md:pb-16 md:pt-12 lg:grid-cols-[7fr_5fr] lg:gap-16 lg:pl-[72px] lg:pr-14">
        {/* Soft glow that slowly breathes behind the copy. */}
        <motion.div
          aria-hidden
          className="pointer-events-none absolute -left-40 -top-40 -z-10 h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle,rgb(25_149_79/0.2),transparent_65%)]"
          animate={{ scale: [1, 1.12, 1], opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
        />

        <div className="flex flex-col gap-4 px-3 md:px-0 lg:gap-6 lg:pb-[120px]">
          <motion.span
            aria-hidden
            className="block h-[3px] w-16 origin-left bg-brand-bright"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.9, ease: EASE, delay: 0.1 }}
          />
          <motion.p
            className="text-base font-semibold leading-6 text-on-forest-muted"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, ease: EASE, delay: 0.15 }}
          >
            Entrust
          </motion.p>
          <SplitWords
            as="h1"
            onMount
            delay={0.2}
            text="Building structured businesses across Africa."
            className="text-[40px] font-bold leading-[44px] tracking-[-0.03em] text-on-forest lg:text-[56px] lg:leading-[60px]"
          />
          <motion.p
            className="max-w-[560px] text-base leading-[26px] text-on-forest-muted lg:text-xl lg:leading-[30px]"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: EASE, delay: 0.6 }}
          >
            A strategy and execution firm working with SMEs, financial institutions and investors across African
            markets.
          </motion.p>
        </div>

        <motion.div
          className="relative z-10 flex flex-col gap-3"
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: EASE, delay: 0.45 }}
        >
          <div className="rounded-lg bg-surface px-4 py-5 shadow-[0_24px_48px_-24px_rgb(0_0_0/0.5)] lg:p-6">
            <h2 className="mb-3 text-xl font-semibold leading-7 text-ink">Our track record</h2>
            <dl className="grid grid-cols-2 gap-3 lg:gap-4">
              {TRACK_RECORD.map((s, i) => (
                <div key={s.value} className="flex flex-col border-t border-line py-3 lg:py-4">
                  <dt className="order-2 text-sm leading-5 text-muted">
                    {s.short ? (
                      <>
                        <span className="lg:hidden">{s.short}</span>
                        <span className="hidden lg:inline">{s.label}</span>
                      </>
                    ) : (
                      s.label
                    )}
                  </dt>
                  <dd className="order-1 text-[28px] font-bold leading-[34px] tracking-[-0.02em] text-brand lg:text-[40px] lg:leading-[46px]">
                    <CountUp value={s.value} delay={0.7 + i * 0.1} />
                  </dd>
                </div>
              ))}
            </dl>
          </div>
          <ButtonLink href="/contact" size="lg" className="w-full">
            Talk to an advisor
          </ButtonLink>
        </motion.div>

        <svg
          viewBox="0 0 690 70"
          preserveAspectRatio="xMinYMax meet"
          className="pointer-events-none absolute bottom-0 left-0 h-[44px] w-auto md:h-[56px] lg:h-[70px]"
          aria-hidden
        >
          {HILLS.map((h, i) => (
            <motion.path
              key={i}
              d={h.d}
              fill={h.fill}
              initial={{ y: 70 }}
              animate={{ y: 0 }}
              transition={{ duration: 1.1, ease: EASE, delay: 0.25 + i * 0.08 }}
            />
          ))}
        </svg>
      </div>
    </section>
  );
}
