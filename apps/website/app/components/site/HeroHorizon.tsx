"use client";

import { motion } from "framer-motion";

const EASE = [0.16, 1, 0.3, 1] as const;
const HILL = "#11271c";

/**
 * The low paper-cut landscape at the foot of an inner-page hero (Community, Contact).
 * Two dark hills sit behind three coloured pieces; each piece rises into place on load.
 * Shapes from the Sketch artboards, in a 690×70 box anchored bottom-left.
 */
export function HeroHorizon({
  colors,
  className = "",
}: {
  /** Front pieces, left to right. */
  colors: readonly [string, string, string];
  className?: string;
}) {
  const pieces = [
    { d: "M0 70V26L150 0L300 40L360 70Z", fill: HILL },
    { d: "M250 70L420 10L620 44L690 70Z", fill: HILL },
    { d: "M0 70V44L110 24L230 70Z", fill: colors[0] },
    { d: "M110 24L240 14L310 70H230Z", fill: colors[1] },
    { d: "M400 70L440 40L560 30L610 70Z", fill: colors[2] },
  ];

  return (
    <svg
      viewBox="0 0 690 70"
      preserveAspectRatio="xMinYMax meet"
      className={`pointer-events-none ${className}`}
      aria-hidden
    >
      {pieces.map((p, i) => (
        <motion.path
          key={i}
          d={p.d}
          fill={p.fill}
          initial={{ y: 70 }}
          animate={{ y: 0 }}
          transition={{ duration: 1.1, ease: EASE, delay: 0.25 + i * 0.08 }}
        />
      ))}
    </svg>
  );
}
