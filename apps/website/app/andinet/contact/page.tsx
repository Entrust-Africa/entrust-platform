import type { Metadata } from "next";
import CommonContactPage from "../../shared/ui/CommonContact";
import { buildMetadata } from "../../lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Contact",
  description:
    "Contact Andinet for event partnerships, programs, and cross-border business opportunities.",
  path: "/andinet/contact",
});

export default function AndinetContactPage() {
  return (
    <CommonContactPage
      headline="Contact Us"
      description="Reach our team for partnerships, programs, and event opportunities across Africa."
    />
  );
}
