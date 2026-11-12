import type { Metadata } from "next";
import { buildMetadata } from "./lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Entrust Africa: take your business across African borders",
  description:
    "Entrust Africa helps SMEs prepare for export, stay compliant, find buyers and close cross-border deals.",
  path: "/",
});

export { default } from "./features/home/HomePage";
