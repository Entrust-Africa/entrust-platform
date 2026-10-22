import type { Metadata } from "next";
import CommonContactPage from "../../shared/ui/CommonContact";
import { buildMetadata } from "../../lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Contact",
  description:
    "Contact Afri-bridge to discuss trade readiness, market access, and cross-border growth support.",
  path: "/afri-bridge/contact",
});

export default function AfriBridgeContactPage() {
  return <CommonContactPage headline="Contact Afri-Bridge Africa" />;
}
