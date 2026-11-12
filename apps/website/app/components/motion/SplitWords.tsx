"use client";

import { motion } from "framer-motion";
import type { ElementType } from "react";

const EASE = [0.16, 1, 0.3, 1] as const;

type Props = {
  text: string;
  as?: ElementType;
  className?: string;
  delay?: number;
  /** Animate on mount (hero) instead of when scrolled into view. */
  onMount?: boolean;
};

/**
 * Headline whose words rise out of a mask one after another.
 * Screen readers get the plain sentence through aria-label.
 */
export function SplitWords({ text, as: Tag = "h2", className = "", delay = 0, onMount = false }: Props) {
  const words = text.split(" ");
  const trigger = onMount
    ? { initial: "hidden", animate: "show" }
    : { initial: "hidden", whileInView: "show", viewport: { once: true, amount: 0.6 } };

  return (
    <Tag className={className} aria-label={text}>
      <motion.span
        aria-hidden
        className="inline"
        variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06, delayChildren: delay } } }}
        {...trigger}
      >
        {words.map((w, i) => (
          <span key={i}>
            <span className="inline-block overflow-hidden pb-[0.08em] align-bottom -mb-[0.08em]">
              <motion.span
                className="inline-block"
                variants={{
                  hidden: { y: "105%" },
                  show: { y: "0%", transition: { duration: 0.9, ease: EASE } },
                }}
              >
                {w}
              </motion.span>
            </span>
            {i < words.length - 1 ? " " : null}
          </span>
        ))}
      </motion.span>
    </Tag>
  );
}
