import type { Metadata } from "next";
export { default } from "../../features/entrust/EntrustServicesPage";
import { buildMetadata } from "../../lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Services",
  description:
    "Explore Entrust services in business structuring, SME growth support, and strategic advisory.",
  path: "/entrust/services",
});
