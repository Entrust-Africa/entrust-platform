import type { Metadata } from "next";
import { buildMetadata } from "../lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "CLEAR Export: your export cases, step by step",
  description:
    "Track every permit, document and deadline from first order to the final foreign exchange settlement.",
  path: "/clear-export",
});

export { default } from "../features/clear-export/ClearExportPage";
