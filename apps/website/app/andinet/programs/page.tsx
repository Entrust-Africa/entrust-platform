import type { Metadata } from "next";
export { default } from "../../features/andinet/AndinetProgramsPage";
import { buildMetadata } from "../../lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Programs",
  description:
    "Explore Andinet programs that support trade connections and practical cross-border growth.",
  path: "/andinet/programs",
});
