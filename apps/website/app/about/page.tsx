import type { Metadata } from "next";
import { buildMetadata } from "../lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "About and leadership",
  description:
    "A strategy and execution firm working with SMEs, financial institutions and investors across African markets. Meet our mission, vision and leadership.",
  path: "/about",
});

export { default } from "../features/about/AboutPage";
