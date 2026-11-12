"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { SplitWords } from "../motion/SplitWords";
import { HeroHorizon } from "./HeroHorizon";

const EASE = [0.16, 1, 0.3, 1] as const;

type Props = {
  eyebrow: string;
  title: string;
  lead: string;
  /** Colour of the short rule above the eyebrow. */
  accent: string;
  /** Front colours of the paper-cut horizon, left to right. */
  horizon: readonly [string, string, string];
  /** Extra content under the lead (e.g. contact details). */
  children?: ReactNode;
  /** The white panel on the right (a form). */
  panel: ReactNode;
  /** Extra bottom room under the copy on desktop, so the horizon clears it. */
  copyPaddingClass?: string;
};

/** Dark hero with a low horizon, used by the Community and Contact pages: copy on the left, a white form panel on the right. */
export function FormHero({ eyebrow, title, lead, accent, horizon, children, panel, copyPaddingClass = "lg:pb-[120px]" }: Props) {
  return (
    <section className="shell">
      <div className="relative isolate grid gap-7 overflow-hidden rounded-lg bg-forest px-3 pb-[88px] pt-8 md:px-12 md:pt-12 lg:grid-cols-[7fr_5fr] lg:gap-16 lg:pb-16 lg:pl-[72px] lg:pr-14">
        <div className={`flex flex-col gap-4 px-3 md:px-0 lg:gap-6 ${copyPaddingClass}`}>
          <motion.span
            aria-hidden
            className="block h-[3px] w-16 origin-left"
            style={{ backgroundColor: accent }}
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
            {eyebrow}
          </motion.p>
          <SplitWords
            as="h1"
            onMount
            delay={0.2}
            text={title}
            className="text-[40px] font-bold leading-[44px] tracking-[-0.03em] text-on-forest lg:text-[56px] lg:leading-[60px]"
          />
          <motion.p
            className="max-w-[560px] text-base leading-[26px] text-on-forest-muted lg:text-xl lg:leading-[30px]"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: EASE, delay: 0.55 }}
          >
            {lead}
          </motion.p>
          {children ? (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: EASE, delay: 0.7 }}
            >
              {children}
            </motion.div>
          ) : null}
        </div>

        <motion.div
          className="relative z-10 self-start"
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: EASE, delay: 0.4 }}
        >
          {panel}
        </motion.div>

        <HeroHorizon colors={horizon} className="absolute bottom-0 left-0 -z-10 h-[50px] w-auto md:h-[70px]" />
      </div>
    </section>
  );
}
