import AnalyticsWrapper from "./AnalyticsWrapper";
import type { Metadata, Viewport } from "next";
import { Montserrat, Open_Sans } from "next/font/google";
import "./globals.css";
import OurPartners from "./shared/ui/OurPartners";
import Footer from "./shared/ui/Footer";
import EcosystemNav from "./shared/ui/EcosystemNav";
import { SiteAssistant } from "./components/SiteAssistant";

const SITE_URL = "https://entrustafrica.com";
const SHARE_IMAGE = "/src/assets/entrust-africa-logo.jpeg";

const montserrat = Montserrat({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
});

const openSans = Open_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Entrust Africa",
  description: "...",
  openGraph: {
    title: "Entrust Africa",
    description: "...",
    images: [
      {
        url: SHARE_IMAGE,
        width: 1200,
        height: 630,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    images: [SHARE_IMAGE],
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: [
      { url: "/logo.png", sizes: "any" },
    ],
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Entrust Africa",
    url: "https://entrustafrica.com",
    logo: "https://entrustafrica.com/src/assets/entrust-africa-logo.jpeg",
    contactPoint: [
      {
        "@type": "ContactPoint",
        contactType: "customer support",
        email: "thomas@entrustafrica.com",
        availableLanguage: ["English"],
      },
    ],
    sameAs: [
      "https://www.linkedin.com/company/entrust-plc/",
      "https://www.linkedin.com/company/andinet-umoja-connecting-african-businesses/",
    ],
  };

  // Hide EcosystemNav on GatewayHome ("/GatwayHome")
  const isGatewayHome = typeof window !== 'undefined' && window.location.pathname === '/GatwayHome';
  return (
    <html
      lang="en"
      className={`${montserrat.variable} ${openSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-white font-[family-name:var(--font-body)] text-[color:var(--foreground)] text-base leading-relaxed antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
        {!isGatewayHome && <EcosystemNav />}
        <div className="flex-1">{children}</div>
        <OurPartners />
        <Footer />
        {/* Google Analytics - replace G-XXXXXXXXXX with your Measurement ID */}
        {process.env.NODE_ENV === "production" && <AnalyticsWrapper />}
        {/* <SiteAssistant /> */}
      </body>
    </html>
  );
}
