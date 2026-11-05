import type { PaymentStatus } from "./types";

// How an exhibitor's booking moves from an application to a confirmed booth, and how a payment moves to confirmed.
// Nothing here is automatic: a booth is held only once an administrator approves the application, and confirmed only
// once a payment has been verified and a booth number given (section 6 of the instructions).

export const BOOKING_STATUSES = ["submitted", "approved", "rejected", "confirmed", "cancelled"] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const BOOKING_STATUS_LABELS: Readonly<Record<BookingStatus, string>> = {
  submitted: "Submitted",
  approved: "Approved, awaiting payment",
  rejected: "Rejected",
  confirmed: "Confirmed",
  cancelled: "Cancelled",
};

export const BOOKING_TRANSITIONS: Readonly<Record<BookingStatus, readonly BookingStatus[]>> = {
  submitted: ["approved", "rejected", "cancelled"],
  approved: ["confirmed", "rejected", "cancelled"],
  confirmed: ["cancelled"],
  rejected: [],
  cancelled: [],
};

/** Only these statuses use up a booth of the package, so a pending application can't hold one. */
export const BOOKING_HOLDS_BOOTH: readonly BookingStatus[] = ["approved", "confirmed"];

/** An application that is still open: a second one for the same package from the same address is the same application. */
export const BOOKING_OPEN: readonly BookingStatus[] = ["submitted", "approved", "confirmed"];

/** What stops a booking being confirmed, in words for the administrator. Empty means it can be confirmed. */
export function confirmationBlockers(booking: { status: BookingStatus; boothNumber: string | null }, payment: PaymentStatus | null): string[] {
  const blockers: string[] = [];
  if (booking.status !== "approved") blockers.push("Only an approved application can be confirmed.");
  if (payment !== "confirmed") blockers.push("The payment has not been verified.");
  if (!booking.boothNumber) blockers.push("No booth number has been assigned.");
  return blockers;
}

/** Where a payment can go (section 12). Only a person moves it to confirmed, after looking at the evidence. */
export const PAYMENT_TRANSITIONS: Readonly<Record<PaymentStatus, readonly PaymentStatus[]>> = {
  pending: ["awaiting_verification", "confirmed", "cancelled"],
  awaiting_verification: ["pending", "confirmed", "cancelled"],
  confirmed: ["refunded", "awaiting_verification"],
  cancelled: ["pending"],
  refunded: [],
};

/** What a payment is for. One payment per subject. */
export const PAYMENT_SUBJECTS = ["exhibitor_booking", "sponsorship", "delegate"] as const;
export type PaymentSubject = (typeof PAYMENT_SUBJECTS)[number];

/**
 * Business sectors the summit seeks (concept note, section 12), for the forms' sector lists and the sector reports. A form
 * offers these and "Other"; the value is kept as text.
 */
export const BUSINESS_SECTORS = [
  "Agriculture and agro-processing",
  "Manufacturing and industrial production",
  "Textiles and garments",
  "Leather and leather products",
  "Gemstones, jewellery and related industries",
  "Technology and digital services",
  "Healthcare and pharmaceuticals",
  "Logistics and supply chain services",
  "Tourism and hospitality",
  "Renewable energy and related services",
  "Professional and business services",
  "Other",
] as const;
