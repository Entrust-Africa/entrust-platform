import "server-only";
import type { UserProfile } from "./types";
import { tradeGet } from "./trade-api";

export interface BusinessInView {
  id: string;
  name: string;
  /** The signed-in person's role in it; null for Entrust staff, who aren't members. */
  role: string | null;
  /** Entrust staff looking at a business they work with, not a member of it. */
  staffView: boolean;
}

/**
 * The business a page is about. A member gets the one named in the address if it's theirs, else their active one. Entrust
 * staff aren't members, so their own organisations are never it: they open a business by its id in the address, and the
 * API decides whether they may (an administrator any, a facilitator or reviewer the businesses on their cohorts).
 */
export async function businessInView(me: UserProfile, organizationId: string | undefined): Promise<BusinessInView | null> {
  if (me.staffRole) {
    if (!organizationId) return null;
    const profile = await tradeGet<{ legalName: string | null; tradingName: string | null }>(`/business-profile?organizationId=${encodeURIComponent(organizationId)}`);
    if (!profile.data) return null;
    return { id: organizationId, name: profile.data.tradingName || profile.data.legalName || "This business", role: null, staffView: true };
  }
  const org =
    (organizationId ? me.organizations?.find((o) => o.id === organizationId) : null) ??
    me.organizations?.find((o) => o.id === me.activeOrganizationId) ??
    me.organizations?.[0];
  return org ? { id: org.id, name: org.name, role: org.role ?? null, staffView: false } : null;
}
