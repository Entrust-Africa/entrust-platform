import { redirect } from "next/navigation";
import { Card } from "@entrust/ui";
import { getMe } from "@/lib/api";
import { tradeGet } from "@/lib/trade-api";
import { SponsorAdmin, type Sponsor } from "./sponsor-admin";

export const metadata = { title: "Sponsor banks" };

/** Entrust administrators set up the banks that sponsor cohorts, and the people at each bank who read its reports. */
export default async function SponsorsPage() {
  const me = await getMe();
  if (!me) redirect("/sign-in");
  if (me.staffRole !== "admin") {
    return (
      <div className="mx-auto max-w-xl py-12">
        <Card className="p-8 text-center">
          <h1 className="font-display text-xl font-bold text-ink">Sponsor banks</h1>
          <p className="mt-3 text-sm text-ink-2">An Entrust administrator sets up sponsor banks and their people.</p>
        </Card>
      </div>
    );
  }
  const sponsors = await tradeGet<{ items: Sponsor[] }>("/sponsors");
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">Sponsor banks</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-2">
          A sponsor bank reads the reports of the cohorts it sponsors, and only what each business has agreed to share. Set one up here, add the people
          who sign in for it, then name it on a cohort (on the cohort&apos;s page, under Edit cohort).
        </p>
      </div>
      <SponsorAdmin initial={sponsors.data?.items ?? []} />
    </div>
  );
}
