// Where the platform picker sends someone who chooses the other platform.

export type PlatformId = "clear" | "trade" | "mizan";

/** The port each platform's dev server uses on a developer's machine. */
const DEV_PORT: Record<PlatformId, string> = { clear: "3000", trade: "3001", mizan: "3003" };

export interface PlatformUrlInput {
  /** The platform the visitor chose. */
  platform: PlatformId;
  /** The platform they are on now. */
  current: PlatformId;
  /** An address the app passed in. */
  explicit?: string | undefined;
  /** The address from the deployment's settings (NEXT_PUBLIC_CLEAR_APP_URL, NEXT_PUBLIC_TRADE_APP_URL, NEXT_PUBLIC_MIZAN_APP_URL), if set. */
  configured?: string | undefined;
  /** The page the visitor is on. Absent while rendering on the server. */
  location?: Pick<Location, "protocol" | "hostname" | "port"> | undefined;
}

/**
 * The address of a platform. The platforms are served side by side (clear.example.com, trade.example.com and mizan.example.com), so when
 * nothing says otherwise it is the page's own address with the name swapped. Only a developer's machine, with each
 * platform on its own port, falls back to localhost; a deployment with no setting must never send people there.
 */
export function platformUrl({ platform, current, explicit, configured, location }: PlatformUrlInput): string {
  if (platform === current) return "/";
  if (explicit) return explicit;
  const set = configured?.trim().replace(/\/+$/, "");
  if (set) return set;
  if (location) {
    const sibling = /^(?:clear|trade|mizan)\.(.+)$/.exec(location.hostname);
    if (sibling) return `${location.protocol}//${platform}.${sibling[1]}${location.port ? `:${location.port}` : ""}`;
    if (location.port === DEV_PORT[platform]) return "/";
  }
  return `http://localhost:${DEV_PORT[platform]}`;
}
