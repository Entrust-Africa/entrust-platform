import type { Metadata } from "next";
export { default } from "../../features/entrust/EntrustExperiencePage";
import { buildMetadata } from "../../lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Experience",
  description:
    "See Entrust Africa experience, project highlights, sectors served, and measurable outcomes.",
  path: "/entrust/experience",
});
