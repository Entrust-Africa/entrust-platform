import type { ReactNode } from "react";
import { CONTACT } from "../../lib/site";
import { FOUNDER, LINKEDIN_PROFILES } from "../../lib/site";

type Tone = "dark" | "light";

function DetailLink({ href, external, children }: { href: string; external?: boolean; children: ReactNode }) {
  return (
    <a
      href={href}
      className="link-grow inline-flex min-h-6 items-center"
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      {children}
    </a>
  );
}

/**
 * Email, phone, location and LinkedIn. On the dark hero (desktop) it is a 2×2 grid;
 * on light paper below the hero (mobile) it is a ruled list.
 */
export function ContactDetails({ tone }: { tone: Tone }) {
  const dark = tone === "dark";
  const items: { label: string; value: ReactNode }[] = [
    {
      label: "Email",
      value: (
        <>
          <DetailLink href={`mailto:${CONTACT.email}`}>{CONTACT.email}</DetailLink>
          <DetailLink href={`mailto:${FOUNDER.email}`}>{FOUNDER.email}</DetailLink>
        </>
      ),
    },
    { label: "Phone", value: <DetailLink href={CONTACT.phoneHref}>{CONTACT.phone}</DetailLink> },
    { label: "Location", value: <span>{CONTACT.city}</span> },
    {
      label: "LinkedIn",
      value: (
        <span className="flex flex-wrap items-center gap-x-2.5">
          {LINKEDIN_PROFILES.map((p, i) => (
            <span key={p.href} className="inline-flex items-center gap-x-2.5">
              {i > 0 ? <span aria-hidden>·</span> : null}
              <DetailLink href={p.href} external>
                {p.label}
                <span className="sr-only"> on LinkedIn (opens in a new tab)</span>
              </DetailLink>
            </span>
          ))}
        </span>
      ),
    },
  ];

  return (
    <dl className={dark ? "mt-2 grid grid-cols-2 gap-x-8 gap-y-5" : "flex flex-col"}>
      {items.map((it, i) => (
        <div
          key={it.label}
          className={
            dark
              ? "flex flex-col gap-0.5"
              : `flex flex-col gap-0.5 border-t py-3.5 ${i === 0 ? "border-line-strong" : "border-line"} ${i === items.length - 1 ? "border-b border-b-line" : ""}`
          }
        >
          <dt className={`text-sm leading-5 ${dark ? "text-on-forest-muted" : "text-muted"}`}>{it.label}</dt>
          <dd className={`flex flex-col items-start text-base font-medium leading-6 ${dark ? "text-on-forest" : "text-ink"}`}>
            {it.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
