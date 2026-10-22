import type { Metadata } from "next";
import CommonContactPage from "../../shared/ui/CommonContact";
import { buildMetadata } from "../../lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Contact",
  description: "Contact Entrust Africa for advisory, partnerships, and business support.",
  path: "/entrust/contact",
});

export default function EntrustContactPage() {
  return <CommonContactPage headline="Contact Entrust Africa" />;
}
