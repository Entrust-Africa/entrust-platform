import type { Metadata } from "next";
export { default } from "../../features/andinet/AndinetAboutPage";
import { buildMetadata } from "../../lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "About",
  description:
    "Learn about Andinet's mission to create cross-border partnerships and trade opportunities.",
  path: "/andinet/about",
});
