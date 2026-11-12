"use client";

import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { useEffect } from "react";

const EASE = [0.16, 1, 0.3, 1] as const;

/* ---------------------------------------------------------------- Patchwork band */

const BAND = [
  { d: "M0 0H562L517 8H0Z", fill: "#19954f" },
  { d: "M562 0H750V8H517Z", fill: "#d9a033" },
  { d: "M750 0H1095L1125 8H750Z", fill: "#c8553d" },
  { d: "M1095 0H1312V8H1125Z", fill: "#2b9d8f" },
];

/** The four-colour strip from the footer and menu. Its pieces slide in, one after another. */
export function PatchworkBand({ className = "" }: { className?: string }) {
  return (
    <motion.svg
      viewBox="0 0 1312 8"
      preserveAspectRatio="none"
      className={`block h-2 w-full ${className}`}
      aria-hidden
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.5 }}
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.12 } } }}
    >
      {BAND.map((p) => (
        <motion.path
          key={p.fill}
          d={p.d}
          fill={p.fill}
          variants={{
            hidden: { opacity: 0, x: -24 },
            show: { opacity: 1, x: 0, transition: { duration: 0.7, ease: EASE } },
          }}
        />
      ))}
    </motion.svg>
  );
}

/* ---------------------------------------------------------- Paper-cut horizon */

type Piece = { d: string; fill?: string; stroke?: string; depth: number };

// Shapes from the Home hero, in a 760×190 box anchored bottom-left.
const HORIZON: Piece[] = [
  { d: "M0 190V120L180 84L372 138L430 190Z", fill: "#11271c", depth: 0.2 },
  { d: "M300 190L470 104L700 150L760 190Z", fill: "#11271c", depth: 0.25 },
  { d: "M0 190V150L120 122L268 190Z", fill: "#19954f", depth: 0.6 },
  { d: "M120 122L262 108L340 190H268Z", fill: "#157642", depth: 0.7 },
  { d: "M262 108L372 138L452 190H340Z", fill: "#d9a033", depth: 0.9 },
  { d: "M430 190L470 146L590 128L640 190Z", fill: "#c8553d", depth: 0.8 },
  { d: "M590 128L700 150L760 190H640Z", fill: "#2b9d8f", depth: 1 },
  { d: "M290 115.6L360.8 190M318 123.3L381.4 190M346 130.9L402.2 190", stroke: "#c8553d", depth: 0.9 },
  { d: "M498 141.8L541.8 190M526 137.6L573.6 190", stroke: "#d9a033", depth: 0.8 },
];

function HorizonPiece({ piece, i, px }: { piece: Piece; i: number; px: MotionValue<number> }) {
  const x = useTransform(px, (v) => v * piece.depth * 14);
  if (piece.stroke) {
    return (
      <motion.path
        d={piece.d}
        fill="none"
        stroke={piece.stroke}
        strokeWidth={2}
        style={{ x }}
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 0.9, ease: EASE, delay: 0.9 + i * 0.05 }}
      />
    );
  }
  return (
    <motion.path
      d={piece.d}
      fill={piece.fill}
      style={{ x }}
      initial={{ y: 120 }}
      animate={{ y: 0 }}
      transition={{ duration: 1.1, ease: EASE, delay: 0.25 + i * 0.07 }}
    />
  );
}

/**
 * The layered "paper-cut" landscape at the foot of the hero. The pieces rise
 * into place on load, then drift a few pixels with the pointer, nearer
 * (brighter) pieces moving further than the dark hills behind them.
 */
export function PaperCutHorizon({ className = "" }: { className?: string }) {
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
      viewBox="0 0 760 190"
      preserveAspectRatio="xMinYMax meet"
      className={`pointer-events-none ${className}`}
      aria-hidden
      overflow="visible"
    >
      {HORIZON.map((p, i) => (
        <HorizonPiece key={i} piece={p} i={i} px={px} />
      ))}
    </svg>
  );
}
