import type { ButtonHTMLAttributes } from "react";
import { cn } from "./cn";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "on-night";
type Size = "sm" | "md" | "lg";

// Enabled look, then the disabled look. Loading keeps the enabled colours.
const variants: Record<Variant, [string, string]> = {
  primary: ["bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-900", "bg-line-strong text-ink-3"],
  secondary: [
    "bg-surface text-ink border border-line-strong hover:bg-surface-2 active:bg-line",
    "bg-surface text-ink-3 border border-line",
  ],
  ghost: ["text-ink-2 hover:bg-surface-2 hover:text-ink active:bg-line", "text-ink-3"],
  danger: ["bg-danger text-white hover:bg-danger-700 active:bg-danger-900", "bg-line-strong text-ink-3"],
  "on-night": ["bg-on-night text-night hover:bg-white active:bg-on-night-muted", "bg-night-2 text-on-night-muted"],
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-base",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** Shows a spinner, keeps the width, and blocks repeat clicks. */
  loading?: boolean;
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  className,
  children,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-semibold",
        "transition-[background-color,color,transform] duration-150 ease-out",
        disabled ? cn("cursor-not-allowed", variants[variant][1]) : variants[variant][0],
        loading ? "cursor-wait" : !disabled && "active:translate-y-px",
        sizes[size],
        className,
      )}
      {...props}
    >
      {loading && (
        <span
          aria-hidden
          className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent"
        />
      )}
      {children}
    </button>
  );
}
