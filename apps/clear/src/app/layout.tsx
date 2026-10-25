import type { Metadata } from "next";
import { JetBrains_Mono, Montserrat, Noto_Sans_Ethiopic, Open_Sans } from "next/font/google";
import "./globals.css";

const montserrat = Montserrat({ subsets: ["latin"], weight: ["600", "700", "800"], variable: "--font-montserrat" });
const openSans = Open_Sans({ subsets: ["latin"], variable: "--font-open-sans" });
const ethiopic = Noto_Sans_Ethiopic({ subsets: ["ethiopic"], variable: "--font-ethiopic" });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-jetbrains-mono" });

export const metadata: Metadata = {
  title: { default: "CLEAR Export", template: "%s · CLEAR Export" },
  description: "Export compliance workflow for Ethiopian SMEs, by Entrust Africa.",
  icons: { icon: "/logo.jpg" },
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
