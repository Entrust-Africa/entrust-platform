import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    default: "Andinet",
    template: "%s | Andinet — Entrust Africa",
  },
  description:
    "Connecting African businesses, investors, and institutions through curated events and engagements.",
  alternates: { canonical: "/andinet" },
  openGraph: {
    title: "Andinet — Entrust Africa",
    description:
      "Connecting African businesses, investors, and institutions through curated events and engagements.",
    url: "https://entrustafrica.com/andinet",
    type: "website",
    images: [{ url: "/src/assets/entrust-africa-logo.jpeg", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Andinet — Entrust Africa",
    description:
      "Connecting African businesses, investors, and institutions through curated events and engagements.",
    images: ["/src/assets/entrust-africa-logo.jpeg"],
  },
};

export default function AndinetLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="platform-page theme-andinet min-h-screen bg-[#fafafd]">
      {/* Andinet-specific navigation/header can be added here if needed */}
      {children}
    </div>
  );
}
