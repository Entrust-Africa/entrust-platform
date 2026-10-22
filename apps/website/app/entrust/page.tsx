import type { Metadata } from "next";
export { default } from "../features/entrust/EntrustHomePage";
import { buildMetadata } from "../lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Entrust",
  description:
    "Building structured businesses across Africa through advisory, execution, and growth support.",
  path: "/entrust",
});
