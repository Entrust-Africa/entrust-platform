"use client";

import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { useEffect, type ReactNode } from "react";
import { SplitWords } from "../motion/SplitWords";

const EASE = [0.16, 1, 0.3, 1] as const;
const HILL = "#11271c";

/**
 * Hero used by the inner pages (About, Events, Partners): forest panel with an
 * accent rule, eyebrow, headline and lead on the left, a white panel on the
 * right, and a small paper-cut horizon in the page's own colours.
 */
export function InnerHero({
  eyebrow,
  title,
  lead,
  accent,
  horizon,
  children,
}: {
  eyebrow: string;
  title: string;
  lead: string;
  /** Colour of the short rule above the eyebrow. */
  accent: string;
  /** Colours of the front pieces of the horizon, left to right (up to 4). */
  horizon: string[];
  /** The right-hand panel. */
  children: ReactNode;
}) {
  return (
    <section className="shell">
      <div className="relative isolate grid gap-7 overflow-hidden rounded-lg bg-forest px-3 pb-[88px] pt-8 md:px-12 md:pb-28 md:pt-12 lg:grid-cols-[7fr_5fr] lg:gap-16 lg:pb-16 lg:pl-[72px] lg:pr-14">
        <div className="flex flex-col gap-4 px-3 md:px-0 lg:gap-6 lg:pb-[120px]">
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
            transition={{ duration: 0.8, ease: EASE, delay: 0.6 }}
          >
            {lead}
          </motion.p>
        </div>

        <motion.div
          className="relative z-10 self-start"
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: EASE, delay: 0.45 }}
        >
          {children}
        </motion.div>

        <Horizon colors={horizon} />
      </div>
    </section>
  );
}

type Piece = { d: string; fill: string; depth: number };

function pieces(colors: string[]): Piece[] {
  // Shapes from the Sketch inner-page heroes, in a 690×130 box anchored bottom-left.
  const front = [
    { d: "M0 130V104L110 84L230 130Z", depth: 0.6 },
    { d: "M110 84L240 74L310 130H230Z", depth: 0.8 },
    { d: "M400 130L440 100L560 90L610 130Z", depth: 0.7 },
    { d: "M560 90L650 104L690 130H610Z", depth: 1 },
  ];
  return [
    { d: "M0 130V86L150 60L300 100L360 130Z", fill: HILL, depth: 0.2 },
    { d: "M250 130L420 70L620 104L690 130Z", fill: HILL, depth: 0.25 },
    ...front.slice(0, colors.length).map((p, i) => ({ ...p, fill: colors[i] })),
  ];
}

function HorizonPiece({ piece, i, px }: { piece: Piece; i: number; px: MotionValue<number> }) {
  const x = useTransform(px, (v) => v * piece.depth * 12);
  return (
    <motion.path
      d={piece.d}
      fill={piece.fill}
      style={{ x }}
      initial={{ y: 90 }}
      animate={{ y: 0 }}
      transition={{ duration: 1.1, ease: EASE, delay: 0.25 + i * 0.07 }}
    />
  );
}

/** The pieces rise into place on load, then drift a few pixels with the pointer. */
function Horizon({ colors }: { colors: string[] }) {
  const reduce = useReducedMotion();
  const raw = useMotionValue(0);
  const px = useSpring(raw, { stiffness: 60, damping: 20, mass: 0.6 });

  useEffect(() => {
    if (reduce) return;
    const onMove = (e: PointerEvent) => raw.set((e.clientX / window.innerWidth) * 2 - 1);
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [raw, reduce]);

  return (
    <svg
      viewBox="0 0 690 130"
      preserveAspectRatio="xMinYMax meet"
      className="pointer-events-none absolute bottom-0 left-0 -z-0 h-[72px] w-auto md:h-[100px] lg:h-[130px]"
      aria-hidden
      overflow="visible"
    >
      {pieces(colors).map((p, i) => (
        <HorizonPiece key={i} piece={p} i={i} px={px} />
      ))}
    </svg>
  );
}
