import React from "react";
import clsx from "clsx";

export type SectionContainerProps = React.HTMLAttributes<HTMLDivElement> & {
  children: React.ReactNode;
  className?: string;
};

export function SectionContainer({ children, className = "", ...props }: SectionContainerProps) {
  return (
    <section className={clsx("max-w-7xl mx-auto px-4", className)} {...props}>
      {children}
    </section>
  );
}
