import { Eye } from "lucide-react";

/**
 * Tells staff whose records they are looking at. A reviewer can read a business's records and change nothing; an
 * administrator or facilitator can change them, and the change is recorded against the business. Shows nothing for the
 * business's own people.
 */
export function StaffNotice({ readOnly, actingAsStaff, organizationName }: { readOnly: boolean; actingAsStaff: boolean; organizationName: string }) {
  if (!readOnly && !actingAsStaff) return null;
  return (
    <div role="note" className="flex items-start gap-3 rounded-lg border border-info/25 bg-info-50 p-4 text-sm">
      <Eye className="mt-0.5 size-4 shrink-0 text-info" aria-hidden="true" />
      <p className="text-ink-2">
        {readOnly ? (
          <>
            <span className="font-semibold text-info">Read only.</span> These are {organizationName}&rsquo;s records. Reviewers can read them but not change them.
          </>
        ) : (
          <>
            <span className="font-semibold text-info">Staff view.</span> You are working in {organizationName}&rsquo;s records. Anything you add or change is recorded against them.
          </>
        )}
      </p>
    </div>
  );
}
