"use client";

import { motion } from "framer-motion";
import { ANDINET_COLOR, ANDINET_STAGES } from "./data";

const EASE = [0.16, 1, 0.3, 1] as const;
const STAGE_GAP = 0.18;

/**
 * Andinet's five stages. On desktop a rail draws across the row and each
 * stage's marker pops in as the line reaches it; on phones each stage gets
 * an indigo rule down its left edge. Hovering a stage grows its marker.
 */
export function AndinetPipeline() {
  return (
    <motion.div
      className="relative"
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.25 }}
    >
      {/* Rail (desktop) */}
      <motion.div
        aria-hidden
        className="absolute left-0 right-0 top-[9px] hidden h-0.5 origin-left bg-line-strong lg:block"
        variants={{
          hidden: { scaleX: 0 },
          show: { scaleX: 1, transition: { duration: STAGE_GAP * 5 + 0.4, ease: EASE } },
        }}
      />
      <motion.ol
        className="grid gap-3.5 lg:grid-cols-5 lg:gap-6"
        variants={{ hidden: {}, show: { transition: { staggerChildren: STAGE_GAP } } }}
      >
        {ANDINET_STAGES.map((s) => (
          <motion.li
            key={s.name}
            className="group/stage flex flex-col border-l-2 py-3.5 pl-4 lg:border-l-0 lg:py-0 lg:pl-0"
            style={{ borderColor: ANDINET_COLOR }}
            variants={{ hidden: {}, show: {} }}
          >
            <span
              aria-hidden
              className="relative mb-6 ml-px hidden size-[18px] transition-transform duration-500 ease-(--ease-out-expo) group-hover/stage:scale-125 lg:block"
            >
              <motion.span
                className="block size-full rounded-full ring-4 ring-page"
                style={{ backgroundColor: ANDINET_COLOR }}
                variants={{
                  hidden: { scale: 0 },
                  show: { scale: 1, transition: { duration: 0.5, ease: EASE } },
                }}
              />
            </span>
            <motion.div
              className="flex flex-col gap-1.5 lg:gap-2"
              variants={{
                hidden: { opacity: 0, y: 16 },
                show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE } },
              }}
            >
              <h4 className="text-xl font-semibold leading-7 text-ink">{s.name}</h4>
              <p className="text-base leading-6 text-muted">{s.text}</p>
              <p className="text-sm font-medium leading-5" style={{ color: ANDINET_COLOR }}>
                {s.outcome}
              </p>
            </motion.div>
          </motion.li>
        ))}
      </motion.ol>
    </motion.div>
  );
}
