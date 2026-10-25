import * as React from "react";
import { sendEmail } from "@entrust/notify";
import {
  EmailLayout,
  EmailParagraph,
  InvitationEmail,
  PasswordResetEmail,
  VerificationEmail,
} from "@entrust/notify/templates";
import { SendEmailJobSchema, type SendEmailJobData } from "@entrust/jobs";

function TestEmailComponent({ message }: { message: string }) {
  return (
    <EmailLayout preview="Test Background Job Email" title="Test Notification">
      <EmailParagraph>{message}</EmailParagraph>
      <EmailParagraph>
        This email was successfully processed by the Entrust background worker runtime via pg-boss.
      </EmailParagraph>
    </EmailLayout>
  );
}

export async function handleSendEmail(jobData: SendEmailJobData) {
  const data = SendEmailJobSchema.parse(jobData);

  // Intentional failure trigger for retry and error state testing
  const recipients = Array.isArray(data.to) ? data.to : [data.to];
  const shouldFail =
    Boolean(data.props?.shouldFail) ||
    recipients.some((r) => r.toLowerCase() === "fail@example.test");

  if (shouldFail) {
    throw new Error(
      (data.props?.failReason as string) ??
        "Simulated email delivery failure for retry demonstration",
    );
  }

  let reactElement: React.ReactElement;

  switch (data.template) {
    case "verification":
      reactElement = VerificationEmail({ url: String(data.props.url ?? "#") });
      break;
    case "invitation":
      reactElement = InvitationEmail({
        organizationName: String(data.props.organizationName ?? "Entrust Org"),
        inviterName: String(data.props.inviterName ?? "Entrust Admin"),
        role: String(data.props.role ?? "member"),
        url: String(data.props.url ?? "#"),
      });
      break;
    case "password-reset":
      reactElement = PasswordResetEmail({ url: String(data.props.url ?? "#") });
      break;
    case "test":
    default:
      reactElement = (
        <TestEmailComponent
          message={String(data.props?.message ?? "Hello from Entrust Background Worker!")}
        />
      );
      break;
  }

  const result = await sendEmail({
    to: data.to,
    subject: data.subject,
    react: reactElement,
    from: data.from,
    text: data.text,
  });

  return {
    success: true,
    emailId: result.id,
    logged: result.logged,
    recipients,
  };
}
