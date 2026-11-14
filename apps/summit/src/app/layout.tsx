import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

// The font files are in the repo (packages/ui/fonts), not fetched from Google at build time: that fetch failed builds.
const anton = localFont({ src: "../../../../packages/ui/fonts/anton-latin-400-normal.woff2", weight: "400", variable: "--font-anton" });
const inter = localFont({ src: "../../../../packages/ui/fonts/inter-latin-wght-normal.woff2", weight: "100 900", variable: "--font-inter" });
const mono = localFont({ src: "../../../../packages/ui/fonts/jetbrains-mono-latin-wght-normal.woff2", weight: "100 800", variable: "--font-jetbrains-mono" });

export const metadata: Metadata = {
  title: "Africa Diaspora Trade & Investment Summit 2027 · Addis Ababa, Ethiopia",
  description:
    "Connecting Africa and its global diaspora through trade, investment and business partnerships. Three days in Addis Ababa, January 2027 (dates to be announced).",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${anton.variable} ${inter.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
