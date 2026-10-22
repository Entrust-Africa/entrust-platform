import type { Metadata } from "next";
export { default } from "../features/andinet/AndinetHomePage";
import { buildMetadata } from "../lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Andinet",
  description:
    "Andinet connects African businesses, investors, and institutions through curated engagements.",
  path: "/andinet",
});
