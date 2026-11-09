import * as React from "react";
import { sendEmail } from "@entrust/notify";
import {
  EmailLayout,
  EmailParagraph,
  InvitationEmail,
  PasswordResetEmail,
  SummitClarificationEmail,
  SummitNoticeEmail,
  SummitRegistrationEmail,
  SummitResultEmail,
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
    case "summit-result":
      reactElement = (
        <SummitResultEmail
          applicationNumber={data.props.applicationNumber}
          organizationName={data.props.organizationName}
          message={data.props.message}
          {...(data.props.url ? { url: data.props.url } : {})}
        />
      );
      break;
    case "summit-registration":
      reactElement = <SummitRegistrationEmail fullName={data.props.fullName} passName={data.props.passName} number={data.props.number} />;
      break;
    case "trade-notice":
    case "summit-notice":
      reactElement = (
        <SummitNoticeEmail
          heading={data.props.heading}
          greeting={data.props.greeting}
          paragraphs={data.props.paragraphs}
          details={data.props.details}
          {...(data.props.action ? { action: data.props.action } : {})}
        />
      );
      break;
    case "trade-session-reminder":
      reactElement = (
        <EmailLayout preview={`Reminder: ${data.props.sessionTitle}`} title="Upcoming TRADE Live Session">
          <EmailParagraph>
            Hello{data.props.recipientName ? ` ${data.props.recipientName}` : ""},
          </EmailParagraph>
          <EmailParagraph>
            This is a reminder for your upcoming live session in <strong>{data.props.cohortName}</strong>:
          </EmailParagraph>
          <EmailParagraph>
            <strong>{data.props.sessionTitle}</strong><br />
            Time: {data.props.startTime}<br />
            {data.props.venue ? `Location / Link: ${data.props.venue}` : ""}
          </EmailParagraph>
        </EmailLayout>
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
