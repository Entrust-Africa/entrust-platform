import * as React from "react";
import { EmailButton, EmailLayout, EmailParagraph } from "./layout";

export function SummitResultEmail({ applicationNumber, organizationName, message, url }: { applicationNumber: string; organizationName: string; message: string; url?: string }) {
  return <EmailLayout preview={`The result of Summit application ${applicationNumber}`} title="Your Summit application result"><EmailParagraph>The selection committee has decided on the Summit application {applicationNumber} for <strong>{organizationName}</strong>.</EmailParagraph><EmailParagraph>{message}</EmailParagraph>{url ? <EmailButton href={url}>View your application</EmailButton> : <EmailParagraph>Sign in to view your application.</EmailParagraph>}</EmailLayout>;
}
