import { EmailButton, EmailLayout, EmailParagraph } from "./layout";

export function PasswordResetEmail({ url }: { url: string }) {
  return <EmailLayout preview="Reset your Entrust password" title="Reset your password"><EmailParagraph>We received a request to reset the password for your Entrust account.</EmailParagraph><EmailButton href={url}>Reset password</EmailButton><EmailParagraph>This link expires soon. If you did not request a reset, no action is needed.</EmailParagraph></EmailLayout>;
}
