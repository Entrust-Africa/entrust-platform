import type { StatusTone } from "@entrust/ui";
import type { ApiClient, Body } from "./summit-api";
import type { UserProfile } from "./types";

// What the Summit's staff screens share: the shapes the API sends to officers, administrators and the committee, and the
// words we use for them. Nothing here talks to the network.

type Summit = ApiClient["v1"]["summit"];

export type StaffApplicationList = Body<Awaited<ReturnType<Summit["applications"]["$get"]>>>;
export type StaffApplication = StaffApplicationList["items"][number];
export type Workspace = Body<Awaited<ReturnType<Summit["applications"][":id"]["assessment"]["$get"]>>>;
export type WorkspaceCategory = Workspace["categories"][number];
export type Officers = Body<Awaited<ReturnType<Summit["officers"]["$get"]>>>;
export type CommitteeList = Body<Awaited<ReturnType<Summit["committee"]["applications"]["$get"]>>>;
export type CommitteeItem = CommitteeList["items"][number];
export type Compare = Body<Awaited<ReturnType<Summit["committee"]["compare"]["$get"]>>>;
export type FinalList = Body<Awaited<ReturnType<Summit["periods"][":id"]["final-list"]["$get"]>>>;
export type Dashboard = Body<Awaited<ReturnType<Summit["dashboard"]["$get"]>>>;
export type ReportCatalogue = Body<Awaited<ReturnType<Summit["reports"]["$get"]>>>;

/** What a signed-in person can do in the Summit's review screens. */
export interface StaffAccess {
  /** Administrators and facilitators open every application and assign officers (administrators). */
  allApplications: boolean;
  admin: boolean;
  /** Staff who can be assigned applications: they open only the ones assigned to them. */
  officer: boolean;
  committee: boolean;
  /** Can open the committee's lists, the dashboard and the final list. */
  selection: boolean;
}

export function staffAccess(user: UserProfile): StaffAccess {
  const committee = user.summitCommittee === true;
  const admin = user.staffRole === "admin";
  const allApplications = admin || user.staffRole === "facilitator";
  return { allApplications, admin, officer: Boolean(user.staffRole), committee, selection: committee || allApplications };
}

export const isSummitStaff = (user: UserProfile): boolean => Boolean(user.staffRole) || user.summitCommittee === true;

// ---- Words ----

const STATUSES: Record<string, { label: string; tone: StatusTone }> = {
  draft: { label: "Draft", tone: "idle" },
  submitted: { label: "Submitted", tone: "info" },
  incomplete: { label: "Incomplete", tone: "warn" },
  under_eligibility_review: { label: "Eligibility review", tone: "info" },
  eligible: { label: "Eligible", tone: "ok" },
  ineligible: { label: "Not eligible", tone: "danger" },
  under_assessment: { label: "Under assessment", tone: "info" },
  awaiting_additional_information: { label: "Waiting for the applicant", tone: "warn" },
  under_verification: { label: "Under verification", tone: "info" },
  assessment_completed: { label: "Assessment completed", tone: "info" },
  recommended: { label: "Recommended, awaiting review", tone: "product" },
  committee_review: { label: "Committee review", tone: "product" },
  selected: { label: "Selected", tone: "ok" },
  waitlisted: { label: "Waitlisted", tone: "info" },
  not_selected: { label: "Not selected", tone: "idle" },
  withdrawn: { label: "Withdrawn", tone: "idle" },
};

export const statusOf = (status: string): { label: string; tone: StatusTone } => STATUSES[status] ?? { label: status.replaceAll("_", " "), tone: "idle" };

/** The statuses staff can filter the applications by, in the order the work goes. */
export const STATUS_FILTERS = Object.entries(STATUSES)
  .filter(([id]) => id !== "draft")
  .map(([id, { label }]) => ({ id, label }));

export const RECOMMENDATIONS = [
  { id: "recommend_selection", label: "Recommend for Summit selection" },
  { id: "recommend_subject_to_verification", label: "Recommend subject to additional verification" },
  { id: "recommend_development_or_waitlist", label: "Recommend for development or waitlist" },
  { id: "do_not_recommend", label: "Do not recommend" },
] as const;

export const OPPORTUNITIES = [
  { id: "trade", label: "Trade opportunity" },
  { id: "investment", label: "Investment opportunity" },
  { id: "strategic_partnership", label: "Strategic partnership" },
  { id: "combined", label: "Combined opportunity" },
] as const;

export const DECISIONS = [
  { id: "selected", label: "Selected" },
  { id: "waitlisted", label: "Waitlisted" },
  { id: "not_selected", label: "Not selected" },
  { id: "further_review_required", label: "Further review required" },
] as const;

export const VERIFICATION_CLASSES = [
  { id: "self_reported", label: "Self-reported" },
  { id: "document_supported", label: "Supported by a document" },
  { id: "independently_verified", label: "Independently verified" },
  { id: "not_verified", label: "Not verified" },
  { id: "not_applicable", label: "Does not apply" },
] as const;

export const PATHWAYS = [
  { id: "trade_and_market_access", label: "Trade and market access" },
  { id: "investment", label: "Investment" },
  { id: "strategic_partnership", label: "Strategic partnership" },
  { id: "combined_trade_and_investment", label: "Combined trade and investment" },
] as const;

export const labelOf = (list: readonly { id: string; label: string }[], id: string | null | undefined): string => list.find((x) => x.id === id)?.label ?? (id ? id.replaceAll("_", " ") : "—");

/** A score out of 100 with no more than one decimal. */
export const scoreText = (score: number | null | undefined): string => (score === null || score === undefined ? "—" : String(Math.round(score * 10) / 10));
