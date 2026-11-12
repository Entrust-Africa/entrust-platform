import type { Metadata } from "next";
import { buildMetadata } from "../lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Contact Entrust Africa",
  description: "Get in touch about services, partnerships and trade-focused collaboration.",
  path: "/contact",
});

export { default } from "../features/contact/ContactPage";
