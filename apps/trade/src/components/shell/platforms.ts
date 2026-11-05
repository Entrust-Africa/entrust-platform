import type { UserProfile } from "@/lib/types";

/**
 * The platforms the account menu offers to switch to. Staff get its own default (everything). The menu only knows CLEAR and TRADE,
 * so an organisation with just the Summit gets an empty list rather than a "Platforms" heading with nothing under it.
 */
export function switchablePlatforms(user: UserProfile): string[] | undefined {
  if (user.staffRole) return undefined;
  const activeOrg = user.organizations?.find((o) => o.id === user.activeOrganizationId) ?? user.organizations?.[0];
  return (activeOrg?.platforms ?? []).filter((platform) => platform === "clear" || platform === "trade");
}
