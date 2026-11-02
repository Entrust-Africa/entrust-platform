import * as React from "react";
import { EmailButton, EmailLayout, EmailParagraph } from "./layout";

export function PasswordResetEmail({
  url,
  platformName = "Entrust",
}: {
  url: string;
  platformName?: string;
}) {
  return (
    <EmailLayout preview={`Reset your ${platformName} password`} title="Reset your password">
      <EmailParagraph>
        We received a request to reset the password for your {platformName} account.
      </EmailParagraph>
      <EmailButton href={url}>Reset password</EmailButton>
      <EmailParagraph>This link expires soon. If you did not request a reset, no action is needed.</EmailParagraph>
    </EmailLayout>
  );
}
