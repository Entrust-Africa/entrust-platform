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

/**
 * Roles in a sponsor organisation, such as the bank that sponsors a TRADE cohort (#70). An administrator manages their
 * own colleagues; a viewer only reads. Neither is a staff role, so they open nothing in CLEAR.
 */
export const SPONSOR_ROLES = ["sponsor_admin", "sponsor_viewer"] as const;
export type SponsorRole = (typeof SPONSOR_ROLES)[number];

export type Role = SmeRole | EntrustRole;

/** Who makes a change: a person with one of these roles, or CLEAR itself (timers, automated checks). */
export type Actor = Role | "system";

/** Platforms that run on the shared core (#50). */
export const PLATFORMS = ["clear", "trade", "summit", "mizan"] as const;
export type Platform = (typeof PLATFORMS)[number];
