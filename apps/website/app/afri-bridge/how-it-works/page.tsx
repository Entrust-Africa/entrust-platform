import type { Metadata } from "next";
export { default } from "../../features/afri-bridge/AfriBridgeHowItWorksPage";
import { buildMetadata } from "../../lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "How It Works",
  description:
    "Understand Afri-bridge's roadmap and TRADE program for export readiness and market access.",
  path: "/afri-bridge/how-it-works",
});
