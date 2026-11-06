"use client";

import { Button, Card, StatusBadge } from "@entrust/ui";
import { formatDate } from "@/lib/summit";
import { browserApi, ok } from "@/lib/summit-api";
import type { Sharing } from "@/lib/summit-staff";
import { Outcome, useAction } from "@/components/summit/staff/use-action";

/** Shown to a selected business. Its owner decides whether Entrust may share its profile with buyers and investors, and can take it back. */
export function SharingCard({ applicationId, sharing }: { applicationId: string; sharing: Sharing }) {
  const change = useAction();
  return (
    <Card className="space-y-3 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg font-bold text-ink">Share your profile with buyers and investors</h2>
        <StatusBadge tone={sharing.shared ? "ok" : "idle"}>{sharing.shared ? "Sharing" : "Not sharing"}</StatusBadge>
      </div>
      <p className="text-base text-ink-2">
        To prepare your business meetings we make a one-page profile of your business. By default it stays with Entrust. If you agree, we may give it to the buyers, investors and partners we introduce you to.
      </p>
      <blockquote className="border-l-4 border-line-strong pl-3 text-sm italic text-ink-2">{sharing.wording}</blockquote>
      {sharing.shared && sharing.grantedAt && <p className="text-sm text-ink-3">You agreed on {formatDate(sharing.grantedAt)}.</p>}
      {sharing.canChange ? (
        <div className="space-y-2">
          <Button
            variant={sharing.shared ? "secondary" : "primary"}
            loading={change.busy}
            onClick={() => change.run(() => ok(browserApi().v1.summit.applications[":id"].sharing.$put({ param: { id: applicationId }, json: { share: !sharing.shared } })), sharing.shared ? "We have stopped sharing your profile." : "Thank you. We may now share your profile.")}
          >
            {sharing.shared ? "Stop sharing my profile" : "Yes, you may share my profile"}
          </Button>
          <Outcome error={change.error} done={change.done} />
        </div>
      ) : (
        <p className="text-sm text-ink-3">Only the owner of your business can change this.</p>
      )}
    </Card>
  );
}
