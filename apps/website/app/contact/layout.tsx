import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact",
  description: "Contact Entrust Africa across Entrust, Andinet, and Afri-bridge.",
  alternates: { canonical: "/contact" },
  openGraph: {
    title: "Contact — Entrust Africa",
    description: "Contact Entrust Africa across Entrust, Andinet, and Afri-bridge.",
    url: "https://entrustafrica.com/contact",
    type: "website",
    images: [{ url: "/src/assets/entrust-africa-logo.jpeg", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Contact — Entrust Africa",
    description: "Contact Entrust Africa across Entrust, Andinet, and Afri-bridge.",
    images: ["/src/assets/entrust-africa-logo.jpeg"],
  },
};

export default function ContactLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <div className="bg-white">{children}</div>;
}
