import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

// The font files are in the repo (packages/ui/fonts), not fetched from Google at build time: that fetch failed builds.
const montserrat = localFont({ src: "../../../../packages/ui/fonts/montserrat-latin-wght-normal.woff2", weight: "100 900", variable: "--font-montserrat" });
const openSans = localFont({ src: "../../../../packages/ui/fonts/open-sans-latin-wght-normal.woff2", weight: "300 800", variable: "--font-open-sans" });
const ethiopic = localFont({ src: "../../../../packages/ui/fonts/noto-sans-ethiopic-ethiopic-wght-normal.woff2", weight: "100 900", variable: "--font-ethiopic" });
const mono = localFont({ src: "../../../../packages/ui/fonts/jetbrains-mono-latin-wght-normal.woff2", weight: "100 800", variable: "--font-jetbrains-mono" });

export const metadata: Metadata = {
  title: { default: "TRADE", template: "%s · TRADE" },
  description: "Export capability and learning platform for African SMEs, by Entrust Africa.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${montserrat.variable} ${openSans.variable} ${ethiopic.variable} ${mono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
