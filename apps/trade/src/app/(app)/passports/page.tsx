import { PASSPORT_CHECKS } from "@entrust/trade-engine";
import { Card } from "@entrust/ui";
import { PassportManager } from "@/components/passport/passport-manager";
import type { PassportListItem } from "@/lib/passport";
import { requireUser } from "@/lib/summit-server";
import { tradeGet } from "@/lib/trade-api";

export const metadata = { title: "Verified SME passports" };

export default async function PassportsPage() {
  const me = await requireUser("/passports");
  if (me.staffRole !== "admin" && me.staffRole !== "facilitator") {
    return (
      <div className="mx-auto max-w-xl py-12">
        <Card className="p-8 text-center">
          <h1 className="font-display text-2xl font-bold text-ink">This page is for Entrust staff</h1>
          <p className="mt-3 text-sm text-ink-2">Passports are issued by Entrust administrators and shown to the public by their QR code.</p>
        </Card>
      </div>
    );
  }
  const list = await tradeGet<{ items: PassportListItem[] }>("/passports");
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">Verified SME passports</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-2">
          Each passport has a public page, the one its QR code opens. It shows only what you save here. Enter a business&apos;s SME ID to issue or change its passport; only an administrator can save.
        </p>
      </div>
      <PassportManager items={list.data?.items ?? []} canIssue={me.staffRole === "admin"} checks={[...PASSPORT_CHECKS]} loadError={list.error} />
    </div>
  );
}
