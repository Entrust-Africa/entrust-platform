"use client";

import { animate, useInView, useReducedMotion } from "framer-motion";
import { useEffect, useRef } from "react";

/**
 * A number that counts up from zero the first time it scrolls into view.
 * Server-rendered with its final value, so it reads correctly without JS
 * and with reduced motion.
 */
export function CountUp({ to, suffix = "", duration = 1.1 }: { to: number; suffix?: string; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.8 });
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!inView || reduce || !ref.current) return;
    const el = ref.current;
    const controls = animate(0, to, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => {
        el.textContent = `${Math.round(v)}${suffix}`;
      },
    });
    return () => controls.stop();
  }, [inView, reduce, to, suffix, duration]);

  return (
    <span ref={ref} className="tabular-nums">
      {`${to}${suffix}`}
    </span>
  );
}
