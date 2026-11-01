import { eq, sql } from "drizzle-orm";
import { schema } from "@entrust/db";
import type { ApplicationStatus } from "@entrust/summit-engine";
import type { Executor } from "./db";
import { ServiceError } from "./errors";

/**
 * Where each status can go. The workflow branches in several places (a clarification request returns to the stage
 * it came from), so this is the one place that says which moves are allowed. A decision of the committee can be
 * replaced by another, or sent back to committee review, until the final list is approved.
 */
export const TRANSITIONS: Readonly<Record<ApplicationStatus, readonly ApplicationStatus[]>> = {
  draft: ["submitted", "withdrawn"],
  submitted: ["under_eligibility_review", "incomplete", "withdrawn"],
  incomplete: ["submitted", "withdrawn"],
  under_eligibility_review: ["eligible", "ineligible", "awaiting_additional_information", "withdrawn"],
  awaiting_additional_information: ["under_eligibility_review", "eligible", "ineligible", "under_assessment", "under_verification", "withdrawn"],
  eligible: ["under_assessment", "ineligible", "withdrawn"],
  ineligible: ["eligible", "awaiting_additional_information", "withdrawn"],
  under_assessment: ["awaiting_additional_information", "under_verification", "assessment_completed", "withdrawn"],
  under_verification: ["under_assessment", "awaiting_additional_information", "assessment_completed", "withdrawn"],
  assessment_completed: ["under_assessment", "recommended", "withdrawn"],
  recommended: ["under_assessment", "committee_review", "withdrawn"],
  committee_review: ["selected", "waitlisted", "not_selected", "withdrawn"],
  selected: ["committee_review", "waitlisted", "not_selected"],
  waitlisted: ["committee_review", "selected", "not_selected"],
  not_selected: ["committee_review", "selected", "waitlisted"],
  withdrawn: [],
};

/** After the committee decides, an application can no longer be withdrawn. */
export const WITHDRAWABLE = (Object.keys(TRANSITIONS) as ApplicationStatus[]).filter((s) => TRANSITIONS[s].includes("withdrawn"));

export const PUBLIC_STATUSES = ["draft", "in_review", "action_required", "not_eligible", "withdrawn", "selected", "waitlisted", "not_selected"] as const;
export type PublicStatus = (typeof PUBLIC_STATUSES)[number];

/**
 * What an applicant sees of the workflow. Where an application is in assessment, verification or committee review is
 * Entrust's business, and so is the committee's decision until the final list is approved. `published` says it has
 * been, for this application's period.
 */
export function publicStatus(status: ApplicationStatus, published = false): PublicStatus {
  switch (status) {
    case "draft":
    case "withdrawn":
      return status;
    case "selected":
    case "waitlisted":
    case "not_selected":
      return published ? status : "in_review";
    case "incomplete":
    case "awaiting_additional_information":
      return "action_required";
    case "ineligible":
      return "not_eligible";
    default:
      return "in_review";
  }
}

export interface SummitChange {
  /** For the audit log, such as "summit.application.submitted". */
  action: string;
  entityType: "summit_application" | "summit_period";
  entityId: string;
  /** The applicant's organisation. A period has none. */
  organizationId: string | null;
  before?: unknown;
  after?: unknown;
  reason?: string | null;
}

/** Records a change in the shared audit log. Run it in the transaction that makes the change. */
export async function recordSummitChange(db: Executor, userId: string | null, change: SummitChange): Promise<void> {
  await db.insert(schema.auditLog).values({
    actorUserId: userId,
    organizationId: change.organizationId,
    platform: "summit",
    action: change.action,
    entityType: change.entityType,
    entityId: change.entityId,
    before: change.before ?? null,
    after: change.after ?? null,
    reason: change.reason ?? null,
  });
}

/**
 * Moves an application to another status, keeping the move in its history and the audit log. A null user is the
 * platform itself, such as the eligibility screening on submit. Run it in the transaction that makes the change.
 */
export async function changeStatus(
  db: Executor,
  application: { id: string; organizationId: string; status: ApplicationStatus },
  to: ApplicationStatus,
  userId: string | null,
  reason?: string | null,
): Promise<void> {
  const from = application.status;
  if (!TRANSITIONS[from].includes(to)) {
    throw new ServiceError("invalid_transition", `An application can't go from ${from.replaceAll("_", " ")} to ${to.replaceAll("_", " ")}.`);
  }
  await db.update(schema.application).set({ status: to }).where(eq(schema.application.id, application.id));
  await db.insert(schema.applicationStatusChange).values({
    applicationId: application.id,
    fromStatus: from,
    toStatus: to,
    changedBy: userId,
    // clock_timestamp(), not the transaction's start: several moves in one transaction keep their order.
    changedAt: sql`clock_timestamp()`,
    reason: reason ?? null,
  });
  await recordSummitChange(db, userId, {
    action: "summit.application.status",
    entityType: "summit_application",
    entityId: application.id,
    organizationId: application.organizationId,
    before: { status: from },
    after: { status: to },
    reason: reason ?? null,
  });
  application.status = to;
}
