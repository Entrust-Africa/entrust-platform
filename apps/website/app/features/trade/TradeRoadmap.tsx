"use client";

import { motion } from "framer-motion";

const EASE = [0.16, 1, 0.3, 1] as const;

const STEPS = [
  {
    name: "Get ready",
    sub: "SME readiness assessment",
    text: "Business diagnostic and gap analysis, compliance review, product-market fit and a capacity building roadmap.",
    color: "#d9a033",
    rise: "lg:mt-24",
  },
  {
    name: "Get connected",
    sub: "Network and partner matching",
    text: "Buyer and distributor matchmaking, trade network introductions and supply chain partner sourcing.",
    color: "#c8553d",
    rise: "lg:mt-16",
  },
  {
    name: "Go regional",
    sub: "Cross-border expansion",
    text: "Market entry strategy, regulatory and customs guidance, logistics planning and regional pricing.",
    color: "#2b9d8f",
    rise: "lg:mt-8",
  },
  {
    name: "Scale up",
    sub: "Export enablement and growth",
    text: "Export documentation, trade finance and funding access, quality certification and ongoing growth advisory.",
    color: "#19954f",
    rise: "",
  },
];

/**
 * The four roadmap steps, laid out as a staircase on desktop. On scroll each
 * step climbs into place after the one before it and its coloured tread
 * draws from the left; hovering a step lifts it and thickens its tread.
 */
export function TradeRoadmap() {
  return (
    <motion.ol
      className="grid gap-8 sm:grid-cols-2 sm:gap-x-4 lg:grid-cols-4"
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.3 }}
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.16 } } }}
    >
      {STEPS.map((s) => (
        <motion.li
          key={s.name}
          className={`group relative flex flex-col gap-3 pt-5 ${s.rise}`}
          variants={{
            hidden: { opacity: 0, y: 40 },
            show: { opacity: 1, y: 0, transition: { duration: 0.8, ease: EASE } },
          }}
        >
          <motion.span
            aria-hidden
            className="absolute inset-x-0 top-0 h-1 origin-left transition-[height] duration-300 group-hover:h-1.5"
            style={{ backgroundColor: s.color }}
            variants={{
              hidden: { scaleX: 0 },
              show: { scaleX: 1, transition: { duration: 0.9, ease: EASE, delay: 0.15 } },
            }}
          />
          <div className="flex flex-col gap-3 transition-transform duration-500 ease-(--ease-out-expo) group-hover:-translate-y-1">
            <h3 className="text-xl font-semibold leading-7 text-ink">{s.name}</h3>
            <p className="text-sm font-medium leading-5 text-brand-deep">{s.sub}</p>
            <p className="text-base leading-6 text-muted">{s.text}</p>
          </div>
        </motion.li>
      ))}
    </motion.ol>
  );
}
