import * as React from "react";
import { sendEmail } from "@entrust/notify";
import {
  EmailLayout,
  EmailParagraph,
  InvitationEmail,
  PasswordResetEmail,
  SummitClarificationEmail,
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
  const recipients = Array.isArray(data.to) ? data.to : [data.to];

  let reactElement: React.ReactElement;

  switch (data.template) {
    case "verification":
      reactElement = <VerificationEmail url={data.props.url} />;
      break;
    case "invitation":
      reactElement = (
        <InvitationEmail
          organizationName={data.props.organizationName}
          inviterName={data.props.inviterName}
          role={data.props.role}
          url={data.props.url}
        />
      );
      break;
    case "password-reset":
      reactElement = <PasswordResetEmail url={data.props.url} />;
      break;
    case "summit-clarification":
      reactElement = (
        <SummitClarificationEmail
          applicationNumber={data.props.applicationNumber}
          organizationName={data.props.organizationName}
          message={data.props.message}
          {...(data.props.url ? { url: data.props.url } : {})}
        />
      );
      break;
    case "test":
    default:
      reactElement = (
        <TestEmailComponent
          message={data.props?.message ?? "Hello from Entrust Background Worker!"}
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
