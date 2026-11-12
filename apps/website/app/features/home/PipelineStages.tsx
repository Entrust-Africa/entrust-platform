"use client";

import { motion, useScroll, useSpring } from "framer-motion";
import { useRef } from "react";

const EASE = [0.16, 1, 0.3, 1] as const;

const STAGES = [
  { n: 1, name: "Market access", via: "Embassy Business Forums", outcome: "Qualified SMEs and buyers, ready for structured engagement" },
  { n: 2, name: "Preparation", via: "TRADE Program", outcome: "Clear pricing, compliance and positioning for export" },
  { n: 3, name: "Deal structuring", via: "Trade Corridor", outcome: "LOIs, sample orders and defined deal pipelines" },
  { n: 4, name: "Enablement", via: "Credit & Compliance Support", outcome: "Executable, bankable trade opportunities" },
  { n: 5, name: "Execution", via: "Trade Lab", outcome: "Shipments delivered and repeat trade established" },
];

/**
 * The five-stage pipeline table. Rows cascade in, and a green progress rail
 * beside the stage numbers fills as the reader scrolls through the list.
 */
export function PipelineStages() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 75%", "end 55%"] });
  const fill = useSpring(scrollYProgress, { stiffness: 120, damping: 30 });

  return (
    <div ref={ref} className="relative">
      <div className="hidden grid-cols-[48px_minmax(0,1fr)_minmax(0,1fr)] gap-6 border-b border-line-strong pb-3 text-sm font-medium text-muted md:grid">
        <span>Stage</span>
        <span />
        <span>You come away with</span>
      </div>

      {/* Progress rail */}
      <div aria-hidden className="absolute bottom-0 left-[-16px] top-0 hidden w-0.5 bg-line md:block">
        <motion.div className="h-full w-full origin-top bg-brand-bright" style={{ scaleY: fill }} />
      </div>

      <motion.ol
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.2 }}
        variants={{ hidden: {}, show: { transition: { staggerChildren: 0.09 } } }}
      >
        {STAGES.map((s) => (
          <motion.li
            key={s.n}
            variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE } } }}
            className="group/stage grid grid-cols-[32px_minmax(0,1fr)] gap-x-4 gap-y-1 border-b border-line py-5 md:grid-cols-[48px_minmax(0,1fr)_minmax(0,1fr)] md:gap-6"
          >
            <span className="text-xl font-semibold leading-7 text-brand tabular-nums transition-transform duration-500 ease-(--ease-out-expo) group-hover/stage:-translate-y-0.5 group-hover/stage:scale-125 origin-left">
              {s.n}
            </span>
            <span className="flex flex-col">
              <span className="text-xl font-semibold leading-7 text-ink">{s.name}</span>
              <span className="text-sm text-muted">{s.via}</span>
            </span>
            <span className="col-start-2 text-base leading-6 text-muted transition-colors duration-300 group-hover/stage:text-ink md:col-start-3">
              {s.outcome}
            </span>
          </motion.li>
        ))}
      </motion.ol>
    </div>
  );
}
