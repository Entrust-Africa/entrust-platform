import type { Metadata } from "next";
import { buildMetadata } from "../lib/seo";
import { CommunityPageContent } from "../components/CommunityPageContent";

export const metadata: Metadata = buildMetadata({
  title: "Community — Join Entrust Africa",
  description:
    "Join the Entrust Africa community: events, diaspora networks, and collaboration across the continent.",
  path: "/community",
});

export default function CommunityPage() {
  return <CommunityPageContent />;
}
