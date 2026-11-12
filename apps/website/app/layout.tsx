import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import AnalyticsWrapper from "./AnalyticsWrapper";
import { MOTION_FALLBACK_SCRIPT } from "./components/motion/fallbackScript";
import { MotionProvider } from "./components/motion/MotionProvider";
import { SiteFooter } from "./components/site/SiteFooter";
import { SiteHeader } from "./components/site/SiteHeader";
import { CONTACT } from "./lib/site";
import "./globals.css";

const SITE_URL = "https://entrustafrica.com";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Entrust Africa: take your business across African borders",
    template: "%s · Entrust Africa",
  },
  description:
    "Entrust Africa helps SMEs prepare for export, stay compliant, find buyers and close cross-border deals.",
  openGraph: {
    siteName: "Entrust Africa",
    type: "website",
  },
  twitter: { card: "summary_large_image" },
  robots: { index: true, follow: true },
  icons: { icon: [{ url: "/logo.png", sizes: "any" }], shortcut: "/logo.png", apple: "/logo.png" },
};

export const viewport: Viewport = {
  themeColor: "#f5f8f6",
};

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Entrust Africa",
  url: SITE_URL,
  logo: `${SITE_URL}/logo.png`,
  contactPoint: [
    {
      "@type": "ContactPoint",
      contactType: "customer support",
      email: CONTACT.email,
      telephone: CONTACT.phone,
      availableLanguage: ["English"],
    },
  ],
  sameAs: [CONTACT.linkedIn],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth" className={`${inter.variable} antialiased`}>
      <head>
        <noscript>
          <style>{`main [style*="opacity"],main [style*="transform"],main [style*="clip-path"]{opacity:1!important;transform:none!important;clip-path:none!important}`}</style>
        </noscript>
        <script dangerouslySetInnerHTML={{ __html: MOTION_FALLBACK_SCRIPT }} />
      </head>
      <body className="flex min-h-dvh flex-col bg-page text-ink">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
        <a
          href="#main"
          className="fixed left-4 top-4 z-[60] -translate-y-24 rounded-md bg-brand px-4 py-2 font-semibold text-white transition-transform focus:translate-y-0"
        >
          Skip to content
        </a>
        <MotionProvider>
          <SiteHeader />
          <main id="main" className="flex-1 pt-14 md:pt-16">
            {children}
          </main>
          <SiteFooter />
        </MotionProvider>
        {process.env.NODE_ENV === "production" && <AnalyticsWrapper />}
      </body>
    </html>
  );
}
