import { Card, StatusBadge } from "@entrust/ui";
import { formatDate } from "@/lib/summit";
import type { Sharing } from "@/lib/summit-staff";
import { DownloadButton } from "./download-button";

/** The one-page profile of a selected business: Entrust's own copy, and the copy for buyers and investors while the owner agrees. */
export function ProfileCard({ applicationId, sharing, canMakeExternal }: { applicationId: string; sharing: Sharing; canMakeExternal: boolean }) {
  const base = `/v1/summit/applications/${applicationId}/profile`;
  return (
    <Card className="space-y-3 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg font-bold text-ink">One-page profile</h2>
        <StatusBadge tone={sharing.shared ? "ok" : "idle"}>{sharing.shared ? "Business agrees to share" : "Not shared outside Entrust"}</StatusBadge>
      </div>
      <p className="text-sm text-ink-2">What the business told us and what it is looking for, with no score, finding or note of ours. Every copy is logged.</p>
      <div className="flex flex-wrap items-start gap-3">
        <DownloadButton path={`${base}?copy=internal`} fallbackName="summit-profile.pdf">
          Internal copy
        </DownloadButton>
        {canMakeExternal && (
          <DownloadButton path={`${base}?copy=external`} fallbackName="summit-profile-external.pdf" variant="primary" disabled={!sharing.shared}>
            Copy for buyers and investors
          </DownloadButton>
        )}
      </div>
      {canMakeExternal && !sharing.shared && <p className="text-xs text-ink-3">The business's owner hasn't agreed to share its profile outside Entrust, or has taken the agreement back, so no outside copy can be made.</p>}
      {sharing.shared && sharing.grantedAt && <p className="text-xs text-ink-3">The owner agreed on {formatDate(sharing.grantedAt)}. They can take it back at any time, and the next copy is then refused.</p>}
    </Card>
  );
}
