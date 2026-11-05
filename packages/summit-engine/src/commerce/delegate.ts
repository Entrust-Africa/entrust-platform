import type { PaymentStatus } from "./types";

// Delegate registration (section 4 and 8): a participant picks a category, registers, receives a reference and a badge with a
// QR code, and is checked in at the event. A paid category's badge counts only once its payment has been verified.

export const DELEGATE_STATUSES = ["registered", "cancelled"] as const;
export type DelegateStatus = (typeof DELEGATE_STATUSES)[number];

/** The `eligibility` attribute of the delegate category the selected SMEs register under. */
export const SELECTED_SME_ELIGIBILITY = "selected_sme";

/**
 * Whether a badge is good for entry, and if not, why not (in words for the person at the desk). Check-in is refused with the
 * same reasons. A cancelled registration is never valid, and a paid one waits for a verified payment.
 */
export function badgeProblems(delegate: { status: DelegateStatus; checkedInAt: Date | null }, payment: PaymentStatus | null): string[] {
  const problems: string[] = [];
  if (delegate.status === "cancelled") problems.push("This registration was cancelled.");
  else if (payment !== "confirmed") {
    problems.push(
      payment === "refunded" ? "The payment was refunded." : payment === "cancelled" ? "The payment was cancelled." : "The payment has not been verified.",
    );
  }
  return problems;
}

/** What the person at the desk should see. */
export type BadgeState = "valid" | "already_checked_in" | "not_valid";

export function badgeState(delegate: { status: DelegateStatus; checkedInAt: Date | null }, payment: PaymentStatus | null): BadgeState {
  if (badgeProblems(delegate, payment).length > 0) return "not_valid";
  return delegate.checkedInAt ? "already_checked_in" : "valid";
}

/**
 * What a scanner or a desk typed in might be: the badge's web address (the QR code holds it), the bare token in it, or the
 * registration reference. Returns the token or reference, in the form the database stores it.
 */
export function parseBadgeCode(input: string): { token: string } | { number: string } | null {
  const text = input.trim();
  if (!text) return null;
  const reference = /^DEL-\d{3,}$/i.exec(text);
  if (reference) return { number: text.toUpperCase() };
  const fromUrl = /\/badge\/([A-Za-z0-9_-]{16,64})\/?(?:[?#].*)?$/.exec(text);
  if (fromUrl?.[1]) return { token: fromUrl[1] };
  if (/^[A-Za-z0-9_-]{16,64}$/.test(text)) return { token: text };
  return null;
}
