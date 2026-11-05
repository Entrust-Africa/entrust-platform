import { Section, Text } from "@react-email/components";
import * as React from "react";
import { EmailButton, EmailLayout, EmailParagraph, colors } from "./layout";

/**
 * A message about the Summit's bookings, sponsorship, delegates or payments. The sender writes the words (a heading, a
 * greeting, paragraphs), and may add rows of details such as a reference and an amount, and one button.
 */
export function SummitNoticeEmail({
  heading,
  greeting,
  paragraphs,
  details = [],
  action,
}: {
  heading: string;
  greeting: string;
  paragraphs: string[];
  details?: { label: string; value: string }[];
  action?: { label: string; url: string };
}) {
  return (
    <EmailLayout preview={heading} title={heading}>
      <EmailParagraph>{greeting}</EmailParagraph>
      {paragraphs.map((text, i) => (
        <EmailParagraph key={i}>{text}</EmailParagraph>
      ))}
      {details.length > 0 && (
        <Section style={{ border: `1px solid ${colors.line}`, borderRadius: "8px", margin: "0 0 20px", padding: "14px 18px" }}>
          {details.map((row) => (
            <Text key={row.label} style={{ color: colors.ink, fontSize: "15px", lineHeight: 1.5, margin: "4px 0" }}>
              <span style={{ color: colors.muted }}>{row.label}: </span>
              <strong>{row.value}</strong>
            </Text>
          ))}
        </Section>
      )}
      {action && <EmailButton href={action.url}>{action.label}</EmailButton>}
    </EmailLayout>
  );
}
