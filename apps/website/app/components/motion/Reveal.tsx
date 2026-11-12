"use client";

import { motion, type HTMLMotionProps, type Variants } from "framer-motion";
import type { ReactNode } from "react";

/**
 * Scroll-triggered entrance animations. Everything here respects the
 * user's reduced-motion setting through <MotionConfig reducedMotion="user">
 * in the root layout, which turns transforms off and keeps the fades.
 */

const EASE = [0.16, 1, 0.3, 1] as const;

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.8, ease: EASE } },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.8, ease: EASE } },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  show: { opacity: 1, scale: 1, transition: { duration: 0.9, ease: EASE } },
};

/** Clip-path wipe from the bottom, used on photographs. */
export const wipeUp: Variants = {
  hidden: { clipPath: "inset(18% 0% 0% 0% round 10px)", opacity: 0.4 },
  show: {
    clipPath: "inset(0% 0% 0% 0% round 10px)",
    opacity: 1,
    transition: { duration: 1.1, ease: EASE },
  },
};

const VARIANTS = { fadeUp, fadeIn, scaleIn, wipeUp };

type RevealProps = Omit<HTMLMotionProps<"div">, "variants"> & {
  children: ReactNode;
  variant?: keyof typeof VARIANTS;
  delay?: number;
  /** Fraction of the element that must be visible before it animates. */
  amount?: number;
};

/** Animates its children in once, when they scroll into view. */
export function Reveal({
  children,
  variant = "fadeUp",
  delay = 0,
  amount = 0.25,
  ...rest
}: RevealProps) {
  const base = VARIANTS[variant];
  const show = base.show as { transition?: object };
  const variants: Variants = delay
    ? { hidden: base.hidden, show: { ...show, transition: { ...show.transition, delay } } as Variants[string] }
    : base;
  return (
    <motion.div
      variants={variants}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

type StaggerProps = Omit<HTMLMotionProps<"div">, "variants"> & {
  children: ReactNode;
  /** Seconds between each child. */
  gap?: number;
  delay?: number;
  amount?: number;
};

/** Parent that reveals each <StaggerItem> in turn. */
export function Stagger({ children, gap = 0.08, delay = 0, amount = 0.2, ...rest }: StaggerProps) {
  return (
    <motion.div
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount }}
      variants={{ hidden: {}, show: { transition: { staggerChildren: gap, delayChildren: delay } } }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

type StaggerItemProps = Omit<HTMLMotionProps<"div">, "variants"> & {
  children?: ReactNode;
  variant?: keyof typeof VARIANTS;
};

export function StaggerItem({ children, variant = "fadeUp", ...rest }: StaggerItemProps) {
  return (
    <motion.div variants={VARIANTS[variant]} {...rest}>
      {children}
    </motion.div>
  );
}

/** A short accent rule that draws itself from the left. */
export function AccentRule({ className = "", light = false }: { className?: string; light?: boolean }) {
  return (
    <motion.span
      aria-hidden
      className={`block h-[3px] w-16 origin-left ${light ? "bg-brand-bright" : "bg-brand-bright"} ${className}`}
      initial={{ scaleX: 0 }}
      whileInView={{ scaleX: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.9, ease: EASE, delay: 0.1 }}
    />
  );
}
