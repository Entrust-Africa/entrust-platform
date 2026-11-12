import type { Metadata } from "next";
import { buildMetadata } from "../lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Entrust: strategy and execution for African growth",
  description:
    "A strategy and execution firm working with SMEs, financial institutions and investors across African markets. Advisory and Andinet trade forums.",
  path: "/entrust",
});

export { default } from "../features/entrust/EntrustPage";
