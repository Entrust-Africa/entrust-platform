import React from "react";
import clsx from "clsx";

type AnchorProps = React.AnchorHTMLAttributes<HTMLAnchorElement> & {
  variant?: "primary" | "secondary" | "outline";
  asChild?: boolean;
  href: string;
  children: React.ReactNode;
};

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "outline";
  asChild?: boolean;
  children: React.ReactNode;
};

export type ButtonProps = AnchorProps | BtnProps;

const base =
  "btn transition-transform duration-200 focus:outline-none focus:ring-4 focus:ring-green-200";

const variants = {
  primary:
    "btn-primary bg-[var(--color-primary)] text-white hover:bg-green-700 active:scale-98",
  secondary:
    "btn-secondary border-2 border-[var(--color-primary)] text-[var(--color-primary)] bg-white hover:bg-green-600 hover:text-white",
  outline:
    "btn-outline border-2 border-[var(--color-primary)] text-[var(--color-primary)] bg-white hover:bg-green-100",
};

export function Button(props: ButtonProps) {
  const { variant = "primary", asChild = false, children, className = "" } = props;
  const classes = clsx(base, variants[variant], className);

  if (asChild && React.isValidElement(children)) {
    const child = children as React.ReactElement<{ className?: string }>;
    return React.cloneElement(child, {
      className: clsx(classes, child.props.className),
    });
  }

  if ("href" in props && props.href) {
    const { href, ...anchorProps } = props as AnchorProps;
    return (
      <a href={href} className={classes} {...anchorProps}>
        {children}
      </a>
    );
  }

  const btnProps = props as BtnProps;
  return (
    <button type="button" className={classes} {...btnProps}>
      {children}
    </button>
  );
}
