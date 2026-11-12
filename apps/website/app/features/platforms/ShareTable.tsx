"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import type { PlatformTheme } from "./theme";

const EASE = [0.16, 1, 0.3, 1] as const;

export type ShareRow = {
  n: number;
  name: string;
  /** Value column on desktop, e.g. "001–018" or "45". */
  value: string;
  /** Segment width in the share bar (steps or points). */
  weight: number;
  detail: string;
  /** Value as written on phones, e.g. "Steps 001–018" or "45 points". */
  mobileValue: string;
};

type Props = {
  rows: ShareRow[];
  theme: PlatformTheme;
  /** Column headings: item ("Phase"), value ("Steps"), detail ("Milestone"). */
  headings: { item: string; value: string; detail: string };
  /** Accessible name for the bar, e.g. "Steps per phase". */
  barLabel: string;
  /**
   * Phone layout. "inline": number beside the name, value and detail in one line
   * below (CLEAR). "header": "Pillar 1 … 45 points" above the name (MIZAN).
   */
  mobile: "inline" | "header";
  /** Colour of the first bar segment; segments then alternate. */
  barStart?: "deep" | "accent";
};

/**
 * A share bar (one segment per row, sized by its weight) above a table of rows.
 * The segments grow in one after another; hovering a row or a segment lights
 * up its partner and dims the rest, so the bar reads as a legend for the table.
 */
export function ShareTable({ rows, theme, headings, barLabel, mobile, barStart = "deep" }: Props) {
  const [active, setActive] = useState<number | null>(null);
  const colors = [theme.deep, theme.accent];
  const first = barStart === "deep" ? 0 : 1;

  return (
    <div className="flex flex-col gap-8" onMouseLeave={() => setActive(null)}>
      <motion.div
        role="img"
        aria-label={`${barLabel}: ${rows.map((r) => `${r.name} ${r.mobileValue}`).join(", ")}`}
        className="flex h-3 w-full gap-0.5"
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.8 }}
        variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08 } } }}
      >
        {rows.map((r, i) => (
          <motion.div
            key={r.n}
            className="h-full origin-left"
            style={{ flexGrow: r.weight, flexBasis: 0 }}
            variants={{
              hidden: { scaleX: 0 },
              show: { scaleX: 1, transition: { duration: 0.7, ease: EASE } },
            }}
            onMouseEnter={() => setActive(i)}
          >
            <motion.div
              className="h-full w-full origin-bottom"
              style={{ backgroundColor: colors[(i + first) % 2] }}
              animate={{
                opacity: active === null || active === i ? 1 : 0.3,
                scaleY: active === i ? 1.5 : 1,
              }}
              transition={{ duration: 0.35, ease: EASE }}
            />
          </motion.div>
        ))}
      </motion.div>

      <div>
        <div
          aria-hidden
          className="hidden grid-cols-[48px_minmax(0,5fr)_110px_minmax(0,4fr)] gap-6 border-b border-line-strong pb-3 text-sm font-medium text-muted md:grid"
        >
          <span>{headings.item}</span>
          <span />
          <span>{headings.value}</span>
          <span>{headings.detail}</span>
        </div>

        <motion.ol
          className={mobile === "header" ? "border-t border-line-strong md:border-t-0" : ""}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.15 }}
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07 } } }}
        >
          {rows.map((r, i) => {
            const on = active === i;
            return (
              <motion.li
                key={r.n}
                onMouseEnter={() => setActive(i)}
                variants={{
                  hidden: { opacity: 0, y: 16 },
                  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } },
                }}
                className="relative border-b border-line transition-colors duration-300"
                style={{ backgroundColor: on ? "rgb(255 255 255 / 0.7)" : undefined }}
              >
                {/* Desktop and tablet row */}
                <div className="hidden grid-cols-[48px_minmax(0,5fr)_110px_minmax(0,4fr)] gap-6 py-4 md:grid">
                  <span
                    className="origin-left text-xl font-semibold leading-7 tabular-nums transition-transform duration-500 ease-(--ease-out-expo)"
                    style={{ color: theme.ink, transform: on ? "scale(1.2)" : undefined }}
                  >
                    {r.n}
                  </span>
                  <span className="text-xl font-semibold leading-7 text-ink">{r.name}</span>
                  <span className="text-base leading-7 text-muted tabular-nums">
                    <span className="sr-only">{headings.value}: </span>
                    {r.value}
                  </span>
                  <span
                    className={`text-base leading-7 transition-colors duration-300 ${on ? "text-ink" : "text-muted"}`}
                  >
                    <span className="sr-only">{headings.detail}: </span>
                    {r.detail}
                  </span>
                </div>

                {/* Phone row */}
                {mobile === "inline" ? (
                  <div className="grid grid-cols-[24px_minmax(0,1fr)] gap-x-3 py-4 md:hidden">
                    <span className="text-base font-semibold leading-6" style={{ color: theme.ink }}>
                      {r.n}
                    </span>
                    <span className="flex flex-col gap-1">
                      <span className="text-base font-semibold leading-6 text-ink">{r.name}</span>
                      <span className="text-sm leading-5 text-muted">
                        {r.mobileValue}. {r.detail}.
                      </span>
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col gap-1 py-4 md:hidden">
                    <span
                      className="flex items-center justify-between text-sm font-semibold leading-5"
                      style={{ color: theme.ink }}
                    >
                      <span>
                        {headings.item} {r.n}
                      </span>
                      <span>{r.mobileValue}</span>
                    </span>
                    <span className="text-xl font-semibold leading-7 text-ink">{r.name}</span>
                    <span className="text-base leading-6 text-muted">{r.detail}</span>
                  </div>
                )}
              </motion.li>
            );
          })}
        </motion.ol>
      </div>
    </div>
  );
}
