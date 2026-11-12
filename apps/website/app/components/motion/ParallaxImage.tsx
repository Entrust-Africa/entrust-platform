"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import Image from "next/image";
import { useRef } from "react";

type Props = {
  src: string;
  alt: string;
  className?: string;
  sizes?: string;
  /** Pixels the photo drifts across the whole scroll. */
  strength?: number;
  preload?: boolean;
};

/**
 * Photo in a rounded frame that wipes open when it enters the viewport and
 * drifts slightly slower than the page while scrolling. Hovering zooms it a touch.
 */
export function ParallaxImage({ src, alt, className = "", sizes = "100vw", strength = 40, preload = false }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [-strength, strength]);

  return (
    <motion.div
      ref={ref}
      className={`zoom-frame relative ${className}`}
      initial={{ clipPath: "inset(14% 0% 0% 0% round 10px)", opacity: 0.3 }}
      whileInView={{ clipPath: "inset(0% 0% 0% 0% round 10px)", opacity: 1 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
    >
      <motion.div className="absolute inset-x-0" style={{ y, top: -strength, bottom: -strength }}>
        <Image src={src} alt={alt} fill sizes={sizes} preload={preload} className="object-cover" />
      </motion.div>
    </motion.div>
  );
}
