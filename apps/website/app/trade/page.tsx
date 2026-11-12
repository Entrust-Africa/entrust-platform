import type { Metadata } from "next";
import { buildMetadata } from "../lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "The TRADE Program: from local operations to export-ready",
  description:
    "Training for Regional Access and Development through Exports. Practical training, structured assessment, system setup and direct market alignment.",
  path: "/trade",
});

export { default } from "../features/trade/TradePage";
