import type { Metadata } from "next";
import Gateway from "./features/gateway/GatewayPage";
import { buildMetadata } from "./lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Entrust Africa — Your Entry Point to African Trade",
  description:
    "Choose your platform: Entrust, Andinet, or Afri-bridge—building businesses and trade across Africa.",
  path: "/",
});

export default function Page() {
  return <Gateway />;
}
