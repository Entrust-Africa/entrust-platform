import Link from "next/link";
import { CheckCircle2, ShieldAlert, Award, ArrowLeft } from "lucide-react";
import { Card, StatusBadge } from "@entrust/ui";
import type { PublicCertificateView } from "@/lib/types";

interface PageProps {
  params: Promise<{ code: string }>;
}

async function getCertificate(code: string): Promise<{ data: PublicCertificateView | null; notFound: boolean }> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
  try {
    const res = await fetch(`${apiUrl}/v1/trade/certificates/${encodeURIComponent(code)}/public`, {
      cache: "no-store",
    });
    if (res.status === 404) {
      return { data: null, notFound: true };
    }
    if (!res.ok) {
      return { data: null, notFound: false };
    }
    const data = await res.json();
    return { data, notFound: false };
  } catch {
    return { data: null, notFound: false };
  }
}

export default async function PublicVerifyPage({ params }: PageProps) {
  const { code } = await params;
  const { data: cert, notFound } = await getCertificate(code);

  return (
    <div className="min-h-screen bg-canvas py-12 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-50 border border-brand-200 text-xs font-semibold text-brand-700">
            <Award className="size-4" />
            Official Credential Verification
          </div>
          <h1 className="font-display text-3xl font-bold text-ink">Entrust Verification Registry</h1>
          <p className="text-sm text-ink-3">
            Real-time cryptographic verification of certificates issued under Entrust TRADE.
          </p>
        </div>

        {notFound ? (
          <Card className="p-8 text-center space-y-4 border-red-200 bg-red-50/50">
            <ShieldAlert className="size-12 mx-auto text-red-500" />
            <h2 className="text-lg font-bold text-ink">Certificate Not Found</h2>
            <p className="text-sm text-ink-2 max-w-md mx-auto">
              No active or historical record was found for code <span className="font-mono font-bold text-ink">{code}</span>.
              Please check the spelling or ask the holder for their official link.
            </p>
            <div className="pt-2">
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-600 hover:text-brand-700"
              >
                <ArrowLeft className="size-3.5" />
                Return to Entrust
              </Link>
            </div>
          </Card>
        ) : !cert ? (
          <Card className="p-8 text-center space-y-4">
            <p className="text-sm text-ink-2">Could not connect to the verification registry. Please try again later.</p>
          </Card>
        ) : cert.isRevoked ? (
          <Card className="p-6 sm:p-8 space-y-6 border-red-300 bg-white shadow-sm">
            {/* Revoked Banner */}
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3">
              <ShieldAlert className="size-6 text-red-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-red-900">Certificate Revoked</span>
                  <StatusBadge tone="danger">REVOKED</StatusBadge>
                </div>
                <p className="text-xs text-red-700 leading-relaxed">
                  This credential was previously issued but has been formally revoked by Entrust administration.
                  It is no longer valid or recognized.
                </p>
                {cert.revocationReason && (
                  <div className="mt-2 text-xs text-red-800 bg-white/70 p-2.5 rounded border border-red-200">
                    <span className="font-bold">Official reason:</span> {cert.revocationReason}
                  </div>
                )}
                {cert.revokedAt && (
                  <p className="text-[11px] text-red-600">
                    Revoked on: {new Date(cert.revokedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
                  </p>
                )}
              </div>
            </div>

            {/* Historical Details */}
            <div className="divide-y divide-border text-sm space-y-3 pt-2">
              <div className="flex justify-between py-2">
                <span className="text-ink-3">Credential Code</span>
                <span className="font-mono font-bold text-ink">{cert.code}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-ink-3">Recipient Name</span>
                <span className="font-semibold text-ink">{cert.recipientName}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-ink-3">Enterprise</span>
                <span className="font-semibold text-ink">{cert.recipientOrganizationName}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-ink-3">Program</span>
                <span className="text-ink">{cert.programName}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-ink-3">Cohort</span>
                <span className="text-ink">{cert.cohortName}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-ink-3">Original Issue Date</span>
                <span className="text-ink">
                  {new Date(cert.issuedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
                </span>
              </div>
            </div>
          </Card>
        ) : (
          <Card className="p-6 sm:p-8 space-y-6 bg-white shadow-md border-emerald-200">
            {/* Valid Badge */}
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-3">
              <CheckCircle2 className="size-6 text-emerald-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-emerald-900">Authentic Credential</span>
                  <StatusBadge tone="ok">VERIFIED</StatusBadge>
                </div>
                <p className="text-xs text-emerald-700 leading-relaxed">
                  This certificate has been issued by Entrust Africa following successful completion of all curriculum and practical requirements.
                </p>
              </div>
            </div>

            {/* Certificate Details */}
            <div className="space-y-4 pt-2">
              <div className="border border-border/80 rounded-xl p-5 bg-canvas/40 space-y-3">
                <div className="flex items-baseline justify-between border-b border-border/60 pb-3">
                  <div>
                    <span className="text-xs uppercase tracking-wider text-ink-3 font-semibold">Holder</span>
                    <h3 className="text-lg font-bold text-ink">{cert.recipientName}</h3>
                    <p className="text-xs font-medium text-ink-2">{cert.recipientOrganizationName}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs uppercase tracking-wider text-ink-3 font-semibold">Pathway</span>
                    <p className="text-sm font-bold text-brand-700">Pathway {cert.pathway}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
                  <div>
                    <span className="text-ink-3 block">Program:</span>
                    <span className="font-medium text-ink">{cert.programName}</span>
                  </div>
                  <div>
                    <span className="text-ink-3 block">Cohort:</span>
                    <span className="font-medium text-ink">{cert.cohortName}</span>
                  </div>
                  <div>
                    <span className="text-ink-3 block">Issued On:</span>
                    <span className="font-medium text-ink">
                      {new Date(cert.issuedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
                    </span>
                  </div>
                  <div>
                    <span className="text-ink-3 block">Certificate ID:</span>
                    <span className="font-mono font-bold text-ink">{cert.code}</span>
                  </div>
                </div>
              </div>
            </div>

            <p className="text-[11px] text-ink-3 text-center leading-relaxed">
              Verified by the Entrust Africa registry. This credential is electronically verifiable and protected against tampering.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}
