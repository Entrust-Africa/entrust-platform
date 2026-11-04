/**
 * Organisation kinds, roles and platforms shared by every platform (#50).
 */

export const ORGANIZATION_KINDS = ["sme", "entrust", "sponsor"] as const;
export type OrganizationKind = (typeof ORGANIZATION_KINDS)[number];

/** Roles in an SME organisation (#18, #50). */
export const SME_ROLES = ["owner", "member"] as const;
export type SmeRole = (typeof SME_ROLES)[number];

/** Roles in the Entrust organisation (#18, #50). */
export const ENTRUST_ROLES = ["admin", "facilitator", "reviewer"] as const;
export type EntrustRole = (typeof ENTRUST_ROLES)[number];

export type Role = SmeRole | EntrustRole;

/** Who makes a change: a person with one of these roles, or CLEAR itself (timers, automated checks). */
export type Actor = Role | "system";

/** Platforms that run on the shared core (#50). */
export const PLATFORMS = ["clear", "trade", "summit", "mizan"] as const;
export type Platform = (typeof PLATFORMS)[number];
