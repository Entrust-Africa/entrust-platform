import type { Metadata } from "next";
import { buildMetadata } from "../lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Join the Entrust Africa community",
  description:
    "Stay connected to African professionals, entrepreneurs and diaspora communities: event updates, partnership opportunities and ways to collaborate.",
  path: "/community",
});

export { default } from "../features/community/CommunityPage";
