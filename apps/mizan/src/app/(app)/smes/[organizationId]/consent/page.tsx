import { notFound } from "next/navigation";
import { Card, StatusBadge } from "@entrust/ui";
import { serverApi } from "@/lib/api";
import { OpenFile, RecordAcceptance, RecordWithdrawal, SmeDecision } from "./consent-forms";

export const metadata = { title: "Consent" };

const KIND_LABELS = {
  assessment_notice: { title: "Assessment notice", need: "Required before an assessment can start, be submitted or be approved." },
  platform_data: { title: "TRADE and CLEAR data", need: "Optional. Needed before an assessor uses the SME's TRADE or CLEAR records." },
} as const;

const METHOD_LABELS = { in_platform: "In MIZAN", paper: "On paper", trade: "In TRADE" } as const;

const date = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/**
 * The SME's Consent tab (#227): whether the assessment notice and the data permission are in force, the wording, and every
 * acceptance and withdrawal. The SME page (#225) links here as its Consent tab.
 */
export default async function ConsentPage({ params }: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await params;
  const res = await (await serverApi()).v1.mizan.smes[":organizationId"].consents.$get({ param: { organizationId } });
  if (res.status === 404) notFound();
  if (!res.ok) throw new Error(`Couldn't load the SME's consent (${res.status}).`);
  const view = await res.json();

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs font-bold tracking-wider text-product-600 uppercase">
          Consent · <span className="font-mono">{view.smeId}</span>
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink">{view.legalName}</h1>
        <p className="mt-2 max-w-2xl text-sm text-ink-2">
          The latest record of each is the one in force. Withdrawing stops future use: an open assessment can't be submitted or approved while the
          notice is withdrawn, and work already done is kept. Reports already issued are never changed.
        </p>
      </header>

      {view.kinds.map(({ kind, inForce, latest, notice }) => {
        const labels = KIND_LABELS[kind];
        return (
          <Card key={kind} className="space-y-4 p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-lg font-bold text-ink">{labels.title}</h2>
              <StatusBadge tone={inForce ? "ok" : latest ? "warn" : "idle"}>{inForce ? "In force" : latest ? "Withdrawn" : "Not accepted"}</StatusBadge>
            </div>
            <p className="text-sm text-ink-3">{labels.need}</p>
            {latest && (
              <p className="text-sm text-ink-2">
                {latest.accepted ? "Accepted" : "Withdrawn"} by <span className="font-semibold text-ink">{latest.signatoryName}</span>
                {latest.signatoryRole ? ` (${latest.signatoryRole})` : ""} {METHOD_LABELS[latest.method].toLowerCase()} on {date(latest.givenAt)}, notice
                version {latest.noticeVersion}
                {latest.sourceRef ? `, TRADE reference ${latest.sourceRef}` : ""}.
              </p>
            )}

            <details className="rounded-sm border border-line bg-surface-2 p-4">
              <summary className="cursor-pointer text-sm font-semibold text-ink">
                {notice.title} <span className="font-normal text-ink-3">(version {notice.version})</span>
              </summary>
              <div className="mt-3 space-y-2 text-sm whitespace-pre-line text-ink-2">{notice.body}</div>
            </details>

            {view.canAccept && <SmeDecision organizationId={organizationId} kind={kind} inForce={inForce} businessName={view.legalName} />}

            {view.canRecord && (
              <details className="rounded-sm border border-line p-4">
                <summary className="cursor-pointer text-sm font-semibold text-ink">{inForce ? "Record a withdrawal" : "Record an acceptance"}</summary>
                <div className="mt-4">
                  {inForce ? (
                    <RecordWithdrawal organizationId={organizationId} kind={kind} />
                  ) : (
                    <RecordAcceptance organizationId={organizationId} kind={kind} currentVersion={notice.version} />
                  )}
                </div>
              </details>
            )}
          </Card>
        );
      })}

      <section aria-labelledby="history" className="space-y-3">
        <h2 id="history" className="font-display text-lg font-bold text-ink">
          History
        </h2>
        {view.history.length === 0 ? (
          <p className="text-sm text-ink-3">Nothing recorded yet.</p>
        ) : (
          <Card className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead className="border-b border-line text-xs tracking-wide text-ink-3 uppercase">
                <tr>
                  <th className="px-4 py-3 font-semibold">Date</th>
                  <th className="px-4 py-3 font-semibold">What</th>
                  <th className="px-4 py-3 font-semibold">For the SME</th>
                  <th className="px-4 py-3 font-semibold">How</th>
                  <th className="px-4 py-3 font-semibold">Recorded by</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {view.history.map((h) => (
                  <tr key={h.id} className="align-top">
                    <td className="px-4 py-3 whitespace-nowrap text-ink-2">{date(h.givenAt)}</td>
                    <td className="px-4 py-3 text-ink">
                      {h.accepted ? "Accepted" : "Withdrew"} {KIND_LABELS[h.kind].title.toLowerCase()}
                      <span className="block text-xs text-ink-3">Version {h.noticeVersion}</span>
                    </td>
                    <td className="px-4 py-3 text-ink-2">
                      {h.signatoryName}
                      {h.signatoryRole && <span className="block text-xs text-ink-3">{h.signatoryRole}</span>}
                    </td>
                    <td className="px-4 py-3 text-ink-2">
                      {METHOD_LABELS[h.method]}
                      {h.sourceRef && <span className="block text-xs text-ink-3">{h.sourceRef}</span>}
                      {h.fileId && (
                        <span className="block text-xs">
                          <OpenFile fileId={h.fileId}>{h.accepted ? "Signed notice" : "Their letter"}</OpenFile>
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-ink-2">
                      {h.capturedBy ?? "Unknown"}
                      <span className="block text-xs text-ink-3">{date(h.capturedAt)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </section>
    </div>
  );
}
