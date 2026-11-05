import * as React from "react";
import { EmailLayout, EmailParagraph } from "./layout";

export function SummitRegistrationEmail({ fullName, passName, number }: { fullName: string; passName: string; number: string }) {
  return (
    <EmailLayout preview={`We have your registration for the Diaspora Trade Summit (${number})`} title="We have your registration">
      <EmailParagraph>Hello {fullName},</EmailParagraph>
      <EmailParagraph>
        Thank you for registering for the Diaspora Trade Summit in Addis Ababa. We have you down for the <strong>{passName}</strong>. Your reference is {number}.
      </EmailParagraph>
      <EmailParagraph>
        Nothing is charged yet. We will email this address with the next steps for your ticket as soon as they are ready. If anything above is wrong, register again on the Summit page with the same email address and we will use the new details.
      </EmailParagraph>
    </EmailLayout>
  );
}
