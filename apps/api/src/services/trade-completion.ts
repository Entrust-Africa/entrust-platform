import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { schema } from "@entrust/db";
import { findTradeRules, type ModuleId } from "@entrust/trade-rules";
import { findVersion } from "@entrust/trade-content";
import {
  checkModuleCompletionCriteria,
  checkProgramCompletion,
  generateCertificateCode,
} from "@entrust/trade-engine";
import type {
  AdminOverrideModuleInput,
  CertificateView,
  ExitAssessmentReportView,
  PublicCertificateView,
} from "../schemas/trade";
import type { Ctx, Principal } from "./access";
import type { Executor } from "./db";
import { ServiceError } from "./errors";
import { accessTo, recordTradeChange } from "./trade-shared";
import { isLearningPlan, moduleContentWorksheets } from "./trade-worksheet-definitions";

/**
 * Checks module completion criteria and if complete, marks module progress passed.
 * Furthermore, checks if all assigned modules in the active learning plan are complete;
 * if so, marks the learning plan & enrollment completed and automatically issues a certificate (#71).
 */
export async function evaluateAndSyncModuleCompletion(
  tx: Executor,
  ctx: Pick<Ctx, "principal" | "now">,
  enrollmentId: string,
  moduleId: ModuleId,
): Promise<{ modulePassed: boolean; programCompleted: boolean; certificateId?: string }> {
  // 1. Fetch enrollment, cohort, program, and organization
  const [enrollmentRow] = await tx
    .select({
      enrollment: schema.enrollment,
      cohort: schema.cohort,
      program: schema.program,
      org: schema.organization,
    })
    .from(schema.enrollment)
    .innerJoin(schema.cohort, eq(schema.enrollment.cohortId, schema.cohort.id))
    .innerJoin(schema.program, eq(schema.cohort.programId, schema.program.id))
    .innerJoin(schema.organization, eq(schema.enrollment.organizationId, schema.organization.id))
    .where(eq(schema.enrollment.id, enrollmentId));

  if (!enrollmentRow) return { modulePassed: false, programCompleted: false };

  // 2. Fetch module progress
  const [modProgress] = await tx
    .select()
    .from(schema.moduleProgress)
    .where(and(eq(schema.moduleProgress.enrollmentId, enrollmentId), eq(schema.moduleProgress.moduleId, moduleId)));

  // If already passed and not admin-overridden freshly, check program completion directly
  const alreadyPassed = modProgress?.status === "passed";

  // Check exemption
  const [exemption] = await tx
    .select()
    .from(schema.moduleExemption)
    .where(
      and(
        eq(schema.moduleExemption.enrollmentId, enrollmentId),
        eq(schema.moduleExemption.moduleId, moduleId),
        eq(schema.moduleExemption.status, "approved")
      )
    );

  const isExempt = !!exemption || modProgress?.status === "exempted";

  // Check content lessons count
  // Only lessons that are in the content count, so a made-up lesson ID can't stand in for a real one.
  const content =
    findVersion(moduleId, "learner", modProgress?.contentVersion ?? undefined) ?? findVersion(moduleId, "learner");
  const lessonIds = content?.lessons.map((l) => l.id) ?? [];
  const lessonsCount = lessonIds.length;
  const recorded = (modProgress?.lessonProgress as { completedLessons?: unknown } | null)?.completedLessons;
  const completedLessons = Array.isArray(recorded) ? lessonIds.filter((id) => recorded.includes(id)).length : 0;

  // Check knowledge check passed
  const kcScore = modProgress?.knowledgeCheckScore ? Number(modProgress.knowledgeCheckScore) : 0;
  let knowledgeCheckPassed = kcScore >= 80;
  if (!knowledgeCheckPassed) {
    const [passedAttempt] = await tx
      .select()
      .from(schema.knowledgeCheckAttempt)
      .where(
        and(
          eq(schema.knowledgeCheckAttempt.enrollmentId, enrollmentId),
          eq(schema.knowledgeCheckAttempt.moduleId, moduleId),
          eq(schema.knowledgeCheckAttempt.passed, true)
        )
      )
      .limit(1);
    if (passedAttempt) knowledgeCheckPassed = true;
  }

  // Check practical deliverable passed
  // The newest submission decides. An earlier pass doesn't stand once newer work has failed or is still being assessed.
  const [latestSub] = await tx
    .select({ status: schema.moduleSubmission.status })
    .from(schema.moduleSubmission)
    .where(and(eq(schema.moduleSubmission.enrollmentId, enrollmentId), eq(schema.moduleSubmission.moduleId, moduleId)))
    .orderBy(desc(schema.moduleSubmission.version))
    .limit(1);
  const practicalDeliverablePassed = latestSub?.status === "passed";

  // Check plan acknowledgement (if M01)
  const [activePlan] = await tx
    .select()
    .from(schema.learningPlan)
    .where(
      and(
        eq(schema.learningPlan.enrollmentId, enrollmentId),
        // A generated plan needs no human review, so the learner works from it as it is.
        inArray(schema.learningPlan.status, ["generated", "approved", "active", "completed"])
      )
    )
    .orderBy(desc(schema.learningPlan.createdAt))
    .limit(1);

  const planAcknowledged = activePlan?.acknowledgedAt !== null && activePlan?.acknowledgedAt !== undefined;

  // A module on Entrust's common standard ends with an individual learning plan.
  const individualPlan = moduleContentWorksheets(moduleId).find(isLearningPlan);
  let individualPlanSubmitted: boolean | undefined;
  if (individualPlan) {
    const [submitted] = await tx
      .select({ id: schema.worksheetVersion.id })
      .from(schema.worksheetVersion)
      .where(
        and(
          eq(schema.worksheetVersion.enrollmentId, enrollmentId),
          eq(schema.worksheetVersion.worksheetId, individualPlan.id),
          eq(schema.worksheetVersion.status, "submitted")
        )
      )
      .limit(1);
    individualPlanSubmitted = !!submitted;
  }

  const criteria = checkModuleCompletionCriteria({
    lessonsCount,
    completedLessonsCount: completedLessons,
    knowledgeCheckPassed,
    practicalDeliverablePassed,
    isExempt,
    isM01: moduleId === "M01",
    planAcknowledged,
    ...(individualPlanSubmitted === undefined ? {} : { individualPlanSubmitted }),
    adminOverride: !!modProgress?.adminOverrideAt,
  });

  let modulePassed = alreadyPassed;
  if (criteria.complete && !alreadyPassed) {
    await tx
      .update(schema.moduleProgress)
      .set({
        status: "passed",
        completedAt: ctx.now,
        updatedAt: ctx.now,
      })
      .where(and(eq(schema.moduleProgress.enrollmentId, enrollmentId), eq(schema.moduleProgress.moduleId, moduleId)));

    await recordTradeChange(tx, ctx.principal.userId, {
      action: "trade.module.completed",
      organizationId: enrollmentRow.enrollment.organizationId,
      entityId: modProgress?.id ?? `${enrollmentId}:${moduleId}`,
      after: { moduleId, status: "passed", completedAt: ctx.now.toISOString() },
    });
    modulePassed = true;
  }

  // 3. Check Program Completion
  // Program is complete when EVERY module in the active plan is passed or exempted
  let programCompleted = false;
  let certificateId: string | undefined;

  // A withdrawn business doesn't graduate, even if the last score comes in after it left.
  if (activePlan && enrollmentRow.enrollment.status !== "withdrawn") {
    const assigned = await tx
      .select({ moduleId: schema.moduleAssignment.moduleId, status: schema.moduleAssignment.status })
      .from(schema.moduleAssignment)
      .where(eq(schema.moduleAssignment.planId, activePlan.id));

    // A module offered as an optional test-out doesn't hold the programme back.
    const assignedModuleIds = assigned.filter((a) => a.status !== "optional").map((a) => a.moduleId);

    // Get all passed or exempted modules for this enrollment
    const allProgress = await tx
      .select({
        moduleId: schema.moduleProgress.moduleId,
        status: schema.moduleProgress.status,
      })
      .from(schema.moduleProgress)
      .where(eq(schema.moduleProgress.enrollmentId, enrollmentId));

    const allExemptions = await tx
      .select({ moduleId: schema.moduleExemption.moduleId })
      .from(schema.moduleExemption)
      .where(
        and(
          eq(schema.moduleExemption.enrollmentId, enrollmentId),
          eq(schema.moduleExemption.status, "approved")
        )
      );

    const completedOrExemptSet = new Set<string>([
      ...allProgress.filter((p) => p.status === "passed" || p.status === "exempted").map((p) => p.moduleId),
      ...allExemptions.map((e) => e.moduleId),
    ]);

    // If current module just passed in this evaluation, add it:
    if (modulePassed) {
      completedOrExemptSet.add(moduleId);
    }

    const isProgComplete = checkProgramCompletion({
      assignedModules: assignedModuleIds,
      passedOrExemptModuleIds: [...completedOrExemptSet],
    });

    if (isProgComplete) {
      programCompleted = true;

      // Update plan to completed
      if (activePlan.status !== "completed") {
        await tx
          .update(schema.learningPlan)
          .set({ status: "completed", updatedAt: ctx.now })
          .where(eq(schema.learningPlan.id, activePlan.id));
      }

      // Update enrollment to completed
      if (enrollmentRow.enrollment.status !== "completed") {
        await tx
          .update(schema.enrollment)
          .set({ status: "completed", completedAt: ctx.now, updatedAt: ctx.now })
          .where(eq(schema.enrollment.id, enrollmentId));

        await recordTradeChange(tx, ctx.principal.userId, {
          action: "trade.program.completed",
          organizationId: enrollmentRow.enrollment.organizationId,
          entityId: enrollmentId,
          after: { completedAt: ctx.now.toISOString() },
        });
      }

      // Check if certificate already issued
      const [existingCert] = await tx
        .select()
        .from(schema.certificate)
        // A revoked certificate doesn't count: passing again earns a new one.
        .where(and(eq(schema.certificate.enrollmentId, enrollmentId), isNull(schema.certificate.revokedAt)))
        .limit(1);

      if (!existingCert) {
        // Fetch recipient name (SME owner or organization name)
        const [owner] = await tx
          .select({ name: schema.user.name })
          .from(schema.member)
          .innerJoin(schema.user, eq(schema.member.userId, schema.user.id))
          .where(
            and(
              eq(schema.member.organizationId, enrollmentRow.enrollment.organizationId),
              eq(schema.member.role, "owner")
            )
          )
          .limit(1);

        const recipientName = owner?.name?.trim() || enrollmentRow.org.name;
        const certCode = generateCertificateCode(ctx.now.getUTCFullYear());

        const [createdCert] = await tx
          .insert(schema.certificate)
          .values({
            enrollmentId,
            code: certCode,
            recipientName,
            recipientOrganizationName: enrollmentRow.org.name,
            programName: enrollmentRow.program.name,
            cohortName: enrollmentRow.cohort.name,
            pathway: activePlan.pathway,
            issuedAt: ctx.now,
          })
          .returning();

        if (createdCert) {
          certificateId = createdCert.id;
          await recordTradeChange(tx, ctx.principal.userId, {
            action: "trade.certificate.issued",
            organizationId: enrollmentRow.enrollment.organizationId,
            entityId: createdCert.id,
            after: {
              code: certCode,
              recipientName,
              programName: enrollmentRow.program.name,
              cohortName: enrollmentRow.cohort.name,
            },
          });
        }
      } else {
        certificateId = existingCert.id;
      }
    }
  }

  return { modulePassed, programCompleted, certificateId };
}

/**
 * An override turned a pass into a fail, so what that pass earned no longer stands: the certificate is
 * revoked, and a completed enrolment and plan go back to active. Attendance, progress and attempts stay.
 */
export async function reopenAfterFailedOverride(
  tx: Executor,
  ctx: Pick<Ctx, "principal" | "now">,
  enrollmentId: string,
  moduleId: ModuleId,
  reason: string,
): Promise<void> {
  const [enrollment] = await tx.select().from(schema.enrollment).where(eq(schema.enrollment.id, enrollmentId));
  if (!enrollment) return;

  const revocationReason = `Score for ${moduleId} overridden to a fail: ${reason}`;
  const revoked = await tx
    .update(schema.certificate)
    .set({ revokedAt: ctx.now, revokedByUserId: ctx.principal.userId, revocationReason, updatedAt: ctx.now })
    .where(and(eq(schema.certificate.enrollmentId, enrollmentId), isNull(schema.certificate.revokedAt)))
    .returning();
  for (const cert of revoked) {
    await recordTradeChange(tx, ctx.principal.userId, {
      action: "trade.certificate.revoked",
      organizationId: enrollment.organizationId,
      entityId: cert.id,
      after: { code: cert.code, revokedAt: ctx.now.toISOString(), revokedBy: ctx.principal.userId, reason: revocationReason },
    });
  }

  await tx
    .update(schema.learningPlan)
    .set({ status: "active", updatedAt: ctx.now })
    .where(and(eq(schema.learningPlan.enrollmentId, enrollmentId), eq(schema.learningPlan.status, "completed")));

  if (enrollment.status === "completed") {
    await tx
      .update(schema.enrollment)
      .set({ status: "active", completedAt: null, updatedAt: ctx.now })
      .where(eq(schema.enrollment.id, enrollmentId));
    await recordTradeChange(tx, ctx.principal.userId, {
      action: "trade.program.reopened",
      organizationId: enrollment.organizationId,
      entityId: enrollmentId,
      after: { moduleId, reason: revocationReason },
    });
  }
}

/**
 * Admin override to manually complete a module with a required reason (#71).
 */
export async function adminOverrideModuleCompletion(
  ctx: Ctx,
  body: AdminOverrideModuleInput,
): Promise<{ success: boolean; moduleId: ModuleId; enrollmentId: string }> {
  if (ctx.principal.staffRole !== "admin") {
    throw new ServiceError("forbidden", "Only an Entrust administrator can override module completion.");
  }

  const { enrollmentId, moduleId, reason } = body;

  return ctx.db.transaction(async (tx) => {
    const [enrollment] = await tx
      .select()
      .from(schema.enrollment)
      .where(eq(schema.enrollment.id, enrollmentId));

    if (!enrollment) {
      throw new ServiceError("not_found", "Enrollment not found.");
    }

    // Upsert module progress to passed with admin override
    const [existing] = await tx
      .select()
      .from(schema.moduleProgress)
      .where(and(eq(schema.moduleProgress.enrollmentId, enrollmentId), eq(schema.moduleProgress.moduleId, moduleId)));

    if (existing) {
      await tx
        .update(schema.moduleProgress)
        .set({
          status: "passed",
          adminOverrideByUserId: ctx.principal.userId,
          adminOverrideReason: reason,
          adminOverrideAt: ctx.now,
          completedAt: ctx.now,
          updatedAt: ctx.now,
        })
        .where(eq(schema.moduleProgress.id, existing.id));
    } else {
      await tx.insert(schema.moduleProgress).values({
        enrollmentId,
        moduleId,
        contentVersion: "0.1.0",
        status: "passed",
        adminOverrideByUserId: ctx.principal.userId,
        adminOverrideReason: reason,
        adminOverrideAt: ctx.now,
        completedAt: ctx.now,
      });
    }

    await recordTradeChange(tx, ctx.principal.userId, {
      action: "trade.module.admin_override",
      organizationId: enrollment.organizationId,
      entityId: `${enrollmentId}:${moduleId}`,
      after: {
        moduleId,
        reason,
        overriddenBy: ctx.principal.userId,
      },
    });

    // Check program completion
    await evaluateAndSyncModuleCompletion(tx, ctx, enrollmentId, moduleId);

    return { success: true, moduleId, enrollmentId };
  });
}

/**
 * Public lookup of certificate by code. No authentication required (#71).
 */
export async function getCertificateByCodePublic(
  db: Executor,
  code: string,
): Promise<PublicCertificateView> {
  const normalized = code.trim().toUpperCase();
  const [cert] = await db
    .select()
    .from(schema.certificate)
    .where(eq(schema.certificate.code, normalized));

  if (!cert) {
    throw new ServiceError("not_found", `Certificate with code ${normalized} not found.`);
  }

  const isRevoked = cert.revokedAt !== null;

  return {
    code: cert.code,
    recipientName: cert.recipientName,
    recipientOrganizationName: cert.recipientOrganizationName,
    programName: cert.programName,
    cohortName: cert.cohortName,
    pathway: cert.pathway,
    issuedAt: cert.issuedAt.toISOString(),
    isValid: !isRevoked,
    isRevoked,
    revokedAt: cert.revokedAt ? cert.revokedAt.toISOString() : null,
    revocationReason: cert.revocationReason ?? null,
  };
}

/**
 * Authenticated certificate retrieval for an enrollment (#71).
 */
export async function getCertificateForEnrollment(
  ctx: Ctx,
  enrollmentId: string,
): Promise<CertificateView | null> {
  const [enrollment] = await ctx.db
    .select()
    .from(schema.enrollment)
    .where(eq(schema.enrollment.id, enrollmentId));

  if (!enrollment) {
    throw new ServiceError("not_found", "Enrollment not found.");
  }

  const access = await accessTo(ctx.db, ctx.principal, enrollment.organizationId);
  if (!access) {
    throw new ServiceError("forbidden", "Access denied.");
  }

  const [cert] = await ctx.db
    .select()
    .from(schema.certificate)
    .where(eq(schema.certificate.enrollmentId, enrollmentId))
    .orderBy(desc(schema.certificate.issuedAt))
    .limit(1);

  if (!cert) return null;

  const isRevoked = cert.revokedAt !== null;

  return {
    id: cert.id,
    enrollmentId: cert.enrollmentId,
    code: cert.code,
    recipientName: cert.recipientName,
    recipientOrganizationName: cert.recipientOrganizationName,
    programName: cert.programName,
    cohortName: cert.cohortName,
    pathway: cert.pathway,
    issuedAt: cert.issuedAt.toISOString(),
    isValid: !isRevoked,
    isRevoked,
    revokedAt: cert.revokedAt ? cert.revokedAt.toISOString() : null,
    revocationReason: cert.revocationReason ?? null,
    verificationUrl: `/verify/${cert.code}`,
  };
}

/**
 * Revoke an issued certificate with a required reason (#71).
 */
export async function revokeCertificate(
  ctx: Ctx,
  certificateId: string,
  reason: string,
): Promise<CertificateView> {
  if (ctx.principal.staffRole !== "admin") {
    throw new ServiceError("forbidden", "Only an Entrust administrator can revoke certificates.");
  }

  const trimmedReason = reason.trim();
  if (trimmedReason.length < 3) {
    throw new ServiceError("invalid", "A valid reason is required to revoke a certificate.");
  }

  return ctx.db.transaction(async (tx) => {
    const [cert] = await tx
      .select({
        cert: schema.certificate,
        enrollment: schema.enrollment,
      })
      .from(schema.certificate)
      .innerJoin(schema.enrollment, eq(schema.certificate.enrollmentId, schema.enrollment.id))
      .where(eq(schema.certificate.id, certificateId));

    if (!cert) {
      throw new ServiceError("not_found", "Certificate not found.");
    }

    if (cert.cert.revokedAt) {
      throw new ServiceError("invalid_transition", "This certificate has already been revoked.");
    }

    const [updated] = await tx
      .update(schema.certificate)
      .set({
        revokedAt: ctx.now,
        revokedByUserId: ctx.principal.userId,
        revocationReason: trimmedReason,
        updatedAt: ctx.now,
      })
      .where(eq(schema.certificate.id, certificateId))
      .returning();

    await recordTradeChange(tx, ctx.principal.userId, {
      action: "trade.certificate.revoked",
      organizationId: cert.enrollment.organizationId,
      entityId: certificateId,
      after: {
        code: cert.cert.code,
        revokedAt: ctx.now.toISOString(),
        revokedBy: ctx.principal.userId,
        reason: trimmedReason,
      },
    });

    return {
      id: updated!.id,
      enrollmentId: updated!.enrollmentId,
      code: updated!.code,
      recipientName: updated!.recipientName,
      recipientOrganizationName: updated!.recipientOrganizationName,
      programName: updated!.programName,
      cohortName: updated!.cohortName,
      pathway: updated!.pathway,
      issuedAt: updated!.issuedAt.toISOString(),
      isValid: false,
      isRevoked: true,
      revokedAt: updated!.revokedAt ? updated!.revokedAt.toISOString() : null,
      revocationReason: updated!.revocationReason ?? null,
      verificationUrl: `/verify/${updated!.code}`,
    };
  });
}

/**
 * Generates the comparative Capability Report comparing baseline placement assessment
 * with the exit assessment per domain (#71).
 */
export async function getExitAssessmentReport(
  ctx: Ctx,
  enrollmentId: string,
): Promise<ExitAssessmentReportView> {
  const [enrollmentRow] = await ctx.db
    .select({
      enrollment: schema.enrollment,
      cohort: schema.cohort,
      org: schema.organization,
    })
    .from(schema.enrollment)
    .innerJoin(schema.cohort, eq(schema.enrollment.cohortId, schema.cohort.id))
    .innerJoin(schema.organization, eq(schema.enrollment.organizationId, schema.organization.id))
    .where(eq(schema.enrollment.id, enrollmentId));

  if (!enrollmentRow) {
    throw new ServiceError("not_found", "Enrollment not found.");
  }

  const access = await accessTo(ctx.db, ctx.principal, enrollmentRow.enrollment.organizationId);
  if (!access) {
    throw new ServiceError("forbidden", "Access denied.");
  }

  // Get placement assessment
  const [placement] = await ctx.db
    .select()
    .from(schema.tradeAssessment)
    .where(
      and(
        eq(schema.tradeAssessment.enrollmentId, enrollmentId),
        eq(schema.tradeAssessment.kind, "placement"),
        inArray(schema.tradeAssessment.status, ["scored", "review_required"])
      )
    )
    .orderBy(desc(schema.tradeAssessment.createdAt))
    .limit(1);

  // Get exit assessment
  const [exitAss] = await ctx.db
    .select()
    .from(schema.tradeAssessment)
    .where(
      and(
        eq(schema.tradeAssessment.enrollmentId, enrollmentId),
        eq(schema.tradeAssessment.kind, "exit"),
        inArray(schema.tradeAssessment.status, ["scored", "review_required"])
      )
    )
    .orderBy(desc(schema.tradeAssessment.createdAt))
    .limit(1);

  // Fetch placement scores
  const placementScores = placement
    ? await ctx.db
        .select()
        .from(schema.capabilityScore)
        .where(
          and(
            eq(schema.capabilityScore.assessmentId, placement.id),
            eq(schema.capabilityScore.kind, "domain")
          )
        )
    : [];

  // Fetch exit scores
  const exitScores = exitAss
    ? await ctx.db
        .select()
        .from(schema.capabilityScore)
        .where(
          and(
            eq(schema.capabilityScore.assessmentId, exitAss.id),
            eq(schema.capabilityScore.kind, "domain")
          )
        )
    : [];

  const rules = findTradeRules("0.1.0")!;
  const domainTitles = new Map<string, string>(rules.domains.map((d) => [d.id, d.title]));

  const placementMap = new Map(placementScores.map((s) => [s.domain, s]));
  const exitMap = new Map(exitScores.map((s) => [s.domain, s]));

  const allDomainIds = Array.from(new Set([...placementMap.keys(), ...exitMap.keys()]));

  const comparisons = allDomainIds.map((domainId) => {
    const p = placementMap.get(domainId);
    const e = exitMap.get(domainId);

    const placementScore = p?.score !== null && p?.score !== undefined ? Number(p.score) : null;
    const exitScore = e?.score !== null && e?.score !== undefined ? Number(e.score) : null;
    const deltaScore =
      exitScore !== null && placementScore !== null
        ? Number((exitScore - placementScore).toFixed(2))
        : null;

    return {
      domainId,
      domainTitle: domainTitles.get(domainId) ?? domainId,
      placementScore,
      placementBand: p?.band ?? null,
      placementBandLabel: p?.band ? p.band.charAt(0).toUpperCase() + p.band.slice(1) : null,
      exitScore,
      exitBand: e?.band ?? null,
      exitBandLabel: e?.band ? e.band.charAt(0).toUpperCase() + e.band.slice(1) : null,
      deltaScore,
    };
  });

  const formatScores = (scores: typeof placementScores) =>
    scores.map((s) => ({
      id: s.domain,
      title: domainTitles.get(s.domain) ?? s.domain,
      score: s.score !== null ? Number(s.score) : null,
      band: s.band,
      bandLabel: s.band ? s.band.charAt(0).toUpperCase() + s.band.slice(1) : null,
      coverage: Math.round(Number(s.coverage) * 100),
      points: s.points,
      maxPoints: s.maxPoints,
      evidence: s.evidenceStatus as any,
    }));

  return {
    enrollmentId,
    organizationId: enrollmentRow.enrollment.organizationId,
    organizationName: enrollmentRow.org.name,
    cohortName: enrollmentRow.cohort.name,
    placementAssessmentId: placement?.id ?? null,
    exitAssessmentId: exitAss?.id ?? null,
    placementScores: formatScores(placementScores),
    exitScores: formatScores(exitScores),
    comparisons,
  };
}
