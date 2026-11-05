import type { StatusTone } from "@entrust/ui";
import type { ApiClient, Body } from "./summit-api";
import type { UserProfile } from "./types";

// What the ADTIS commercial screens share: the shapes the API returns, the words we use for them, and who may open them.
// Nothing here talks to the network.

type Commerce = ApiClient["v1"]["summit"]["commerce"];

export type CommerceDashboard = Body<Awaited<ReturnType<Commerce["dashboard"]["$get"]>>>;
export type EditionList = Body<Awaited<ReturnType<Commerce["editions"]["$get"]>>>;
export type EditionDetail = Body<Awaited<ReturnType<Commerce["editions"][":id"]["$get"]>>>;
export type AdminProduct = EditionDetail["products"][number];
export type BookingList = Body<Awaited<ReturnType<Commerce["exhibitor-bookings"]["$get"]>>>;
export type BookingDetail = Body<Awaited<ReturnType<Commerce["exhibitor-bookings"][":id"]["$get"]>>>;
export type EnquiryList = Body<Awaited<ReturnType<Commerce["sponsor-enquiries"]["$get"]>>>;
export type EnquiryDetail = Body<Awaited<ReturnType<Commerce["sponsor-enquiries"][":id"]["$get"]>>>;
export type DelegateList = Body<Awaited<ReturnType<Commerce["delegates"]["$get"]>>>;
export type DelegateDetail = Body<Awaited<ReturnType<Commerce["delegates"][":id"]["$get"]>>>;
export type ProfileList = Body<Awaited<ReturnType<Commerce["directory"]["profiles"]["$get"]>>>;
export type ProfileDetail = Body<Awaited<ReturnType<Commerce["directory"]["profiles"][":id"]["$get"]>>>;
export type B2bList = Body<Awaited<ReturnType<Commerce["directory"]["enquiries"]["$get"]>>>;
export type ReportCatalogue = Body<Awaited<ReturnType<Commerce["reports"]["$get"]>>>;
export type Payment = NonNullable<BookingDetail["payment"]>;

/** Who may open the commercial screens: Entrust administrators and facilitators. */
export const canHandleCommerce = (user: Pick<UserProfile, "staffRole">): boolean => user.staffRole === "admin" || user.staffRole === "facilitator";

/** US dollars from cents: "$1,560", or "$1,560.50" when there are cents. */
export function usd(cents: number): string {
  const whole = cents % 100 === 0;
  const text = (cents / 100).toLocaleString("en-US", { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: whole ? 0 : 2 });
  return `$${text}`;
}

/** Dollars typed into a box to cents; null if it isn't an amount. */
export function toCents(text: string): number | null {
  const cleaned = text.replace(/[\s,$]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  return Math.round(Number(cleaned) * 100);
}

/** Cents as the plain number in a box. */
export const centsToInput = (cents: number): string => (cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2));

export interface Look {
  label: string;
  tone: StatusTone;
}

export const PAYMENT_LOOK: Record<string, Look> = {
  pending: { label: "Payment pending", tone: "warn" },
  awaiting_verification: { label: "Awaiting verification", tone: "info" },
  confirmed: { label: "Payment confirmed", tone: "ok" },
  cancelled: { label: "Payment cancelled", tone: "idle" },
  refunded: { label: "Refunded", tone: "danger" },
};

export const BOOKING_LOOK: Record<string, Look> = {
  submitted: { label: "Submitted", tone: "info" },
  approved: { label: "Approved, awaiting payment", tone: "warn" },
  confirmed: { label: "Confirmed", tone: "ok" },
  rejected: { label: "Rejected", tone: "danger" },
  cancelled: { label: "Cancelled", tone: "idle" },
};

export const ENQUIRY_LOOK: Record<string, Look> = {
  new: { label: "New enquiry", tone: "info" },
  contacted: { label: "Contacted", tone: "info" },
  negotiation: { label: "Negotiation", tone: "warn" },
  proposal_sent: { label: "Proposal sent", tone: "warn" },
  confirmed: { label: "Confirmed", tone: "ok" },
  declined: { label: "Declined", tone: "idle" },
};

export const ENQUIRY_ORDER = ["new", "contacted", "negotiation", "proposal_sent", "confirmed", "declined"] as const;

export const DELEGATE_LOOK: Record<string, Look> = {
  registered: { label: "Registered", tone: "ok" },
  cancelled: { label: "Cancelled", tone: "idle" },
};

export const PROFILE_LOOK: Record<string, Look> = {
  draft: { label: "Draft", tone: "idle" },
  published: { label: "Published", tone: "ok" },
};

export const KIND_LABELS: Record<string, string> = {
  exhibition_package: "Exhibition package",
  sponsorship_level: "Sponsorship level",
  delegate_category: "Delegate category",
  opportunity: "Additional opportunity",
};

export const KIND_PLURALS: Record<string, string> = {
  exhibition_package: "Exhibition packages",
  sponsorship_level: "Sponsorship levels",
  delegate_category: "Delegate categories",
  opportunity: "Additional opportunities",
};

export const PRODUCT_STATUS_LOOK: Record<string, Look> = {
  published: { label: "Published", tone: "ok" },
  draft: { label: "Draft", tone: "idle" },
  archived: { label: "Archived", tone: "idle" },
};

export const B2B_INTEREST_LABELS: Record<string, string> = {
  buyer: "Buying products or services",
  investor: "Investing",
  distributor: "Distribution",
  partner: "Strategic partnership",
  other: "Something else",
};

export const BENEFIT_AREAS = [
  ["logo", "Logo placement and brand visibility"],
  ["speaking", "Speaking opportunities"],
  ["exhibition", "Exhibition space"],
  ["delegates", "Delegate passes"],
  ["digital", "Website and digital marketing"],
  ["social", "Social media visibility"],
  ["b2b", "B2B matchmaking"],
  ["networking", "Networking events"],
  ["exclusivity", "Category exclusivity"],
] as const;

export const COMPARISON_ROWS = [
  ["boothSize", "Booth size"],
  ["exhibitorPasses", "Exhibitor passes"],
  ["furniture", "Furniture"],
  ["placement", "Location"],
  ["directory", "Digital directory"],
  ["networking", "B2B and networking"],
] as const;

/** A date and time for the staff, in UTC so it reads the same on every device. */
export function when(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
}
