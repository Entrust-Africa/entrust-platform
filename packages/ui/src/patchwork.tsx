import { cn } from "./cn";

// Entrust's identity band: angled blocks in four earth tones, drawn from the
// pan-African collage reference. Decorative only.
const blocks = [
  "bg-patch-green [clip-path:polygon(0_0,100%_0,92%_100%,0_100%)]",
  "bg-patch-ochre [clip-path:polygon(8%_0,100%_0,100%_100%,0_100%)]",
  "bg-patch-terracotta [clip-path:polygon(0_0,92%_0,100%_100%,8%_100%)]",
  "bg-patch-teal [clip-path:polygon(0_0,100%_0,100%_100%,8%_100%)]",
];

export function Patchwork({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("grid h-2 grid-cols-[3fr_1fr_2fr_1fr]", className)}>
      {blocks.map((b) => (
        <span key={b} className={b} />
      ))}
    </div>
  );
}
