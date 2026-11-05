import { enqueue, JOB_NAMES } from "@entrust/jobs";
import { formatUsd, type PaymentMethod } from "@entrust/summit-engine";

// The emails of the commercial side. Each is a "summit-notice": the service writes the words, one template draws them.
// A queue that is down must not undo the booking or payment it announces, so a failure is logged and reported to the
// caller as false, and the records say whether the email went.

export interface Notice {
  to: string;
  subject: string;
  heading: string;
  greeting: string;
  paragraphs: string[];
  details?: { label: string; value: string }[];
  action?: { label: string; url: string };
}

/** The public ADTIS site, for the buttons in the emails. Unset, the emails have no button. */
export function siteUrl(path = ""): string | null {
  const base = process.env.SUMMIT_SITE_URL?.trim().replace(/\/+$/, "");
  return base ? `${base}${path}` : null;
}

/** Queues a notice. Returns whether it was queued. */
export async function sendNotice(notice: Notice): Promise<boolean> {
  try {
    await enqueue(JOB_NAMES.SEND_EMAIL, {
      to: notice.to,
      subject: notice.subject,
      template: "summit-notice",
      props: {
        heading: notice.heading,
        greeting: notice.greeting,
        paragraphs: notice.paragraphs,
        details: notice.details ?? [],
        ...(notice.action ? { action: notice.action } : {}),
      },
    });
    return true;
  } catch (error) {
    console.error(`[summit] The email "${notice.subject}" to ${notice.to} could not be queued`, error);
    return false;
  }
}

/** How to pay, in the organisers' words. Before they have written any, the applicant is told it will follow. */
export function paymentParagraphs(methods: readonly PaymentMethod[], reference: string): string[] {
  if (methods.length === 0) {
    return [`Our team will send you the payment instructions shortly. Please quote ${reference} on any payment.`];
  }
  return [
    `Please pay by one of the methods below and quote ${reference} on your payment. Your place is confirmed once the payment has been verified.`,
    ...methods.map((m) => `${m.label}: ${m.instructions}`),
  ];
}

export const amountText = (cents: number, currency = "USD"): string => (currency === "USD" ? formatUsd(cents) : `${formatUsd(cents)} ${currency}`);
