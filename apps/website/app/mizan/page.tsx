import type { Metadata } from "next";
import { buildMetadata } from "../lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "MIZAN: Africa’s SME Financial Readiness Standard",
  description:
    "MIZAN assesses how ready a business is to approach lenders, and gives the SME a report and an improvement plan of its own.",
  path: "/mizan",
});

export { default } from "../features/mizan/MizanPage";
