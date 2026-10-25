import * as React from "react";
import { EmailButton, EmailLayout, EmailParagraph } from "./layout";

export function VerificationEmail({ url }: { url: string }) {
  return <EmailLayout preview="Verify your Entrust account" title="Verify your email"><EmailParagraph>Welcome to Entrust. Confirm your email address to finish setting up your account.</EmailParagraph><EmailButton href={url}>Verify email address</EmailButton><EmailParagraph>If you did not create an Entrust account, you can safely ignore this email.</EmailParagraph></EmailLayout>;
}
