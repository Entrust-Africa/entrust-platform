import { eq } from "drizzle-orm";
import { schema } from "@entrust/db";
import type { Executor } from "./db";
import { amountText, firstName, sendNotice, siteUrl } from "./summit-commerce-mail";

// What people are told when an administrator verifies their payment. The payment is the same for a booth, a sponsorship
// and a delegate registration; the words depend on what it was for.

type PaymentRow = typeof schema.commercePayment.$inferSelect;

export async function announcePaymentConfirmed(db: Executor, payment: PaymentRow): Promise<void> {
  const received = amountText(payment.amountReceivedCents ?? payment.amountDueCents);
  if (payment.subjectType === "exhibitor_booking") {
    const [booking] = await db.select().from(schema.exhibitorBooking).where(eq(schema.exhibitorBooking.id, payment.subjectId));
    if (!booking) return;
    await sendNotice({
      to: booking.email,
      subject: `Payment received for your ADTIS booth (${booking.number})`,
      heading: "We have verified your payment",
      greeting: `Hello ${firstName(booking.contactName)},`,
      paragraphs: [
        `Thank you. We have verified your payment for ${booking.companyName}. The ADTIS team will now allocate your booth and send you the booking confirmation.`,
      ],
      details: [
        { label: "Reference", value: booking.number },
        { label: "Amount received", value: `${received} (USD)` },
      ],
    });
  } else if (payment.subjectType === "sponsorship") {
    const [enquiry] = await db.select().from(schema.sponsorEnquiry).where(eq(schema.sponsorEnquiry.id, payment.subjectId));
    if (!enquiry) return;
    await sendNotice({
      to: enquiry.email,
      subject: `Payment received for your ADTIS sponsorship (${enquiry.number})`,
      heading: "We have verified your payment",
      greeting: `Hello ${firstName(enquiry.contactName)},`,
      paragraphs: [`Thank you. We have verified the payment for ${enquiry.organisationName}'s sponsorship of the Africa Diaspora Trade & Investment Summit.`],
      details: [
        { label: "Reference", value: enquiry.number },
        { label: "Amount received", value: `${received} (USD)` },
      ],
    });
  } else {
    const [delegate] = await db.select().from(schema.delegateRegistration).where(eq(schema.delegateRegistration.id, payment.subjectId));
    if (!delegate || delegate.status !== "registered") return;
    await sendNotice({
      to: delegate.email,
      subject: `Your ADTIS badge is ready (${delegate.number})`,
      heading: "Your payment is verified",
      greeting: `Hello ${firstName(delegate.fullName)},`,
      paragraphs: ["Thank you. We have verified your payment and your delegate badge is now valid. Show it on your phone, or print it, when you arrive."],
      details: [
        { label: "Reference", value: delegate.number },
        { label: "Amount received", value: `${received} (USD)` },
      ],
      action: { label: "Open your badge", url: siteUrl(`/badge/${delegate.badgeToken}`) },
    });
  }
}
