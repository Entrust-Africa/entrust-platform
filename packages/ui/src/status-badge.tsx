import { cn } from "./cn";

export type StatusTone = "ok" | "info" | "warn" | "danger" | "idle" | "product";

const tones: Record<StatusTone, string> = {
  ok: "bg-ok-50 text-ok ring-ok/25",
  info: "bg-info-50 text-info ring-info/25",
  warn: "bg-warn-50 text-warn ring-warn/30",
  danger: "bg-danger-50 text-danger ring-danger/25",
  idle: "bg-idle-50 text-idle ring-idle/20",
  product: "bg-product-50 text-product-600 ring-product/30",
};

/** A status pill. The label always carries the meaning; colour only supports it. */
export function StatusBadge({
  tone,
  children,
  className,
}: {
  tone: StatusTone;
  children: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-sm px-2 py-0.5 text-xs font-semibold ring-1 ring-inset",
        tones[tone],
        className,
      )}
    >
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}
