import Link from "next/link";
import { redirect } from "next/navigation";
import { Award, CheckCircle2, Download, Printer, ShieldAlert, ArrowLeft } from "lucide-react";
import { afriConnectBuyersUrl } from "@entrust/auth/africonnect";
import { AfriConnectCard, Button, Card, StatusBadge } from "@entrust/ui";
import { getMe, listEnrollments } from "@/lib/api";
import { tradeGet } from "@/lib/trade-api";
import type { CertificateView } from "@/lib/types";

export const metadata = { title: "Certificate of Completion" };

export default async function CertificatePage() {
  const me = await getMe();
  if (!me) redirect("/sign-in");

  const activeOrg =
    me.organizations?.find((o) => o.id === me.activeOrganizationId) ?? me.organizations?.[0];

  const enrollments = activeOrg ? await listEnrollments({ organizationId: activeOrg.id }) : [];
  const currentEnrollment = enrollments[0];

  if (!currentEnrollment) {
    return (
      <div className="mx-auto max-w-xl py-12 text-center space-y-4">
        <p className="text-sm text-ink-3">No active enrolment found for this organisation.</p>
        <Link href="/" className="text-sm font-semibold text-brand-600 hover:text-brand-700">
          Go to Home
        </Link>
      </div>
    );
  }

  const { data: cert } = await tradeGet<CertificateView>(`/enrollments/${currentEnrollment.id}/certificate`);

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-3 hover:text-ink mb-2"
          >
            <ArrowLeft className="size-3.5" />
            Back to My Plan
          </Link>
          <h1 className="font-display text-2xl font-bold text-ink">Certificate of Completion</h1>
          <p className="text-sm text-ink-3">Official certification for the Entrust TRADE programme.</p>
        </div>

        {cert && (
          <div className="flex items-center gap-3">
            <Link
              href={`/verify/${cert.code}`}
              target="_blank"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-line bg-surface text-xs font-semibold text-ink hover:bg-canvas transition-colors"
            >
              Verify Publicly
            </Link>
          </div>
        )}
      </div>

      {!cert ? (
        <Card className="p-8 text-center space-y-4 border-dashed">
          <Award className="size-12 mx-auto text-ink-3" />
          <h2 className="text-base font-bold text-ink">Certificate In Progress</h2>
          <p className="text-xs text-ink-2 max-w-md mx-auto leading-relaxed">
            Your certificate will be automatically issued once all modules in your active learning plan have been passed.
          </p>
          <div className="pt-2">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand-600 text-xs font-semibold text-white hover:bg-brand-700 shadow-sm"
            >
              Continue My Modules
            </Link>
          </div>
        </Card>
      ) : cert.isRevoked ? (
        <Card className="p-6 space-y-4 border-red-300 bg-red-50/50">
          <div className="flex items-start gap-3">
            <ShieldAlert className="size-6 text-red-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-red-900">Certificate Revoked</span>
                <StatusBadge tone="danger">REVOKED</StatusBadge>
              </div>
              <p className="text-xs text-red-700">
                This certificate has been revoked by Entrust administration.
              </p>
              {cert.revocationReason && (
                <p className="text-xs font-semibold text-red-800 mt-2">
                  Reason: {cert.revocationReason}
                </p>
              )}
            </div>
          </div>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Printable Certificate Canvas */}
          <div className="rounded-2xl border-4 border-double border-amber-200 bg-gradient-to-b from-amber-50/30 via-white to-amber-50/20 p-8 sm:p-12 shadow-md relative overflow-hidden text-center space-y-6">
            <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500" />

            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-700">Entrust Africa</p>
              <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-ink tracking-tight">
                Certificate of Completion
              </h2>
              <p className="text-xs text-ink-3 uppercase tracking-widest font-medium">
                This is to officially certify that
              </p>
            </div>

            <div className="py-2 border-y border-amber-200/60 max-w-md mx-auto space-y-1">
              <h3 className="font-display text-2xl sm:text-3xl font-bold text-ink">
                {cert.recipientName}
              </h3>
              <p className="text-sm font-semibold text-brand-800">
                {cert.recipientOrganizationName}
              </p>
            </div>

            <p className="text-xs text-ink-2 max-w-lg mx-auto leading-relaxed">
              has successfully completed all rigorous theoretical knowledge checks and practical trade deliverables required by the
            </p>

            <div className="space-y-1">
              <h4 className="text-base font-bold text-ink">{cert.programName}</h4>
              <p className="text-xs text-ink-3">
                {cert.cohortName} • Pathway {cert.pathway}
              </p>
            </div>

            <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-line/80 text-left">
              <div>
                <span className="text-[11px] text-ink-3 block uppercase tracking-wider font-semibold">Date of Issuance</span>
                <span className="text-xs font-bold text-ink">
                  {new Date(cert.issuedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
                </span>
              </div>

              <div className="text-center sm:text-right">
                <span className="text-[11px] text-ink-3 block uppercase tracking-wider font-semibold">Certificate ID</span>
                <span className="font-mono text-xs font-bold text-brand-700">{cert.code}</span>
              </div>
            </div>
          </div>

          {/* The programme is done: the next step is to meet buyers. Not printed with the certificate. */}
          {!me.staffRole && (
            <AfriConnectCard
              href={afriConnectBuyersUrl()}
              emphasis="strong"
              title="You've finished the programme. Now meet buyers."
              description="Take what you've built to buyers on AfriConnect: show your products and answer their sourcing requests."
              className="print:hidden"
            />
          )}
        </div>
      )}
    </div>
  );
}
