import type { Metadata } from "next";
export { default } from "../../features/andinet/AndinetEventsPage";
import { buildMetadata } from "../../lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Events",
  description:
    "Discover Andinet events and forums designed to connect African businesses and institutions.",
  path: "/andinet/events",
});
