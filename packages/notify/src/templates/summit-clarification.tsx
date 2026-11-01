import * as React from "react";
import { EmailButton, EmailLayout, EmailParagraph } from "./layout";

export function SummitClarificationEmail({ applicationNumber, organizationName, message, url }: { applicationNumber: string; organizationName: string; message: string; url?: string }) {
  return <EmailLayout preview={`More information is needed for ${applicationNumber}`} title="We need a little more information"><EmailParagraph>The assessment team reviewing the Summit application {applicationNumber} for <strong>{organizationName}</strong> has asked:</EmailParagraph><EmailParagraph>{message}</EmailParagraph>{url ? <EmailButton href={url}>Answer the request</EmailButton> : <EmailParagraph>Sign in to answer the request.</EmailParagraph>}<EmailParagraph>Your application stays on hold until you reply.</EmailParagraph></EmailLayout>;
}
