import { applyUrl } from "@/lib/period";

// The four ways to take part. The "How would you like to join us?" cards and the header's Register menu both read this list,
// so the two can't drift apart. Server side only: the SME link comes from an environment variable.

export type JoinKey = "sme" | "buyer-investor" | "diaspora" | "sponsor";

export interface JoinOption {
  key: JoinKey;
  href: string;
  /** The card's title. */
  title: string;
  /** The card's one-line description. */
  text: string;
  /** The button on the card. */
  cta: string;
  /** The shorter line in the header's Register menu. */
  menuLabel: string;
}

export function joinOptions(): JoinOption[] {
  return [
    {
      key: "sme",
      href: applyUrl(),
      title: "Register as an SME",
      text: "Apply to be one of the 100 selected African businesses. Free to apply; an assessment decides.",
      cta: "Apply as an SME",
      menuLabel: "An SME",
    },
    {
      key: "buyer-investor",
      href: "/participate/register?category=investor-buyer",
      title: "Register as a buyer or investor",
      text: "Meet selected SMEs through priority B2B matchmaking and facilitated introductions.",
      cta: "Register to meet SMEs",
      menuLabel: "A buyer or investor",
    },
    {
      key: "diaspora",
      href: "/participate/register?category=diaspora-business",
      title: "Participate as a diaspora partner",
      text: "Invest, partner and bring your expertise home: the Brain Gain agenda.",
      cta: "Join as a diaspora partner",
      menuLabel: "A diaspora partner",
    },
    {
      key: "sponsor",
      href: "/sponsor",
      title: "Become a sponsor or institutional partner",
      text: "Sponsorship levels, pavilions and sessions for organisations and institutions.",
      cta: "See sponsorship options",
      menuLabel: "A sponsor or institutional partner",
    },
  ];
}
