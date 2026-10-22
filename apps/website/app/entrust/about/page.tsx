import type { Metadata } from "next";
export { default } from "../../features/entrust/EntrustAboutPage";
import { buildMetadata } from "../../lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "About",
  description:
    "Learn about Entrust Africa, its mission, and leadership supporting business growth across Africa.",
  path: "/entrust/about",
});
