import { EmailButton, EmailLayout, EmailParagraph } from "./layout";

export function InvitationEmail({ organizationName, inviterName, role, url }: { organizationName: string; inviterName: string; role: string; url: string }) {
  return <EmailLayout preview={`You have been invited to ${organizationName}`} title={`Join ${organizationName}`}><EmailParagraph>{inviterName} invited you to join <strong>{organizationName}</strong> on Entrust as a {role}.</EmailParagraph><EmailButton href={url}>View invitation</EmailButton><EmailParagraph>If you were not expecting this invitation, you can ignore this email.</EmailParagraph></EmailLayout>;
}
