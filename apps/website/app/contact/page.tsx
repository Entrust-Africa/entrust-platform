import type { Metadata } from "next";
import CommonContactPage from "../shared/ui/CommonContact";
import { buildMetadata } from "../lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Contact",
  description:
    "Get in touch with Entrust Africa for services, partnerships, and trade-focused collaboration.",
  path: "/contact",
});

export default function Page() {
  return <CommonContactPage />;
}
