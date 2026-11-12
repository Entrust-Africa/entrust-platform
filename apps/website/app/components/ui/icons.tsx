/* Line icons drawn to match the Sketch file: 2px strokes, round caps. */

type IconProps = { className?: string; size?: number };

export function ArrowRight({ className = "", size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden className={className}>
      <path d="M5 10h10M11 5l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ArrowUpRight({ className = "", size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" aria-hidden className={className}>
      <path d="M7 6h5v5M6 12l6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Slanted parallelogram used as the platform colour marker (TRADE ochre, CLEAR teal, Entrust green). */
export function Slat({ color, className = "", height = 28 }: { color: string; className?: string; height?: number }) {
  const w = height / 2;
  return (
    <svg width={w} height={height} viewBox={`0 0 ${w} ${height}`} aria-hidden className={className}>
      <path d={`M${w * 0.21} 0H${w}L${w * 0.79} ${height}H0Z`} fill={color} />
    </svg>
  );
}
