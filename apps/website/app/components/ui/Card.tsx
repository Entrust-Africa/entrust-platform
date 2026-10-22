import React from "react";
import FadeInSection from "../../components/FadeInSection";
import clsx from "clsx";


type AnchorProps = React.AnchorHTMLAttributes<HTMLAnchorElement> & {
  asChild?: boolean;
  href: string;
  children: React.ReactNode;
};

type DivProps = React.HTMLAttributes<HTMLDivElement> & {
  asChild?: boolean;
  children: React.ReactNode;
};

export type CardProps = AnchorProps | DivProps;

const base =
  "card shadow-md hover:shadow-xl transition-all hover:-translate-y-1.5 cursor-pointer flex flex-col items-center text-center group";

export function Card(props: CardProps) {
  const { asChild = false, children, className = "" } = props;
  const classes = clsx(base, className);
  if (asChild && "href" in props && props.href) {
    // Only pass anchor props to <a>
    const { href, ...anchorProps } = props as AnchorProps;
    return (
      <FadeInSection>
        <a href={href} className={classes} {...anchorProps}>
          {children}
        </a>
      </FadeInSection>
    );
  }
  // Only pass div props to <div>
  const divProps = props as DivProps;
  return (
    <FadeInSection>
      <div
        className={classes}
        {...divProps}
      >
        {children}
      </div>
    </FadeInSection>
  );
}
