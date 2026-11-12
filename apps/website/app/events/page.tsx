import type { Metadata } from "next";
import { buildMetadata } from "../lib/seo";

/** Upcoming events come from Sanity; refresh the page at most once an hour. */
export const revalidate = 3600;

export const metadata: Metadata = buildMetadata({
  title: "Events",
  description:
    "Andinet forums bring public and private sector actors together and push conversations toward execution. See past forums and get notified about the next one.",
  path: "/events",
});

export { default } from "../features/events/EventsPage";
