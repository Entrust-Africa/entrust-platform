export type AuthPlatform = "clear" | "trade" | "mizan";

interface PlatformConfig {
  envVar: "CLEAR_APP_URL" | "TRADE_APP_URL" | "MIZAN_APP_URL";
  defaultDevUrl: string;
  name: string;
}

const PLATFORM_CONFIGS: Record<AuthPlatform, PlatformConfig> = {
  clear: {
    envVar: "CLEAR_APP_URL",
    defaultDevUrl: "http://localhost:3000",
    name: "CLEAR",
  },
  trade: {
    envVar: "TRADE_APP_URL",
    defaultDevUrl: "http://localhost:3001",
    name: "TRADE",
  },
  mizan: {
    envVar: "MIZAN_APP_URL",
    defaultDevUrl: "http://localhost:3003",
    name: "MIZAN",
  },
};

/** The name a platform goes by in emails: CLEAR, TRADE or MIZAN. */
export function platformDisplayName(platform: AuthPlatform): string {
  return PLATFORM_CONFIGS[platform].name;
}

/**
 * Resolves the base URL for a given Entrust platform application.
 *
 * In production or when sending real emails, an unset URL or a localhost URL
 * is considered a configuration error and throws to prevent delivering
 * unreachable links to external recipients.
 */
export function getPlatformAppUrl(platform: AuthPlatform): string {
  const config = PLATFORM_CONFIGS[platform];
  const raw = process.env[config.envVar]?.trim();
  const isProd = process.env.NODE_ENV === "production";
  const isSend = process.env.EMAIL_MODE === "send";

  if (!raw) {
    if (isProd || isSend) {
      throw new Error(
        `${config.envVar} must be configured in production (or when EMAIL_MODE=send) to generate valid invitation links.`,
      );
    }
    return config.defaultDevUrl;
  }

  const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(raw);
  if (isProd && isLocalhost) {
    throw new Error(
      `${config.envVar} cannot point to localhost ('${raw}') in production. Set it to your public domain.`,
    );
  }

  return raw.replace(/\/+$/, "");
}

/** Resolves the base URL for the CLEAR frontend application. */
export function getClearAppUrl(): string {
  return getPlatformAppUrl("clear");
}

/** Resolves the base URL for the TRADE frontend application. */
export function getTradeAppUrl(): string {
  return getPlatformAppUrl("trade");
}

/** Resolves the base URL for the MIZAN frontend application. */
export function getMizanAppUrl(): string {
  return getPlatformAppUrl("mizan");
}

/**
 * Detects whether a URL or callback URL belongs to MIZAN, TRADE or CLEAR.
 * Defaults to "clear" if unrecognized or invalid.
 */
export function detectPlatformFromUrl(rawUrl: string): AuthPlatform {
  try {
    const parsed = new URL(rawUrl);
    const cb = parsed.searchParams.get("callbackURL") || parsed.searchParams.get("redirectTo");
    const targetUrl = cb ? new URL(cb, parsed.origin) : parsed;
    const targetOrigin = targetUrl.origin.toLowerCase();
    // Read directly, not through getMizanAppUrl: that throws in production while MIZAN_APP_URL is unset, and the catch below
    // would then send every TRADE email out as CLEAR.
    const mizanSetting = process.env.MIZAN_APP_URL?.trim();
    const mizanOrigin = mizanSetting ? new URL(mizanSetting).origin.toLowerCase() : null;
    if (
      targetOrigin === mizanOrigin ||
      targetUrl.hostname.startsWith("mizan.") ||
      targetUrl.searchParams.get("platform") === "mizan" ||
      cb?.includes(":3003") ||
      cb?.includes("mizan.")
    ) {
      return "mizan";
    }
    const tradeUrl = getTradeAppUrl();
    const tradeOrigin = new URL(tradeUrl).origin.toLowerCase();

    if (
      targetOrigin === tradeOrigin ||
      targetUrl.hostname.startsWith("trade.") ||
      targetUrl.searchParams.get("platform") === "trade" ||
      cb?.includes(":3001") ||
      cb?.includes("trade.")
    ) {
      return "trade";
    }
    return "clear";
  } catch {
    return "clear";
  }
}
