"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { SplitWords } from "../../components/motion/SplitWords";
import type { PlatformTheme } from "./theme";

const EASE = [0.16, 1, 0.3, 1] as const;

const DARK = "#11271c";

/** Horizon pieces from the platform heroes, in a 690×70 box anchored bottom-left. */
function horizonPieces(theme: PlatformTheme) {
  const [a, b, c] = theme.horizon;
  return [
    { d: "M0 70V26L150 0L300 40L360 70Z", fill: DARK },
    { d: "M250 70L420 10L620 44L690 70Z", fill: DARK },
    { d: "M0 70V44L110 24L230 70Z", fill: a },
    { d: "M110 24L240 14L310 70H230Z", fill: b },
    { d: "M400 70L440 40L560 30L610 70Z", fill: c },
  ];
}

type Props = {
  theme: PlatformTheme;
  eyebrow: string;
  title: string;
  lead: string;
  /** Right-hand panel: the program card or the sign-in card. */
  children: ReactNode;
};

/**
 * Forest hero shared by TRADE, CLEAR Export and MIZAN: accent rule and eyebrow
 * in the platform colour, a headline that rises word by word, a panel on the
 * right, and a paper-cut horizon in the platform's colours rising at the foot.
 */
export function PlatformHero({ theme, eyebrow, title, lead, children }: Props) {
  return (
    <section className="shell">
      <div className="relative isolate grid gap-10 overflow-hidden rounded-lg bg-forest px-6 pb-20 pt-10 md:px-12 md:pb-24 md:pt-12 lg:grid-cols-[7fr_5fr] lg:gap-16 lg:pb-16 lg:pl-[72px] lg:pr-14">
        {/* Soft glow in the platform colour that slowly breathes behind the copy. */}
        <motion.div
          aria-hidden
          className="pointer-events-none absolute -left-40 -top-40 -z-10 h-[520px] w-[520px] rounded-full"
          style={{ background: `radial-gradient(circle, ${theme.accent}26, transparent 65%)` }}
          animate={{ scale: [1, 1.12, 1], opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
        />

        <div className="flex flex-col gap-6 lg:pb-24">
          <motion.span
            aria-hidden
            className="block h-[3px] w-16 origin-left"
            style={{ backgroundColor: theme.accent }}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.9, ease: EASE, delay: 0.1 }}
          />
          <motion.p
            className="text-base font-semibold leading-6"
            style={{ color: theme.accent }}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, ease: EASE, delay: 0.15 }}
          >
            {eyebrow}
          </motion.p>
          <SplitWords
            as="h1"
            onMount
            delay={0.2}
            text={title}
            className="t-display text-on-forest lg:text-[56px] lg:leading-[60px]"
          />
          <motion.p
            className="t-lead max-w-[560px] text-on-forest-muted"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: EASE, delay: 0.6 }}
          >
            {lead}
          </motion.p>
        </div>

        <motion.div
          className="relative z-10 flex flex-col gap-3"
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: EASE, delay: 0.45 }}
        >
          {children}
        </motion.div>

        <svg
          viewBox="0 0 690 70"
          preserveAspectRatio="xMinYMax meet"
          className="pointer-events-none absolute bottom-0 left-0 h-[52px] w-auto md:h-[70px]"
          aria-hidden
        >
          {horizonPieces(theme).map((p, i) => (
            <motion.path
              key={i}
              d={p.d}
              fill={p.fill}
              initial={{ y: 72 }}
              animate={{ y: 0 }}
              transition={{ duration: 1.1, ease: EASE, delay: 0.25 + i * 0.08 }}
            />
          ))}
        </svg>
      </div>
    </section>
  );
}
