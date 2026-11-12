import { PLATFORM_COLOR, PLATFORM_LOGOS as SITE_LOGOS, PLATFORM_URLS } from "../../lib/site";

/**
 * Colours and links for the three platform pages (TRADE, CLEAR Export, MIZAN),
 * taken from the Sketch file. `accent` is the bright paper-cut colour used for
 * the hero rule, eyebrow and horizon; `deep` is its darker partner (alternate
 * bar segments, second horizon piece); `ink` is the readable shade used for
 * numbers on the light page.
 * MIZAN uses the gold from its design; its menu marker is the deep gold.
 */
export type PlatformTheme = {
  accent: string;
  deep: string;
  ink: string;
  /** Fills for the three bright horizon pieces, left to right. */
  horizon: [string, string, string];
};

export const PLATFORM_THEME = {
  trade: {
    accent: PLATFORM_COLOR.trade,
    deep: "#c8553d",
    ink: "#157642",
    horizon: [PLATFORM_COLOR.trade, "#c8553d", PLATFORM_COLOR.trade],
  },
  clear: {
    accent: PLATFORM_COLOR.clear,
    deep: "#087970",
    ink: "#087970",
    horizon: [PLATFORM_COLOR.clear, "#087970", PLATFORM_COLOR.clear],
  },
  mizan: {
    accent: "#d9a033",
    deep: "#a8741a",
    ink: "#7a5a14",
    horizon: ["#d9a033", "#a8741a", "#d9a033"],
  },
} satisfies Record<string, PlatformTheme>;

/** App logo paths, keyed by platform. */
export const PLATFORM_LOGOS = {
  trade: SITE_LOGOS.trade.src,
  clear: SITE_LOGOS.clear.src,
  mizan: SITE_LOGOS.mizan.src,
} as const;

/** Account pages that exist in each platform app (apps/clear, apps/mizan). */
export const PLATFORM_ACCOUNT = {
  clear: {
    signIn: `${PLATFORM_URLS.clear}/sign-in`,
    forgotPassword: `${PLATFORM_URLS.clear}/forgot-password`,
  },
  mizan: {
    signIn: `${PLATFORM_URLS.mizan}/sign-in`,
    forgotPassword: `${PLATFORM_URLS.mizan}/forgot-password`,
  },
} as const;

/** Props that open a platform link in a new tab. */
export const NEW_TAB = { target: "_blank", rel: "noopener noreferrer" } as const;
