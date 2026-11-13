"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card } from "@entrust/ui";
import { tradeFetch } from "@/lib/trade-client";

/**
 * Matches a submitted onboarding diagnostic to a business's enrolment, which takes the avenue the form assigned, so the
 * business goes on to placement without filling the diagnostic in again. Only a submission whose email was proven can be
 * linked, and only to an enrolment with no avenue yet; the API says so when it can't.
 */
export function LinkToEnrolment({
  diagnosticId,
  linkedEnrollmentId,
  emailVerified,
  enrollments,
}: {
  diagnosticId: string;
  linkedEnrollmentId: string | null;
  emailVerified: boolean;
  enrollments: { id: string; organizationName: string; cohortName: string }[];
}) {
  const router = useRouter();
  const [enrollmentId, setEnrollmentId] = useState(enrollments[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (linkedEnrollmentId) {
    const linked = enrollments.find((e) => e.id === linkedEnrollmentId);
    return (
      <Card className="p-5 text-sm text-ink-2">
        Linked to {linked ? `${linked.organizationName} (${linked.cohortName})` : "an enrolment"}. Its avenue came from this form.
      </Card>
    );
  }

  async function link() {
    setBusy(true);
    setError(null);
    const res = await tradeFetch("POST", `/public-diagnostics/${diagnosticId}/link`, { enrollmentId });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    router.refresh();
  }

  return (
    <Card className="space-y-3 p-5">
      <h2 className="font-display text-lg font-bold text-ink">Link to a business&apos;s enrolment</h2>
      <p className="text-sm text-ink-2">
        The enrolment takes this form&apos;s avenue, and the business goes on to its placement assessment without filling the diagnostic in again.
      </p>
      {!emailVerified ? (
        <p className="text-sm text-warn">It can be linked once whoever filled it in opens the link in their email.</p>
      ) : enrollments.length === 0 ? (
        <p className="text-sm text-ink-3">No running enrolment you work with to link it to.</p>
      ) : (
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm font-semibold text-ink">
            Enrolment
            <select value={enrollmentId} onChange={(e) => setEnrollmentId(e.target.value)} className="mt-1 block h-10 rounded-md border border-line-strong bg-surface px-3 text-sm text-ink">
              {enrollments.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.organizationName} ({e.cohortName})
                </option>
              ))}
            </select>
          </label>
          <Button onClick={() => void link()} loading={busy} disabled={!enrollmentId}>
            Link
          </Button>
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </Card>
  );
}
