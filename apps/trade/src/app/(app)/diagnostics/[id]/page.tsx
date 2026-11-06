import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Card, StatusBadge } from "@entrust/ui";
import { getMe } from "@/lib/api";
import { tradeGet } from "@/lib/trade-api";
import type { PublicDiagnosticDetail } from "@/lib/types";

export const metadata = { title: "Onboarding diagnostic" };

const formatDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

/** Staff: one person's answers, section by section, with the avenue they were given and why. */
export default async function DiagnosticDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await getMe();
  if (!me) redirect("/sign-in");
  if (!me.staffRole) redirect("/");

  const { id } = await params;
  const result = await tradeGet<PublicDiagnosticDetail>(`/public-diagnostics/${encodeURIComponent(id)}`);
  if (!result.data) notFound();
  const d = result.data;
  const answered = d.sections.reduce((n, s) => n + s.items.length, 0);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/diagnostics" className="mb-2 inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:underline">
          ← Back to the diagnostics
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold text-ink">{d.businessName ?? "No business name yet"}</h1>
            <p className="mt-1 text-sm text-ink-2">
              <a href={`mailto:${d.email}`} className="underline underline-offset-4">
                {d.email}
              </a>
              {d.phone && (
                <>
                  {" · "}
                  <a href={`tel:${d.phone.replace(/[^+0-9]/g, "")}`} className="underline underline-offset-4">
                    {d.phone}
                  </a>
                </>
              )}
            </p>
          </div>
          <StatusBadge tone={d.status === "submitted" ? "ok" : "warn"}>{d.status === "submitted" ? "Submitted" : "In progress"}</StatusBadge>
        </div>
        <p className="mt-2 text-xs text-ink-3">
          Started {formatDate(d.startedAt)}
          {d.submittedAt ? `, submitted ${formatDate(d.submittedAt)}` : `, ${d.progress.answered} of ${d.progress.total} questions answered`}. Form version {d.templateVersion}.
        </p>
      </div>

      {d.pathway && (
        <Card className="space-y-3 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-lg font-bold text-ink">
              Pathway {d.pathway.pathway}: {d.pathway.name}
            </h2>
            {d.pathway.status === "provisional" && <StatusBadge tone="warn">Provisional</StatusBadge>}
            {d.pathway.liveOrder && <StatusBadge tone="warn">Live order</StatusBadge>}
          </div>
          <ul className="list-disc space-y-1 pl-5 text-sm text-ink-2">
            {d.pathway.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
          {(d.signedName || d.signedPosition || d.signedDate) && (
            <p className="border-t border-line pt-3 text-xs text-ink-3">
              Declaration signed by {d.signedName ?? "—"}
              {d.signedPosition ? `, ${d.signedPosition}` : ""}
              {d.signedDate ? ` on ${d.signedDate}` : ""}.
            </p>
          )}
        </Card>
      )}

      {d.sections.length === 0 ? (
        <Card className="p-6 text-sm text-ink-2">No answers yet.</Card>
      ) : (
        <>
          <p className="text-sm text-ink-2">{answered} answers. Questions hidden by earlier answers are left out.</p>
          {d.sections.map((section) => (
            <Card key={section.id} className="p-5">
              <h2 className="font-display text-base font-bold text-ink">{section.title}</h2>
              <dl className="mt-3 divide-y divide-line">
                {section.items.map((item) => (
                  <div key={item.id} className="grid gap-1 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:gap-4">
                    <dt className="text-sm text-ink-2">
                      <span className="mr-2 font-mono text-xs text-ink-3">{item.id}</span>
                      {item.text}
                    </dt>
                    <dd className="whitespace-pre-wrap break-words text-sm font-semibold text-ink">{item.answer || "—"}</dd>
                  </div>
                ))}
              </dl>
            </Card>
          ))}
        </>
      )}
    </div>
  );
}
