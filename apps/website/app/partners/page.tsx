import type { Metadata } from "next";
import { buildMetadata } from "../lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Partners",
  description:
    "We align embassies, financial institutions, development partners and private sector buyers around SMEs that are ready to trade.",
  path: "/partners",
});

export { default } from "../features/partners/PartnersPage";
