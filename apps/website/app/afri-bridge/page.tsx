import type { Metadata } from "next";
export { default } from "../features/afri-bridge/AfriBridgeHomePage";
import { buildMetadata } from "../lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Afri-bridge",
  description:
    "Afri-bridge helps SMEs move from local production to regional trade through practical systems.",
  path: "/afri-bridge",
});
