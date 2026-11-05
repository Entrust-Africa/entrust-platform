import type { PaymentStatus } from "./types";

// The figures of the commercial dashboard (section 10), as pure sums so each one is defined once and tested. "Expected" is what
// has been committed to: payments that are pending, awaiting verification or confirmed. "Received" is only what an administrator
// has verified. "Outstanding" is the committed payments not yet verified. Applications and enquiries that are still being
// worked are the "potential", kept apart so they never inflate the expected revenue.

/** The streams money comes in through. */
export const REVENUE_STREAMS = ["delegates", "exhibition", "sponsorship"] as const;
export type RevenueStream = (typeof REVENUE_STREAMS)[number];

export const REVENUE_STREAM_LABELS: Readonly<Record<RevenueStream, string>> = {
  delegates: "Delegate registrations",
  exhibition: "Exhibition",
  sponsorship: "Sponsorship",
};

/** Payments of one status, summed. `received` is what was verified as arrived (or, where it wasn't recorded, what was due). */
export interface PaymentFigures {
  status: PaymentStatus;
  count: number;
  dueCents: number;
  receivedCents: number;
}

export interface Revenue {
  expectedCents: number;
  receivedCents: number;
  outstandingCents: number;
  refundedCents: number;
}

export function revenueOf(rows: readonly PaymentFigures[]): Revenue {
  let outstanding = 0;
  let confirmedDue = 0;
  let received = 0;
  let refunded = 0;
  for (const row of rows) {
    if (row.status === "pending" || row.status === "awaiting_verification") outstanding += row.dueCents;
    else if (row.status === "confirmed") {
      confirmedDue += row.dueCents;
      received += row.receivedCents;
    } else if (row.status === "refunded") refunded += row.receivedCents;
  }
  return { expectedCents: outstanding + confirmedDue, receivedCents: received, outstandingCents: outstanding, refundedCents: refunded };
}

export interface BoothFigures {
  /** Null when no capacity has been set for the package. */
  capacity: number | null;
  /** Applications waiting for a decision. */
  submitted: number;
  /** Approved, awaiting payment and confirmation. */
  reserved: number;
  /** Payment verified and booth confirmed. */
  confirmed: number;
  markedSoldOut: boolean;
}

export function boothFigures(b: BoothFigures): BoothFigures & { available: number | null; soldOut: boolean } {
  const held = b.reserved + b.confirmed;
  const available = b.capacity === null ? null : Math.max(0, b.capacity - held);
  return { ...b, available, soldOut: b.markedSoldOut || available === 0 };
}

/** The booth totals across packages. Packages with no capacity set add nothing to the totals, and `capacitySet` says so. */
export function boothTotals(packages: readonly BoothFigures[]): { capacitySet: boolean; totalBooths: number | null; available: number | null } {
  const sized = packages.filter((p) => p.capacity !== null);
  if (sized.length === 0) return { capacitySet: false, totalBooths: null, available: null };
  return {
    capacitySet: sized.length === packages.length,
    totalBooths: sized.reduce((sum, p) => sum + (p.capacity ?? 0), 0),
    available: sized.reduce((sum, p) => sum + (boothFigures(p).available ?? 0), 0),
  };
}

/** The reports an administrator can export (section 10), each as Excel, CSV or PDF. */
export const COMMERCE_REPORTS = [
  { id: "delegates", number: 1, title: "Delegate registrations", purpose: "Everyone registered to attend, with category, payment and check-in." },
  { id: "exhibitors", number: 2, title: "Exhibitors", purpose: "Every exhibition application and booking, with booth, payment and status." },
  { id: "sponsorship", number: 3, title: "Sponsorship", purpose: "Every sponsorship and opportunity enquiry, with its pipeline status and value." },
  { id: "payments", number: 4, title: "Payments", purpose: "Every payment owed or received, with its status, reference and who verified it." },
  { id: "revenue", number: 5, title: "Revenue", purpose: "Expected, received and outstanding revenue by stream and by item." },
  { id: "country_sector", number: 6, title: "Countries and sectors", purpose: "Delegates, exhibitors and sponsors by country and by sector." },
] as const;
export type CommerceReportId = (typeof COMMERCE_REPORTS)[number]["id"];
export const COMMERCE_REPORT_IDS = COMMERCE_REPORTS.map((r) => r.id) as [CommerceReportId, ...CommerceReportId[]];
