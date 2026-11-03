import { eq } from "drizzle-orm";
import { schema } from "@entrust/db";
import { opportunityProfile } from "@entrust/summit-engine";
import type { Ctx } from "./access";
import { ServiceError } from "./errors";
import { toProfilePdf } from "./export";
import { findApplication } from "./summit-access";
import { loadPeriod } from "./summit-applications";
import { SUMMIT_NAME, loadApplications, type ExportedFile } from "./summit-reports";
import { recordSummitChange } from "./summit-status";

// The one-page profile of a selected SME (#80), as a PDF for Entrust's own use. What it holds is
// `opportunityProfile` in the engine, which keeps every internal finding out of it.

const slug = (text: string): string => text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "sme";

/**
 * The profile of a selected SME. Applicants don't make it (it is Entrust's), and an application the caller can't open looks
 * the same as one that doesn't exist. The profile is recorded in the audit log once it is made.
 */
export async function makeProfile(ctx: Ctx, id: string): Promise<ExportedFile> {
  const { row, access } = await findApplication(ctx.db, ctx.principal, id);
  if (access.applicant || (!access.staffRole && !access.committee)) throw new ServiceError("forbidden", "Only Entrust staff and the selection committee can make a profile.");
  if (row.status !== "selected") throw new ServiceError("invalid_transition", "A profile is made for an SME the committee has selected.");

  // The selection number counts the whole period, so the period is loaded and the application found in it.
  const period = await loadPeriod(ctx.db, row.periodId);
  const application = (await loadApplications(ctx.db, period)).find((a) => a.id === id);
  if (!application) throw new ServiceError("not_found", "Application not found.");
  const profile = opportunityProfile(application);

  const [generator] = await ctx.db.select({ name: schema.user.name }).from(schema.user).where(eq(schema.user.id, ctx.principal.userId));
  const generatedBy = generator?.name ?? ctx.principal.userId;
  const body = await toProfilePdf(profile, { generatedAt: ctx.now, generatedBy, summit: SUMMIT_NAME, classification: "Internal" });

  await recordSummitChange(ctx.db, ctx.principal.userId, {
    action: "summit.profile.generated",
    entityType: "summit_application",
    entityId: id,
    organizationId: row.organizationId,
    after: { format: "pdf", classification: "internal", selectionNumber: application.selectionNumber },
  });
  return {
    filename: `summit-profile-${application.selectionNumber === null ? "" : `sel-${String(application.selectionNumber).padStart(3, "0")}-`}${slug(application.businessName)}.pdf`,
    contentType: "application/pdf",
    body,
  };
}
