import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getMe } from "@/lib/api";
import { Simulator } from "./simulator";

export const metadata = {
  title: "Simulator",
  description: "One export order played through CLEAR's steps, from the purchase order to the closed case.",
};

export default async function SimulationPage() {
  const me = await getMe();
  if (!me) redirect("/sign-in");
  // For Entrust staff until the simulated corridor has a rule pack: see the note under the page.
  if (!me.staffRole) redirect("/");

  return (
    <Suspense>
      <Simulator />
    </Suspense>
  );
}
