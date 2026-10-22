import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    default: "Entrust",
    template: "%s | Entrust — Entrust Africa",
  },
  description:
    "Strategy and execution for SMEs, financial institutions, and investors across African markets.",
  alternates: { canonical: "/entrust" },
  openGraph: {
    title: "Entrust — Entrust Africa",
    description:
      "Strategy and execution for SMEs, financial institutions, and investors across African markets.",
    url: "https://entrustafrica.com/entrust",
    type: "website",
    images: [{ url: "/src/assets/entrust-africa-logo.jpeg", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Entrust — Entrust Africa",
    description:
      "Strategy and execution for SMEs, financial institutions, and investors across African markets.",
    images: ["/src/assets/entrust-africa-logo.jpeg"],
  },
};

export default function EntrustLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="platform-page theme-entrust min-h-screen bg-white">
      {children}
      {/* Partner logo video section remains intact */}
      <div className="partner-logo-video">
        {/* Add partner logo video here */}
      </div>
    </div>
  );
}
