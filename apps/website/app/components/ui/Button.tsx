import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { ArrowRight, ArrowUpRight } from "./icons";

type Variant = "primary" | "outline" | "outline-light";
type Size = "sm" | "md" | "lg";

const base =
  "group/btn relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-md font-semibold " +
  "whitespace-nowrap select-none transition-[color,border-color,box-shadow,transform] duration-300 ease-(--ease-out-quart) " +
  "active:scale-[0.97] focus-visible:outline-offset-2 isolate";

/*
 * Hover: a fill sweeps in from the left behind the label (the ::before layer),
 * the arrow nudges forward and the button lifts a little. Press shrinks it.
 */
const sweep =
  "before:absolute before:inset-0 before:-z-10 before:origin-left before:scale-x-0 before:transition-transform " +
  "before:duration-500 before:ease-(--ease-out-expo) hover:before:scale-x-100";

const variants: Record<Variant, string> = {
  primary:
    `bg-brand text-white ${sweep} before:bg-brand-deep hover:-translate-y-px hover:shadow-[0_8px_24px_-8px_rgb(21_118_66/0.55)]`,
  outline: `border border-brand text-brand ${sweep} before:bg-brand hover:text-white`,
  "outline-light": `border border-on-forest-muted text-on-forest ${sweep} before:bg-on-forest hover:border-on-forest hover:text-forest`,
};

const sizes: Record<Size, string> = {
  sm: "h-10 px-4 text-[15px]",
  md: "h-11 px-5 text-base",
  lg: "h-12 px-6 text-base",
};

type ButtonLinkProps = Omit<ComponentProps<typeof Link>, "className"> & {
  variant?: Variant;
  size?: Size;
  /** Show a trailing arrow. "external" shows the up-right arrow. */
  arrow?: boolean | "external";
  className?: string;
  children: ReactNode;
};

export function buttonClasses(variant: Variant = "primary", size: Size = "md", className = "") {
  return `${base} ${variants[variant]} ${sizes[size]} ${className}`;
}

export function ButtonLink({ variant = "primary", size = "md", arrow = false, className = "", children, ...rest }: ButtonLinkProps) {
  return (
    <Link className={buttonClasses(variant, size, className)} {...rest}>
      <span>{children}</span>
      {arrow === "external" ? (
        <ArrowUpRight className="transition-transform duration-300 group-hover/btn:-translate-y-0.5 group-hover/btn:translate-x-0.5" />
      ) : arrow ? (
        <ArrowRight
          size={18}
          className="-mr-1 transition-transform duration-300 ease-(--ease-out-quart) group-hover/btn:translate-x-1"
        />
      ) : null}
    </Link>
  );
}

type TextLinkProps = Omit<ComponentProps<typeof Link>, "className"> & {
  external?: boolean;
  light?: boolean;
  className?: string;
  children: ReactNode;
};

/** Inline green link with an arrow that nudges and an underline that grows on hover. */
export function TextLink({ external = false, light = false, className = "", children, ...rest }: TextLinkProps) {
  return (
    <Link
      className={`group/tl inline-flex items-center gap-1.5 font-semibold ${light ? "text-on-forest" : "text-brand"} ${className}`}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      {...rest}
    >
      <span className="link-grow">{children}</span>
      {external ? (
        <ArrowUpRight className="transition-transform duration-300 group-hover/tl:-translate-y-0.5 group-hover/tl:translate-x-0.5" />
      ) : (
        <ArrowRight size={18} className="transition-transform duration-300 group-hover/tl:translate-x-1" />
      )}
    </Link>
  );
}
