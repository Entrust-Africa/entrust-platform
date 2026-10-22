import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    default: "Afri-bridge",
    template: "%s | Afri-bridge — Entrust Africa",
  },
  description:
    "Trade readiness and market access for SMEs expanding from local production to regional trade across Africa.",
  alternates: { canonical: "/afri-bridge" },
  openGraph: {
    title: "Afri-bridge — Entrust Africa",
    description:
      "Trade readiness and market access for SMEs expanding from local production to regional trade across Africa.",
    url: "https://entrustafrica.com/afri-bridge",
    type: "website",
    images: [{ url: "/src/assets/entrust-africa-logo.jpeg", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Afri-bridge — Entrust Africa",
    description:
      "Trade readiness and market access for SMEs expanding from local production to regional trade across Africa.",
    images: ["/src/assets/entrust-africa-logo.jpeg"],
  },
};

export default function AfriBridgeLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="platform-page theme-afri min-h-screen bg-[#f8fafc]">
      {/* Afri-bridge-specific navigation/header can be added here if needed */}
      {children}
      {/* Partner logo video section remains intact */}
      <div className="partner-logo-video">
        {/* Add partner logo video here */}
      </div>
    </div>
  );
}
