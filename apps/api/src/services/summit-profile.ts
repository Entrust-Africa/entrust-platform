import { eq } from "drizzle-orm";
import { schema } from "@entrust/db";
import { opportunityProfile } from "@entrust/summit-engine";
import type { Ctx } from "./access";
import { ServiceError } from "./errors";
import { toProfilePdf } from "./export";
import { findApplication } from "./summit-access";
import { loadPeriod } from "./summit-applications";
import { SUMMIT_NAME, loadApplications, type ExportedFile } from "./summit-reports";
import { liveSharing } from "./summit-sharing";
import { recordSummitChange } from "./summit-status";

// The one-page profile of a selected SME (#80), as a PDF for Entrust's own use, and a copy for outside Entrust while the business agrees. What it holds is
// `opportunityProfile` in the engine, which keeps every internal finding out of it.

const slug = (text: string): string => text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "sme";

/**
 * The profile of a selected SME. Applicants don't make it (it is Entrust's), and an application the caller can't open looks
 * the same as one that doesn't exist. The profile is recorded in the audit log once it is made.
 */
export async function makeProfile(ctx: Ctx, id: string, copy: "internal" | "external" = "internal"): Promise<ExportedFile> {
  const { row, access } = await findApplication(ctx.db, ctx.principal, id);
  if (access.applicant || (!access.staffRole && !access.committee)) throw new ServiceError("forbidden", "Only Entrust staff and the selection committee can make a profile.");
  if (row.status !== "selected") throw new ServiceError("invalid_transition", "A profile is made for an SME the committee has selected.");
  // A copy for someone outside Entrust is made only for an administrator or facilitator, and only while the business agrees to it.
  // The agreement is read now, not remembered, so taking it back stops the next copy.
  const consent = copy === "external" ? await liveSharing(ctx.db, row) : null;
  if (copy === "external") {
    if (ctx.principal.staffRole !== "admin" && ctx.principal.staffRole !== "facilitator") {
      throw new ServiceError("forbidden", "Only an Entrust administrator or facilitator can make a copy to share outside Entrust.");
    }
    if (!consent) throw new ServiceError("forbidden", "This business hasn't agreed to share its profile outside Entrust, or has taken its agreement back.");
  }

  // The selection number counts the whole period, so the period is loaded and the application found in it.
  const period = await loadPeriod(ctx.db, row.periodId);
  const application = (await loadApplications(ctx.db, period)).find((a) => a.id === id);
  if (!application) throw new ServiceError("not_found", "Application not found.");
  const profile = opportunityProfile(application);

  const [generator] = await ctx.db.select({ name: schema.user.name }).from(schema.user).where(eq(schema.user.id, ctx.principal.userId));
  const generatedBy = generator?.name ?? ctx.principal.userId;
  const body = await toProfilePdf(profile, { generatedAt: ctx.now, generatedBy, summit: SUMMIT_NAME, classification: copy === "external" ? "External, shared with the business's consent" : "Internal" });

  await recordSummitChange(ctx.db, ctx.principal.userId, {
    action: "summit.profile.generated",
    entityType: "summit_application",
    entityId: id,
    organizationId: row.organizationId,
    after: {
      format: "pdf",
      classification: copy,
      selectionNumber: application.selectionNumber,
      ...(consent ? { consentId: consent.id, consentGrantedAt: consent.grantedAt.toISOString() } : {}),
    },
  });
  return {
    filename: `summit-profile-${application.selectionNumber === null ? "" : `sel-${String(application.selectionNumber).padStart(3, "0")}-`}${slug(application.businessName)}${copy === "external" ? "-external" : ""}.pdf`,
    contentType: "application/pdf",
    body,
  };
}
