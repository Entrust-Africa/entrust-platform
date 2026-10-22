import type { Metadata } from "next";
import { buildMetadata } from "../../lib/seo";
import { CommunityPageContent } from "../../components/CommunityPageContent";

export const metadata: Metadata = buildMetadata({
  title: "Community — Andinet",
  description: "Join the Andinet community through Entrust Africa.",
  path: "/andinet/community",
});

export default function AndinetCommunityPage() {
  return <CommunityPageContent />;
}
