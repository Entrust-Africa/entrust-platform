import * as React from "react";
import { EmailButton, EmailLayout, EmailParagraph } from "./layout";

export function InvitationEmail({
  organizationName,
  inviterName,
  role,
  url,
  platformName = "Entrust",
}: {
  organizationName: string;
  inviterName: string;
  role: string;
  url: string;
  platformName?: string;
}) {
  return (
    <EmailLayout preview={`You have been invited to ${organizationName}`} title={`Join ${organizationName}`}>
      <EmailParagraph>
        {inviterName} invited you to join <strong>{organizationName}</strong> on {platformName} as a {role}.
      </EmailParagraph>
      <EmailButton href={url}>View invitation</EmailButton>
      <EmailParagraph>If you were not expecting this invitation, you can ignore this email.</EmailParagraph>
    </EmailLayout>
  );
}
