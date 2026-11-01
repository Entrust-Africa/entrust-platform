import { and, eq } from "drizzle-orm";
import { schema } from "@entrust/db";
import { enqueue, JOB_NAMES } from "@entrust/jobs";
import type { ApplicationDetailView, AssessmentViewType } from "../schemas/summit";
import type { Ctx } from "./access";
import type { Executor } from "./db";
import { ServiceError } from "./errors";
import { findApplication, requireApplicant, requireStaffRole } from "./summit-access";
import { buildDetail, reload } from "./summit-applications";
import { buildAssessmentView } from "./summit-assessment";
import { openClarification } from "./summit-clarification-data";
import { changeStatus, recordSummitChange } from "./summit-status";

// Requests for more information (#79). An officer or administrator asks the applicant for something while the
// application is in assessment; the application waits in "awaiting additional information" until the applicant
// responds, then returns to the stage it left. The applicant is emailed through the background worker.

/** Where the applicant answers, if the Summit app has an address. */
function applicationUrl(applicationId: string): string | undefined {
  const base = process.env.SUMMIT_APP_URL?.trim().replace(/\/+$/, "");
  if (!base) return undefined;
  try {
    return new URL(`/summit/applications/${applicationId}`, base).toString();
  } catch {
    return undefined;
  }
}

/** The person who applied and the owners of the organisation. */
async function recipientsFor(db: Executor, application: { organizationId: string; applicantUserId: string | null }): Promise<string[]> {
  const owners = await db
    .select({ email: schema.user.email })
    .from(schema.member)
    .innerJoin(schema.user, eq(schema.user.id, schema.member.userId))
    .where(and(eq(schema.member.organizationId, application.organizationId), eq(schema.member.role, "owner")));
  const applicant = application.applicantUserId
    ? await db.select({ email: schema.user.email }).from(schema.user).where(eq(schema.user.id, application.applicantUserId))
    : [];
  return [...new Set([...applicant, ...owners].map((r) => r.email))];
}

/**
 * Asks the applicant for more information. The application must be in assessment or verification. It moves to
 * "awaiting additional information" and returns to where it was when the applicant responds. The email is queued
 * after the request is saved: if it can't be queued the request still stands and `notifiedAt` stays empty, so
 * the officer can see the applicant wasn't told.
 */
export async function requestClarification(ctx: Ctx, id: string, message: string): Promise<AssessmentViewType> {
  const created = await ctx.db.transaction(async (tx) => {
    const { row, access } = await findApplication(tx, ctx.principal, id, { lock: true });
    requireStaffRole(access, ["admin", "facilitator", "reviewer"], "ask the applicant for more information");
    if (row.status !== "under_assessment" && row.status !== "under_verification") {
      throw new ServiceError("invalid_transition", "More information can be requested only while the application is in assessment or verification.");
    }
    const [request] = await tx
      .insert(schema.clarificationRequest)
      .values({ applicationId: id, message, requestedBy: ctx.principal.userId, returnStatus: row.status })
      .returning();
    if (!request) throw new Error("The request was not saved");
    await changeStatus(tx, row, "awaiting_additional_information", ctx.principal.userId, "More information requested");
    await recordSummitChange(tx, ctx.principal.userId, {
      action: "summit.clarification.requested",
      entityType: "summit_application",
      entityId: id,
      organizationId: row.organizationId,
      after: { clarificationId: request.id, message },
    });
    const [organisation] = await tx.select({ name: schema.organization.name }).from(schema.organization).where(eq(schema.organization.id, row.organizationId));
    return { request, number: row.number, organizationName: organisation?.name ?? "", to: await recipientsFor(tx, row) };
  });

  try {
    if (created.to.length > 0) {
      const url = applicationUrl(id);
      await enqueue(JOB_NAMES.SEND_EMAIL, {
        to: created.to,
        subject: `More information is needed for ${created.number}`,
        template: "summit-clarification",
        props: { applicationNumber: created.number, organizationName: created.organizationName, message, ...(url ? { url } : {}) },
      });
      await ctx.db.update(schema.clarificationRequest).set({ notifiedAt: new Date() }).where(eq(schema.clarificationRequest.id, created.request.id));
    }
  } catch (error) {
    console.error("[summit] The clarification email could not be queued", error);
  }
  return assessmentFor(ctx, id);
}

/** The applicant answers the open request, and the application returns to the stage it left. */
export async function respondToClarification(ctx: Ctx, id: string, clarificationId: string, response: string): Promise<ApplicationDetailView> {
  return ctx.db.transaction(async (tx) => {
    const { row, access } = await findApplication(tx, ctx.principal, id, { lock: true });
    requireApplicant(access, "answer a request for more information");
    const open = await openClarification(tx, id);
    if (row.status !== "awaiting_additional_information" || !open) {
      throw new ServiceError("invalid_transition", "There is no request for more information waiting for an answer.");
    }
    if (open.id !== clarificationId) throw new ServiceError("not_found", "Request not found.");

    await tx
      .update(schema.clarificationRequest)
      .set({ response, respondedBy: ctx.principal.userId, respondedAt: ctx.now })
      .where(eq(schema.clarificationRequest.id, open.id));
    await changeStatus(tx, row, open.returnStatus, ctx.principal.userId, "More information provided");
    await recordSummitChange(tx, ctx.principal.userId, {
      action: "summit.clarification.answered",
      entityType: "summit_application",
      entityId: id,
      organizationId: row.organizationId,
      after: { clarificationId, response },
    });
    return buildDetail(tx, await reload(tx, id), access, ctx.now);
  });
}

async function assessmentFor(ctx: Ctx, id: string): Promise<AssessmentViewType> {
  const { row } = await findApplication(ctx.db, ctx.principal, id);
  return buildAssessmentView(ctx.db, row);
}
