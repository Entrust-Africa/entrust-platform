import { redirect } from "next/navigation";
import { getMe } from "@/lib/api";
import { SimulationView } from "./simulation-view";

export const metadata = {
  title: "Export Process Simulation — CLEAR Export",
  description: "End-to-end simulation of Purchase Order US-2026-0048 through the 7-phase CLEAR export protocol.",
};

export default async function SimulationPage() {
  const me = await getMe();
  if (!me) {
    redirect("/sign-in");
  }

  return <SimulationView />;
}
