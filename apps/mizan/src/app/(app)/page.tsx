import Link from "next/link";
import { currentMizanConfig } from "@entrust/mizan-rules";
import { staffRoleLabel, type MizanAction } from "@entrust/roles";
import { Card, EmptyState } from "@entrust/ui";
import { getMe, getMizanAccess } from "@/lib/api";

const ACTION_LABELS: Record<MizanAction, string> = {
  read_smes: "See the SMEs in MIZAN",
  manage_smes: "Register SMEs, their owners and their data notice",
  manage_support: "Record who trained, advised or onboarded an SME",
  assess: "Assess an SME",
  review: "Approve or return someone else's assessment",
  read_reports: "Read approved reports",
  read_dashboard: "See the dashboard",
  read_audit: "Read the audit trail",
};

export default async function HomePage() {
  const [me, access] = await Promise.all([getMe(), getMizanAccess()]);
  if (!me || !access) return null;
  const cfg = currentMizanConfig();
  const role = access.quality && !access.staffRole ? "Quality" : access.staffRole ? staffRoleLabel(access.staffRole) : null;

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs font-bold tracking-wider text-product-600 uppercase">Africa's SME Financial Readiness Standard</p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink">Welcome, {me.name.split(" ")[0]}</h1>
      </header>

      {access.staff ? (
        <Card className="p-6">
          <h2 className="font-display text-lg font-bold text-ink">What you can do{role ? ` as ${role}` : ""}</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-ink-2">
            {access.actions.map((a) => (
              <li key={a}>{ACTION_LABELS[a]}</li>
            ))}
          </ul>
          {access.actions.includes("review") && (
            <p className="mt-4 text-sm text-ink-3">You can never approve an assessment you did yourself, or one for an SME you trained, advised or onboarded.</p>
          )}
        </Card>
      ) : (
        <section aria-labelledby="reports">
          <h2 id="reports" className="font-display text-lg font-bold text-ink">
            Your reports
          </h2>
          <div className="mt-3 space-y-3">
            {access.reportOrganizations.map((o) => (
              <Card key={o.id} className="p-5">
                <p className="font-semibold text-ink">{o.name}</p>
                <EmptyState className="mt-3" title="No report yet" description="Your MIZAN report appears here once Entrust Africa has completed and approved your assessment." />
              </Card>
            ))}
          </div>
        </section>
      )}

      <Card className="p-6">
        <h2 className="font-display text-lg font-bold text-ink">The standard in use</h2>
        <p className="mt-2 text-sm text-ink-2">
          {cfg.methodology}, configuration <span className="font-mono">{cfg.version}</span>, in use since {cfg.effectiveFrom}.
        </p>
        <p className="mt-2 text-sm text-ink-3">{cfg.status}</p>
        <Link href="/methodology" className="mt-4 inline-block text-sm font-semibold text-product-600 underline-offset-4 hover:underline">
          See how MIZAN scores a business
        </Link>
      </Card>
    </div>
  );
}
