import { Body, Container, Head, Heading, Html, Link, Preview, Section, Text } from "@react-email/components";
import { emailTheme } from "@entrust/ui";
import type { ReactNode } from "react";

export const { colors } = emailTheme;

export function EmailLayout({ preview, title, children }: { preview: string; title: string; children: ReactNode }) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ backgroundColor: colors.canvas, color: colors.ink, fontFamily: emailTheme.fonts.body, margin: 0, padding: "32px 0" }}>
        <Container style={{ backgroundColor: "#ffffff", border: `1px solid ${colors.line}`, borderRadius: "10px", margin: "0 auto", maxWidth: "560px", padding: "40px" }}>
          <Section>
            <Text style={{ color: colors.brand, fontFamily: emailTheme.fonts.display, fontSize: "14px", fontWeight: 700, letterSpacing: "0.12em", margin: "0 0 28px", textTransform: "uppercase" }}>Entrust Africa</Text>
            <Heading as="h1" style={{ color: colors.ink, fontFamily: emailTheme.fonts.display, fontSize: "28px", lineHeight: 1.2, margin: "0 0 18px" }}>{title}</Heading>
            {children}
            <Text style={{ borderTop: `1px solid ${colors.line}`, color: colors.muted, fontSize: "12px", lineHeight: 1.5, margin: "32px 0 0", paddingTop: "20px" }}>
              Entrust Africa · Building trusted digital pathways for African businesses.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export function EmailParagraph({ children }: { children: ReactNode }) {
  return <Text style={{ color: colors.muted, fontSize: "16px", lineHeight: 1.6, margin: "0 0 18px" }}>{children}</Text>;
}

export function EmailButton({ href, children }: { href: string; children: ReactNode }) {
  return <Link href={href} style={{ backgroundColor: colors.brandDark, borderRadius: "6px", color: "#ffffff", display: "inline-block", fontFamily: emailTheme.fonts.display, fontSize: "14px", fontWeight: 700, padding: "13px 20px", textDecoration: "none" }}>{children}</Link>;
}
