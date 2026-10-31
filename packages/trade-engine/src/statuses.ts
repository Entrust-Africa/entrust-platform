// Controlled status values for TRADE's workflow, from section 5 of the placement spec's data model and
// workflow part. They live here, as CLEAR's live in gate-engine, so the database imports them.

export const ENROLLMENT_STATUSES = ["invited", "registered", "active", "paused", "completed", "withdrawn"] as const;
export type EnrollmentStatus = (typeof ENROLLMENT_STATUSES)[number];

export const ASSESSMENT_STATUSES = ["draft", "submitted", "scored", "review_required", "superseded"] as const;
export type AssessmentStatus = (typeof ASSESSMENT_STATUSES)[number];

export const LEARNING_PLAN_STATUSES = ["generated", "review_required", "approved", "active", "completed", "superseded"] as const;
export type LearningPlanStatus = (typeof LEARNING_PLAN_STATUSES)[number];

export const MODULE_PROGRESS_STATUSES = ["not_started", "in_progress", "submitted", "needs_revision", "passed", "exempted"] as const;
export type ModuleProgressStatus = (typeof MODULE_PROGRESS_STATUSES)[number];

export const EVIDENCE_REVIEW_STATUSES = ["not_submitted", "submitted", "under_review", "accepted", "rejected", "resubmission_required"] as const;
export type EvidenceReviewStatus = (typeof EVIDENCE_REVIEW_STATUSES)[number];

export const OPPORTUNITY_STATUSES = ["identified", "qualified", "inquiry", "quotation", "negotiation", "order_confirmed", "lost", "completed"] as const;
export type OpportunityStatus = (typeof OPPORTUNITY_STATUSES)[number];

export const FINANCING_OUTCOME_STATUSES = ["not_started", "application_prepared", "submitted", "approved", "declined", "disbursed", "cancelled"] as const;
export type FinancingOutcomeStatus = (typeof FINANCING_OUTCOME_STATUSES)[number];

export const EXPORT_OUTCOME_STATUSES = ["planned", "preparing", "shipped", "delivered", "payment_pending", "paid", "disputed", "cancelled"] as const;
export type ExportOutcomeStatus = (typeof EXPORT_OUTCOME_STATUSES)[number];

/**
 * How well an answer is backed, weakest first. Stored beside a score and never mixed into it. Not
 * the same list as CLEAR's evidence statuses.
 */
export const EVIDENCE_CONFIDENCE = ["self_reported", "documented", "reviewed", "verified"] as const;
export type EvidenceConfidence = (typeof EVIDENCE_CONFIDENCE)[number];

/** The weaker of two confidence levels. */
export const weakerConfidence = (a: EvidenceConfidence, b: EvidenceConfidence): EvidenceConfidence =>
  EVIDENCE_CONFIDENCE.indexOf(a) <= EVIDENCE_CONFIDENCE.indexOf(b) ? a : b;
