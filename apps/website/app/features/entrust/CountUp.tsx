"use client";

import { animate, useInView, useReducedMotion } from "framer-motion";
import { useEffect, useRef } from "react";

const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * A figure such as "120+" that counts up from zero the first time it is seen.
 * The server renders the final value, so it reads correctly without JavaScript
 * or with reduced motion; screen readers only ever get the final value.
 */
export function CountUp({ value, className = "", delay = 0 }: { value: string; className?: string; delay?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.8 });
  const reduce = useReducedMotion();
  const match = /^(\d+)(.*)$/.exec(value);
  const to = match ? Number(match[1]) : 0;
  const suffix = match ? match[2] : "";
  const valid = match !== null;

  useEffect(() => {
    const el = ref.current;
    if (!el || !valid || !inView || reduce) return;
    el.textContent = `0${suffix}`;
    const controls = animate(0, to, {
      duration: 1.4,
      delay,
      ease: EASE,
      onUpdate: (v) => {
        el.textContent = `${Math.round(v)}${suffix}`;
      },
    });
    return () => {
      controls.stop();
      el.textContent = `${to}${suffix}`;
    };
  }, [inView, reduce, valid, to, suffix, delay]);

  return (
    <span className={className}>
      <span ref={ref} aria-hidden className="tabular-nums">
        {value}
      </span>
      <span className="sr-only">{value}</span>
    </span>
  );
}
