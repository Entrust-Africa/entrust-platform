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
 * Entrust's own names for the staff roles (architecture spec section 17), shown in the screens. The roles keep their stored
 * names, so nothing that checks `admin`, `facilitator` or `reviewer` changes: Super Admin is `admin`, Cohort Manager is
 * `facilitator` and Assessor is `reviewer`. Quality is its own role, below.
 */
export const STAFF_ROLE_LABELS: Readonly<Record<string, string>> = {
  admin: "Super Admin",
  facilitator: "Cohort Manager",
  reviewer: "Assessor",
  quality: "Quality",
  committee: "Selection committee",
};

/** The name Entrust uses for a staff role, or the role itself if it has none. */
export const staffRoleLabel = (role: string): string => STAFF_ROLE_LABELS[role] ?? role;

/**
 * The Quality role in the Entrust organisation: a read-only check on how the programme is run. Like `committee`, it is not a
 * staff role, so it grants nothing by default in CLEAR or TRADE; only the endpoints that name it (programme reports and the
 * audit trail, across every cohort) open to it. It can't score, edit, enrol or change anything.
 */
export const QUALITY_ROLE = "quality";

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

/**
 * What Entrust staff can do in MIZAN (#223). MIZAN uses the staff roles that exist, with no role of its own:
 * - admin (Super Admin): everything, and the only one who records who supported an SME.
 * - reviewer (Assessor): registers SMEs, records the notice, assesses, and approves or returns other people's assessments.
 * - facilitator (Cohort Manager): nothing. Cohort managers train the SMEs MIZAN assesses, so they stay out of it entirely.
 * - quality: reads reports, the dashboard and the audit trail, and changes nothing.
 * Approving also needs the approver not to be the assessor and to have no support relationship with the SME: the API checks
 * that per assessment. An SME's own members see only their organisation's approved reports, which the API checks separately.
 */
export const MIZAN_ACTIONS = [
  "read_smes",
  "manage_smes",
  "manage_support",
  "assess",
  "review",
  "read_reports",
  "read_dashboard",
  "read_audit",
] as const;
export type MizanAction = (typeof MIZAN_ACTIONS)[number];

const MIZAN_MATRIX: Readonly<Record<MizanAction, { staff: readonly EntrustRole[]; quality: boolean }>> = {
  read_smes: { staff: ["admin", "reviewer"], quality: true },
  manage_smes: { staff: ["admin", "reviewer"], quality: false },
  manage_support: { staff: ["admin"], quality: false },
  assess: { staff: ["admin", "reviewer"], quality: false },
  review: { staff: ["admin", "reviewer"], quality: false },
  read_reports: { staff: ["admin", "reviewer"], quality: true },
  read_dashboard: { staff: ["admin", "reviewer"], quality: true },
  read_audit: { staff: ["admin"], quality: true },
};

/** Whether a member of the Entrust organisation may do this in MIZAN. Everyone else (SME members, sponsors) may do none of it. */
export function mizanCan(who: { staffRole: string | null; quality: boolean }, action: MizanAction): boolean {
  const rule = MIZAN_MATRIX[action];
  return (who.staffRole !== null && (rule.staff as readonly string[]).includes(who.staffRole)) || (who.quality && rule.quality);
}

/** Everything a member of the Entrust organisation may do in MIZAN, for screens deciding what to show. */
export function mizanActionsFor(who: { staffRole: string | null; quality: boolean }): MizanAction[] {
  return MIZAN_ACTIONS.filter((a) => mizanCan(who, a));
}
