import { and, asc, desc, eq, ne, inArray } from "drizzle-orm";
import { schema } from "@entrust/db";
import { findDiagnosticTemplate } from "@entrust/trade-rules";
import type { Ctx } from "./access";
import { ServiceError } from "./errors";
import { accessTo } from "./trade-shared";

// Readiness profiles (spec 6.5, FRD FR-03): the six areas, each with its own result and no single combined score. The platform has no
// approved method for combining them, so none is made. The areas are read from the business's latest placement assessment (and its
// exit assessment, to compare), so they are never a second copy that could drift from what was scored.

export const READINESS_AREAS = ["financial", "insurance_risk", "production_operations", "market_buyers", "export_execution", "management_digital"] as const;
export type ReadinessArea = (typeof READINESS_AREAS)[number];

const LABELS: Record<ReadinessArea, string> = {
  financial: "Financial readiness and bankability",
  insurance_risk: "Insurance and risk protection",
  production_operations: "Production and operational capacity",
  market_buyers: "Market and buyer readiness",
  export_execution: "Export execution and compliance",
  management_digital: "Management and digital readiness",
};

/**
 * Which placement sections feed each area. B buyer development, C financial records and D transaction finance, E costing and
 * execution, F digital operations, G operational readiness. Insurance has no placement section: it comes from the onboarding
 * diagnostic's insurance profile, which is not scored and is for EthioLife's review.
 */
const SECTIONS: Record<ReadinessArea, readonly string[]> = {
  financial: ["C", "D"],
  insurance_risk: [],
  production_operations: ["G"],
  market_buyers: ["B"],
  export_execution: ["E"],
  management_digital: ["F"],
};

type Score = typeof schema.capabilityScore.$inferSelect;

/** The area's result from the sections that make it up: the points scored over the points available, across them. */
function areaFrom(area: ReadinessArea, scores: Score[], assessment: { id: string; status: string; assessedAt: Date | null } | null) {
  const parts = scores.filter((s) => SECTIONS[area].includes(s.domain));
  const max = parts.reduce((sum, s) => sum + s.maxPoints, 0);
  // A section with no scored answers (everything unknown or not applicable) has no score, and an area made of such sections has none either: missing is not zero.
  const scored = parts.filter((s) => s.score !== null && s.maxPoints > 0);
  const points = scored.reduce((sum, s) => sum + s.points, 0);
  const scoredMax = scored.reduce((sum, s) => sum + s.maxPoints, 0);
  const coverage = max > 0 ? parts.reduce((sum, s) => sum + Number(s.coverage) * s.maxPoints, 0) / max : null;
  return {
    area,
    label: LABELS[area],
    score: scoredMax > 0 ? Math.round((points / scoredMax) * 10000) / 100 : null,
    classification: parts.length === 1 ? (parts[0]!.band ?? null) : null,
    evidenceCoverage: coverage === null ? null : Math.round(coverage * 100) / 100,
    reviewStatus: assessment ? (assessment.status === "review_required" ? "awaiting_staff_review" : "complete") : "not_assessed",
    assessmentId: assessment?.id ?? null,
    assessedAt: assessment?.assessedAt?.toISOString() ?? null,
    sections: parts.map((s) => ({ section: s.domain, score: s.score === null ? null : Number(s.score), band: s.band, evidenceStatus: s.evidenceStatus })),
  };
}

export async function getReadinessProfiles(ctx: Ctx, input: { organizationId?: string | undefined }) {
  const id = input.organizationId ?? (ctx.principal.smeRoles.size === 1 ? [...ctx.principal.smeRoles.keys()][0] : undefined);
  if (!id) throw new ServiceError("invalid", "Say which organisation (`organizationId`) this is for.");
  if (!(await accessTo(ctx.db, ctx.principal, id))) throw new ServiceError("not_found", "Organisation not found.");

  const [enrollment] = await ctx.db.select({ id: schema.enrollment.id }).from(schema.enrollment).where(eq(schema.enrollment.organizationId, id)).orderBy(desc(schema.enrollment.createdAt)).limit(1);
  const empty = READINESS_AREAS.map((area) => areaFrom(area, [], null));
  if (!enrollment) return { organizationId: id, current: empty, earlier: null, note: NOTE };

  const assessments = await ctx.db
    .select()
    .from(schema.tradeAssessment)
    .where(and(eq(schema.tradeAssessment.enrollmentId, enrollment.id), inArray(schema.tradeAssessment.kind, ["placement", "exit", "diagnostic"]), ne(schema.tradeAssessment.status, "superseded"), ne(schema.tradeAssessment.status, "draft")))
    .orderBy(desc(schema.tradeAssessment.createdAt));
  const placement = assessments.find((a) => a.kind === "placement") ?? null;
  const exit = assessments.find((a) => a.kind === "exit") ?? null;
  const diagnostic = assessments.find((a) => a.kind === "diagnostic") ?? null;

  const scoresOf = async (assessmentId: string | undefined) =>
    assessmentId ? ctx.db.select().from(schema.capabilityScore).where(and(eq(schema.capabilityScore.assessmentId, assessmentId), eq(schema.capabilityScore.kind, "domain"))).orderBy(asc(schema.capabilityScore.domain)) : [];

  // The newest result is the exit assessment if there is one, otherwise the placement; the placement is the baseline to compare it with.
  const latest = exit ?? placement;
  const baseline = exit ? placement : null;
  const [latestScores, baselineScores] = await Promise.all([scoresOf(latest?.id), scoresOf(baseline?.id)]);
  const current = READINESS_AREAS.map((area) => areaFrom(area, latestScores, latest));
  const earlierAreas = baseline ? READINESS_AREAS.map((area) => areaFrom(area, baselineScores, baseline)) : null;

  // Insurance isn't scored. Its profile is the diagnostic's insurance section, and its status is where that stands.
  const insurance = current.find((c) => c.area === "insurance_risk")!;
  if (diagnostic) {
    const template = findDiagnosticTemplate(diagnostic.templateVersion);
    const questions = (template?.questions ?? []).filter((q) => template?.storage[q.section] === "insurance_profile");
    const answered = questions.length ? await ctx.db.select({ questionId: schema.assessmentResponse.questionId, answer: schema.assessmentResponse.answer }).from(schema.assessmentResponse).where(eq(schema.assessmentResponse.assessmentId, diagnostic.id)) : [];
    const answeredIds = new Set(answered.filter((a) => a.answer !== null).map((a) => a.questionId));
    insurance.evidenceCoverage = questions.length ? Math.round((questions.filter((q) => answeredIds.has(q.id)).length / questions.length) * 100) / 100 : null;
    insurance.reviewStatus = "awaiting_ethiolife_review";
    insurance.assessmentId = diagnostic.id;
    insurance.assessedAt = diagnostic.assessedAt?.toISOString() ?? null;
  }
  return { organizationId: id, current, earlier: earlierAreas, note: NOTE };
}

const NOTE = "These are six separate results. TRADE doesn't add them into one readiness score, because no method for doing that has been approved. Insurance and risk is not scored: it is the business's own insurance profile, waiting for EthioLife's review.";
