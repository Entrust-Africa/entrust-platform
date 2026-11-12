"use client";

import { motion, type HTMLMotionProps } from "framer-motion";
import { fadeUp } from "../../components/motion/Reveal";

/** A <ul>/<ol> whose <StaggerLi> items rise in one after another (Stagger, but with list semantics). */
export function StaggerList({
  ordered = false,
  gap = 0.08,
  ...rest
}: Omit<HTMLMotionProps<"ul">, "variants"> & { ordered?: boolean; gap?: number }) {
  const props = {
    initial: "hidden",
    whileInView: "show",
    viewport: { once: true, amount: 0.2 },
    variants: { hidden: {}, show: { transition: { staggerChildren: gap } } },
    ...rest,
  };
  return ordered ? <motion.ol {...(props as HTMLMotionProps<"ol">)} /> : <motion.ul {...props} />;
}

export function StaggerLi(props: Omit<HTMLMotionProps<"li">, "variants">) {
  return <motion.li variants={fadeUp} {...props} />;
}
